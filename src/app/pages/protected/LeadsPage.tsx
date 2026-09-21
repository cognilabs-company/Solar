import { useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiTrash2 } from 'react-icons/fi'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
	DataTable,
	FilterBar,
	FilterSelect,
	Pagination,
	SearchInput,
	StatusBadge,
	type DataTableColumn,
} from '../../../components/shared/data'
import AppIcon from '../../../components/shared/icons/AppIcon'
import {
	EmptyState,
	PageHeader,
	PageLayout,
	PageSection,
} from '../../../components/shared/page'
import LeadDeleteDialog from '../../../features/leads/components/LeadDeleteDialog'
import LeadDetailPanel from '../../../features/leads/components/LeadDetailPanel'
import LeadFormPanel from '../../../features/leads/components/LeadFormPanel'
import { formatLocalizedDate } from '../../../i18n/date-format'
import { getChannelLabel, getLeadStatusLabel } from '../../../i18n/labels'
import { usePersistentState } from '../../../lib/persistent-state'
import { extractApiErrorMessage } from '../../../lib/api-error'
import { services } from '../../../services'
import { useAuth } from '../../../auth'
import type {
	Lead,
	CreateLeadInput,
	UpdateLeadInput,
} from '../../../services/contracts'

type LeadStatusFilter = string | 'all'
type LeadSourceFilter = string | 'all'
type LeadOrdering = '-updated_at' | 'updated_at' | '-created_at' | 'created_at'

type SelectOption = {
	value: string
	label: string
}

const PAGE_SIZE = 8
const SERVICE_FETCH_SIZE = 300
const SEARCH_DEBOUNCE_MS = 350
const DEFAULT_ORDERING: LeadOrdering = '-updated_at'
const ALL_OPERATORS_VALUE = 'all'
const STATUS_VALUES: readonly string[] = [
	'new',
	'contacted',
	'qualified',
	'lost',
]
const SOURCE_VALUES: readonly string[] = ['manual', 'telegram', 'instagram']

const DEFAULT_PAGINATION = {
	page: 1,
	page_size: PAGE_SIZE,
	total: 0,
}

const tablePrimaryTextClassName =
	'block max-w-[140px] truncate text-sm font-semibold leading-[1.35] text-text-primary min-[640px]:max-w-[220px]'

const tableSecondaryTextClassName =
	'block max-w-[140px] truncate text-[12px] leading-[1.45] text-text-secondary min-[640px]:max-w-[220px]'

const labelClassName =
	'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'

const actionButtonClassName =
	'inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-card text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20'

const UNASSIGNED_OPERATOR_VALUE = ''
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuidLike(value: string | undefined): boolean {
	if (!value) {
		return false
	}

	return UUID_PATTERN.test(value)
}

function formatDate(
	timestamp: string | undefined,
	locale: string,
	fallback: string,
): string {
	return formatLocalizedDate(timestamp, locale, {
		locale,
		withYear: true,
		shortMonth: true,
		fallback,
	})
}

function normalizeLeadSource(source: string): string {
	return source
}

function formatRelativeTime(
	timestamp: string | undefined,
	locale: string,
	fallback: string,
): string {
	if (!timestamp) {
		return fallback
	}

	const target = new Date(timestamp).getTime()
	if (Number.isNaN(target)) {
		return fallback
	}

	const delta = target - Date.now()
	const minute = 60 * 1000
	const hour = 60 * minute
	const day = 24 * hour
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

	if (Math.abs(delta) < hour) {
		return formatter.format(Math.round(delta / minute), 'minute')
	}

	if (Math.abs(delta) < day) {
		return formatter.format(Math.round(delta / hour), 'hour')
	}

	return formatter.format(Math.round(delta / day), 'day')
}

function channelAbbreviation(source: string): string {
	switch (normalizeLeadSource(source)) {
		case 'instagram':
			return 'IG'
		case 'telegram':
			return 'TG'
		case 'manual':
			return 'MN'
		default:
			return 'OTR'
	}
}

function getLeadStatusTone(
	status: string,
): 'info' | 'warning' | 'accent' | 'success' | 'danger' {
	switch (status) {
		case 'new':
			return 'info'
		case 'contacted':
			return 'warning'
		case 'qualified':
			return 'accent'
		case 'lost':
			return 'danger'
		default:
			return 'info'
	}
}

function LeadsPage() {
	const { t, i18n } = useTranslation()
	const { hasPermission, currentUser } = useAuth()
	const canManageLeads = hasPermission('can_manage_leads')
	const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ'
	const relativeLocale = i18n.language === 'ru' ? 'ru' : 'uz'

	const allOperatorsOption = useMemo<SelectOption>(
		() => ({
			value: ALL_OPERATORS_VALUE,
			label: t('leads.allOperators'),
		}),
		[t],
	)

	const statusOptions = useMemo<SelectOption[]>(
		() => [
			{ value: 'all', label: t('leads.allStatuses') },
			...STATUS_VALUES.map(status => ({
				value: status,
				label: getLeadStatusLabel(t, status as any),
			})),
		],
		[t],
	)

	const sourceOptions = useMemo<SelectOption[]>(
		() => [
			{ value: 'all', label: t('leads.allChannels') },
			...SOURCE_VALUES.map(source => ({
				value: source,
				label: getChannelLabel(t, source),
			})),
		],
		[t],
	)

	const orderingOptions = useMemo<SelectOption[]>(
		() => [
			{ value: '-updated_at', label: t('leads.updatedNewest') },
			{ value: 'updated_at', label: t('leads.updatedOldest') },
			{ value: '-created_at', label: t('leads.createdNewest') },
			{ value: 'created_at', label: t('leads.createdOldest') },
		],
		[t],
	)

	const [search, setSearch] = usePersistentState('leads:search', '')
	const [debouncedSearch, setDebouncedSearch] = useState('')
	const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all')
	const [sourceFilter, setSourceFilter] = useState<LeadSourceFilter>('all')
	const [assignedOperatorFilter, setAssignedOperatorFilter] =
		useState<string>(ALL_OPERATORS_VALUE)
	const [ordering, setOrdering] = useState<LeadOrdering>(DEFAULT_ORDERING)
	const [currentPage, setCurrentPage] = useState(1)
	const [leads, setLeads] = useState<Lead[]>([])
	const [pagination, setPagination] = useState(DEFAULT_PAGINATION)
	const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
	const [operatorOptions, setOperatorOptions] = useState<SelectOption[]>([
		allOperatorsOption,
	])
	const [operatorNameById, setOperatorNameById] = useState<Map<string, string>>(
		() => new Map(),
	)
	const [isLoading, setIsLoading] = useState(true)
	const [hasError, setHasError] = useState(false)
	const [detailRefreshToken, setDetailRefreshToken] = useState(0)
	const [reloadCursor, setReloadCursor] = useState(0)

	const [isFormOpen, setIsFormOpen] = useState(false)
	const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
	const [editingLead, setEditingLead] = useState<Lead | null>(null)
	const [isSaving, setIsSaving] = useState(false)
	const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)

	const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null)
	const [isDeleting, setIsDeleting] = useState(false)
	const [deleteError, setDeleteError] = useState<string | null>(null)

	const location = useLocation()
	const navigate = useNavigate()

	useEffect(() => {
		const state = location.state as { selectedLeadId?: string } | null
		if (state?.selectedLeadId && isUuidLike(state.selectedLeadId)) {
			setSelectedLeadId(state.selectedLeadId)
			// Consume route state via React Router to preserve internal history metadata.
			navigate(location.pathname, { replace: true, state: null })
		}
	}, [location, navigate])

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			setDebouncedSearch(search.trim())
		}, SEARCH_DEBOUNCE_MS)

		return () => {
			window.clearTimeout(timeoutId)
		}
	}, [search])

	useEffect(() => {
		setCurrentPage(1)
	}, [
		debouncedSearch,
		statusFilter,
		sourceFilter,
		assignedOperatorFilter,
		ordering,
	])

	useEffect(() => {
		let isActive = true

		async function loadOperatorOptions() {
			const usersResult = await Promise.allSettled([
				services.users.listUsers({
					page: 1,
					page_size: SERVICE_FETCH_SIZE,
					ordering: 'full_name',
				}),
			])

			if (!isActive) {
				return
			}

			const operatorsById = new Map<string, string>()

			if (usersResult[0].status === 'fulfilled') {
				const usersPayload = usersResult[0].value as {
					items?: Array<{ id: string; full_name?: string | null }>
					results?: Array<{ id: string; full_name?: string | null }>
				}
				const users = Array.isArray(usersPayload.items)
					? usersPayload.items
					: Array.isArray(usersPayload.results)
						? usersPayload.results
						: []

				users.forEach(operator => {
					if (operator.full_name) {
						operatorsById.set(operator.id, operator.full_name)
					}
				})
			}

			if (currentUser?.role === 'operator') {
				operatorsById.set(currentUser.id, currentUser.fullName)
			}

			const nextOptions: SelectOption[] = [
				allOperatorsOption,
				...Array.from(operatorsById.entries())
					.sort((left, right) => left[1].localeCompare(right[1]))
					.map(([value, label]) => ({ value, label })),
			]

			setOperatorNameById(new Map(operatorsById))
			setOperatorOptions(nextOptions)
		}

		void loadOperatorOptions()

		return () => {
			isActive = false
		}
	}, [allOperatorsOption, currentUser, reloadCursor])

	const leadsWithOperatorNames = useMemo<Lead[]>(() => {
		return leads
	}, [leads])

	useEffect(() => {
		let isActive = true

		async function loadLeads() {
			setIsLoading(true)
			setHasError(false)

			try {
				const result = await services.leads.listLeads({
					page: currentPage,
					page_size: PAGE_SIZE,
					search: debouncedSearch || undefined,
					status: statusFilter === 'all' ? undefined : statusFilter,
					source: sourceFilter === 'all' ? undefined : sourceFilter,
					manager:
						assignedOperatorFilter === ALL_OPERATORS_VALUE
							? undefined
							: assignedOperatorFilter,
					ordering,
				})

				if (!isActive) {
					return
				}

				const totalItems = result.meta?.totalItems ?? 0
				const resultPage = result.meta?.page ?? currentPage
				const resultPageSize = result.meta?.pageSize ?? PAGE_SIZE
				const totalPages = Math.ceil(totalItems / PAGE_SIZE)
				if (currentPage > totalPages && totalPages > 0) {
					setCurrentPage(totalPages)
					return
				}

				setLeads(result.items)
				setPagination({
					page: resultPage,
					page_size: resultPageSize,
					total: totalItems,
				})
			} catch {
				if (!isActive) {
					return
				}

				setHasError(true)
				setLeads([])
				setPagination(DEFAULT_PAGINATION)
			} finally {
				if (isActive) {
					setIsLoading(false)
				}
			}
		}

		void loadLeads()

		return () => {
			isActive = false
		}
	}, [
		assignedOperatorFilter,
		currentPage,
		debouncedSearch,
		ordering,
		reloadCursor,
		sourceFilter,
		statusFilter,
	])

	const operatorSelectOptions = useMemo<SelectOption[]>(
		() => [
			{ value: UNASSIGNED_OPERATOR_VALUE, label: t('common.unassigned') },
			...operatorOptions.filter(option => option.value !== ALL_OPERATORS_VALUE),
		],
		[operatorOptions, t],
	)

	function openCreateForm() {
		setFormMode('create')
		setEditingLead(null)
		setFormErrorMessage(null)
		setIsFormOpen(true)
	}

	function openEditForm(lead: Lead) {
		setFormMode('edit')
		setEditingLead(lead)
		setFormErrorMessage(null)
		setIsFormOpen(true)
	}

	function requestDelete(lead: Lead) {
		setLeadToDelete(lead)
	}

	async function handleSaveLead(payload: CreateLeadInput | UpdateLeadInput) {
		setIsSaving(true)
		setFormErrorMessage(null)

		try {
			if (formMode === 'create') {
				await services.leads.createLead(payload as CreateLeadInput)
				setCurrentPage(1)
			} else {
				const editId = editingLead?.id
				if (!editId) {
					throw new Error(t('leads.form.saveError'))
				}

				const updated = await services.leads.updateLead(
					editId,
					payload as UpdateLeadInput,
				)
				if (!updated) {
					throw new Error(t('leads.form.saveError'))
				}

				setDetailRefreshToken(current => current + 1)
			}

			setIsFormOpen(false)
			setEditingLead(null)
			setReloadCursor(current => current + 1)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : t('leads.form.saveError')
			setFormErrorMessage(message)
		} finally {
			setIsSaving(false)
		}
	}

	async function handleConfirmDelete() {
		if (!leadToDelete) {
			return
		}

		setIsDeleting(true)
		setDeleteError(null)

		try {
			await services.leads.deleteLead(leadToDelete.id)

			if (selectedLeadId === leadToDelete.id) {
				setSelectedLeadId(null)
			}

			setLeadToDelete(null)
			setReloadCursor(current => current + 1)
		} catch (error) {
			// keep modal open and show why deletion failed
			setDeleteError(extractApiErrorMessage(error, t('leads.deleteDialog.error')))
		} finally {
			setIsDeleting(false)
		}
	}

	async function handleStatusChange(
		id: string,
		status: string,
	): Promise<Lead | null> {
		const updated = await services.leads.patchLead(id, { status })
		if (!updated) {
			return null
		}

		setLeads(current => current.map(lead => (lead.id === id ? updated : lead)))
		setDetailRefreshToken(current => current + 1)

		return updated
	}

	const columns = useMemo<DataTableColumn<Lead>[]>(() => {
		const baseColumns: DataTableColumn<Lead>[] = [
			{
				key: 'lead',
				label: t('leads.lead'),
				render: lead => (
					<div className='grid gap-0.5'>
						<span className={tablePrimaryTextClassName}>
							{lead.full_name || t('leads.detail.titleFallback')}
						</span>
						<span className={tableSecondaryTextClassName}>
							{lead.ai_summary ?? t('leads.awaitingOutreach')}
						</span>
					</div>
				),
			},
			{
				key: 'contact',
				label: t('leads.contact'),
				render: lead => (
					<div className='grid gap-0.5'>
						<span className={tablePrimaryTextClassName}>
							{lead.phone ?? t('leads.noPhone')}
						</span>
						{lead.manager_username && (
							<span className={tableSecondaryTextClassName}>
								{lead.manager_username}
							</span>
						)}
					</div>
				),
			},
			{
				key: 'source',
				label: t('leads.source'),
				render: lead => {
					const normalizedSource = normalizeLeadSource(lead.source ?? 'manual')

					return (
						<div className='grid gap-0.5'>
							<span className='inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary'>
								<span className='inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-info-bg px-1 text-[10px] font-semibold text-info'>
									{channelAbbreviation(normalizedSource)}
								</span>
								{getChannelLabel(t, normalizedSource)}
							</span>
							<span className={tableSecondaryTextClassName}>
								{lead.ai_summary ?? t('leads.awaitingOutreach')}
							</span>
						</div>
					)
				},
			},
			{
				key: 'status',
				label: t('leads.status'),
				render: lead => (
					<StatusBadge
						status={lead.status ?? 'new'}
						label={getLeadStatusLabel(t, (lead.status ?? 'new') as any)}
						tone={getLeadStatusTone(lead.status ?? 'new')}
					/>
				),
			},
			{
				key: 'owner',
				label: t('leads.owner'),
				render: lead => {
					const managerName = lead.manager
						? operatorNameById.get(lead.manager)
						: null
					return (
						<div className='grid gap-0.5'>
							<span className={tablePrimaryTextClassName}>
								{managerName ??
									lead.manager_username ??
									t('common.unassigned')}
							</span>
						</div>
					)
				},
			},
			{
				key: 'createdAt',
				label: t('leads.detail.created'),
				render: lead => (
					<div className='grid gap-0.5'>
						<span className={tablePrimaryTextClassName}>
							{formatDate(lead.created_at, locale, t('common.na'))}
						</span>
						<span className={tableSecondaryTextClassName}>
							{formatRelativeTime(
								lead.created_at,
								relativeLocale,
								t('common.na'),
							)}
						</span>
					</div>
				),
			},
		]

		if (!canManageLeads) {
			return baseColumns
		}

		return [
			...baseColumns,
			{
				key: 'actions',
				label: t('leads.actions.column'),
				align: 'right',
				render: lead => (
					<div className='flex items-center justify-end gap-1.5'>
						<button
							type='button'
							className={actionButtonClassName}
							onClick={event => {
								event.stopPropagation()
								openEditForm(lead)
							}}
							aria-label={`${t('leads.actions.edit')} ${lead.full_name ?? ''}`}
						>
							<FiEdit2 className='h-3.5 w-3.5' />
						</button>
						<button
							type='button'
							className={actionButtonClassName}
							onClick={event => {
								event.stopPropagation()
								requestDelete(lead)
							}}
							aria-label={`${t('leads.actions.delete')} ${lead.full_name ?? ''}`}
						>
							<FiTrash2 className='h-3.5 w-3.5' />
						</button>
					</div>
				),
			},
		]
	}, [canManageLeads, locale, relativeLocale, t])

	const activeFilterCount =
		Number(statusFilter !== 'all') +
		Number(sourceFilter !== 'all') +
		Number(assignedOperatorFilter !== ALL_OPERATORS_VALUE) +
		Number(ordering !== DEFAULT_ORDERING)

	const header = (
		<PageHeader
			eyebrow={t('leads.pipelineEyebrow')}
			title={t('leads.title')}
			subtitle={t('leads.subtitle')}
			actions={
				<div className='flex w-full flex-wrap items-center gap-2 min-[768px]:w-auto'>
					{canManageLeads ? (
						<button
							type='button'
							className='inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35'
							onClick={openCreateForm}
						>
							<AppIcon name='plus' className='h-4 w-4' aria-hidden='true' />
							{t('leads.newLead')}
						</button>
					) : null}
					<span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent'>
						<AppIcon name='leads' className='h-3.5 w-3.5' aria-hidden='true' />
						{pagination.total} {t('leads.visible')}
					</span>
					{activeFilterCount > 0 ? (
						<span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-surface-subtle px-3 text-[12px] font-semibold text-text-secondary'>
							<AppIcon
								name='filter'
								className='h-3.5 w-3.5'
								aria-hidden='true'
							/>
							{activeFilterCount} {t('leads.filters')}
						</span>
					) : null}
				</div>
			}
		/>
	)

	if (hasError) {
		return (
			<PageLayout header={header}>
				<EmptyState
					title={t('leads.errorTitle')}
					description={t('leads.errorDescription')}
				/>
			</PageLayout>
		)
	}

	return (
		<PageLayout header={header}>
			<PageSection>
				<FilterBar
					actions={
						<div className='flex w-full flex-wrap items-center gap-2 max-[820px]:justify-start min-[820px]:w-auto'>
							<span className='inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface-subtle px-3 text-sm font-semibold text-text-primary'>
								<AppIcon
									name='activity'
									className='h-4 w-4 text-text-muted'
									aria-hidden='true'
								/>
								{pagination.total} {t('leads.count')}
							</span>
							{selectedLeadId ? (
								<span className='inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary/12 px-3 text-sm font-semibold text-text-accent'>
									<AppIcon name='user' className='h-4 w-4' aria-hidden='true' />
									{t('leads.detailOpen')}
								</span>
							) : null}
						</div>
					}
				>
					<SearchInput
						value={search}
						onChange={setSearch}
						placeholder={t('leads.searchPlaceholder')}
					/>

					<label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_200px]'>
						<span className={labelClassName}>{t('leads.status')}</span>
						<FilterSelect
							value={statusFilter}
							options={statusOptions}
							onChange={value => setStatusFilter(value as LeadStatusFilter)}
							disabled={isLoading}
						/>
					</label>

					<label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_200px]'>
						<span className={labelClassName}>{t('leads.channel')}</span>
						<FilterSelect
							value={sourceFilter}
							options={sourceOptions}
							onChange={value => setSourceFilter(value as LeadSourceFilter)}
							disabled={isLoading}
						/>
					</label>

					<label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_220px]'>
						<span className={labelClassName}>
							{t('leads.assignedOperator')}
						</span>
						<FilterSelect
							value={assignedOperatorFilter}
							options={operatorOptions}
							onChange={setAssignedOperatorFilter}
							disabled={isLoading}
						/>
					</label>

					<label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_220px]'>
						<span className={labelClassName}>{t('leads.orderBy')}</span>
						<FilterSelect
							value={ordering}
							options={orderingOptions}
							onChange={value => setOrdering(value as LeadOrdering)}
							disabled={isLoading}
						/>
					</label>
				</FilterBar>

				<div className='grid min-w-0 gap-3'>
					<div className='flex flex-wrap items-center justify-between gap-2 px-1'>
						<h2 className='m-0 text-[1rem] font-semibold text-text-primary'>
							{t('leads.queueTitle')}
						</h2>
						<span className='text-[12px] font-medium text-text-muted'>
							{t('leads.queueHint')}
						</span>
					</div>

					<div className='min-w-0 [&_.data-table__row--clickable:hover_.status-badge]:-translate-y-px'>
						<DataTable
							data={leadsWithOperatorNames}
							columns={columns}
							rowKey='id'
							selectedRowKey={selectedLeadId}
							loading={isLoading}
							onRowClick={lead => setSelectedLeadId(lead.id)}
							emptyTitle={t('leads.emptyTitle')}
							emptyDescription={t('leads.emptyDescription')}
						/>
					</div>
				</div>

				{!isLoading && pagination.total > 0 ? (
					<Pagination
						currentPage={Math.min(
							currentPage,
							Math.ceil(pagination.total / PAGE_SIZE),
						)}
						totalPages={Math.ceil(pagination.total / PAGE_SIZE)}
						totalItems={pagination.total}
						onPageChange={setCurrentPage}
					/>
				) : null}
			</PageSection>

			{selectedLeadId ? (
				<LeadDetailPanel
					leadId={selectedLeadId}
					refreshToken={detailRefreshToken}
					canManageLeads={canManageLeads}
					onClose={() => setSelectedLeadId(null)}
					onEdit={lead => {
						openEditForm(lead)
						setSelectedLeadId(null)
					}}
					onDelete={lead => {
						requestDelete(lead)
						setSelectedLeadId(null)
					}}
					onStatusChange={handleStatusChange}
					resolveOperatorName={(operatorId, fallbackName) =>
						operatorNameById.get(operatorId) ?? fallbackName
					}
				/>
			) : null}

			{isFormOpen ? (
				<LeadFormPanel
					mode={formMode}
					lead={editingLead}
					sourceOptions={sourceOptions.filter(option => option.value !== 'all')}
					statusOptions={statusOptions.filter(option => option.value !== 'all')}
					operatorOptions={operatorSelectOptions}
					isSubmitting={isSaving}
					errorMessage={formErrorMessage}
					onClose={() => {
						if (!isSaving) {
							setIsFormOpen(false)
							setEditingLead(null)
							setFormErrorMessage(null)
						}
					}}
					onSubmit={handleSaveLead}
				/>
			) : null}

			{leadToDelete ? (
				<LeadDeleteDialog
					lead={leadToDelete}
					isDeleting={isDeleting}
					errorMessage={deleteError}
					onCancel={() => {
						if (!isDeleting) {
							setLeadToDelete(null)
							setDeleteError(null)
						}
					}}
					onConfirm={() => {
						void handleConfirmDelete()
					}}
				/>
			) : null}
		</PageLayout>
	)
}

export default LeadsPage


