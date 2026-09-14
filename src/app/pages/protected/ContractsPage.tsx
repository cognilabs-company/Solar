import { useMemo, useState } from 'react'
import { useEffect, useRef } from 'react'
import { FiEdit2, FiTrash2 } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
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
import { formatLocalizedDate } from '../../../i18n/date-format'
import {
	EmptyState,
	PageHeader,
	PageLayout,
	PageSection,
} from '../../../components/shared/page'
import { useList } from '../../../components/hooks'
import ContractDeleteDialog from '../../../features/contracts/components/ContractDeleteDialog'
import ContractDocumentFormPanel from '../../../features/contracts/components/ContractDocumentFormPanel'
import { ContractsDetailPanel } from '../../../features/contracts/components/ContractsDetailPanel'
import { ContractsFormPanel } from '../../../features/contracts/components/ContractsFormPanel'
import { services } from '../../../services'
import { useAuth } from '../../../auth'
import type {
	Contract,
	ContractsListParams,
	PricingMatrixData,
} from '../../../services/contracts'

const labelClassName =
	'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'
const tablePrimaryTextClassName =
	'block max-w-[160px] truncate text-sm font-semibold leading-[1.35] text-text-primary min-[640px]:max-w-[240px]'
const tableSecondaryTextClassName =
	'block max-w-[160px] truncate text-[12px] leading-[1.45] text-text-secondary min-[640px]:max-w-[240px]'
const actionButtonClassName =
	'inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-card text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20'

function statusTone(
	status?: string,
): 'info' | 'warning' | 'accent' | 'success' | 'danger' {
	if (status === 'paid' || status === 'completed') {
		return 'success'
	}
	if (status === 'canceled') {
		return 'danger'
	}
	if (status === 'audit_paid' || status === 'contract_ready' || status === 'in_lot') {
		return 'accent'
	}
	if (status === 'draft') {
		return 'info'
	}
	return 'warning'
}

function normalizeContractStatusForUi(status?: string): string | undefined {
	return status
}

function formatPricingAmount(
	value: string | number | undefined,
	locale: string,
	currencyLabel: string,
): string {
	const parsed = typeof value === 'number' ? value : Number(value)
	if (!Number.isFinite(parsed)) {
		return '-'
	}
	return `${new Intl.NumberFormat(locale, {
		maximumFractionDigits: 0,
	}).format(parsed)} ${currencyLabel}`
}

function ContractsPage() {
	const { t, i18n } = useTranslation()
	const isRu = i18n.language === 'ru'
	const locale = isRu ? 'ru-RU' : 'uz-UZ'
	const location = useLocation()
	const navigate = useNavigate()
	const { hasPermission } = useAuth()
	const canManageContracts = hasPermission('can_manage_contracts')

	const tx = {
		eyebrow: t('contractsPage.eyebrow'),
		title: t('contractsPage.title'),
		subtitle: t('contractsPage.subtitle'),
		newContract: t('contractsPage.newContract'),
		visible: t('contractsPage.visible'),
		detailOpen: t('contractsPage.detailOpen'),
		searchPlaceholder: t('contractsPage.searchPlaceholder'),
		statusLabel: t('contractsPage.statusLabel'),
		panelLabel: t('contractsPage.panelLabel'),
		inverterLabel: t('contractsPage.inverterLabel'),
		powerLabel: t('contractsPage.powerLabel'),
		allStatuses: t('contractsPage.allStatuses'),
		allPanels: t('contractsPage.allPanels'),
		allInverters: t('contractsPage.allInverters'),
		listTitle: t('contractsPage.listTitle'),
		listHint: t('contractsPage.listHint'),
		errorTitle: t('contractsPage.errorTitle'),
		errorDescription: t('contractsPage.errorDescription'),
		columns: {
			title: t('contractsPage.columns.title'),
			amount: t('contractsPage.columns.amount'),
			panel: t('contractsPage.columns.panel'),
			inverter: t('contractsPage.columns.inverter'),
			power: t('contractsPage.columns.power'),
			status: t('contractsPage.columns.status'),
			updated: t('contractsPage.columns.updated'),
			actions: t('contractsPage.columns.actions'),
		},
		statuses: {
			draft: t('contractsPage.statuses.draft'),
			audit_pending: t('contractsPage.statuses.audit_pending'),
			audit_paid: t('contractsPage.statuses.audit_paid'),
			moderation: t('contractsPage.statuses.moderation'),
			contract_ready: t('contractsPage.statuses.contract_ready'),
			payment_pending: t('contractsPage.statuses.payment_pending'),
			paid: t('contractsPage.statuses.paid'),
			in_lot: t('contractsPage.statuses.in_lot'),
			completed: t('contractsPage.statuses.completed'),
			canceled: t('contractsPage.statuses.canceled'),
		},
		edit: t('contractsPage.edit'),
		delete: t('contractsPage.delete'),
		pricing: {
			button: t('contractsPage.pricing.button'),
			title: t('contractsPage.pricing.title'),
			loadingTitle: t('contractsPage.pricing.loadingTitle'),
			loadingDescription: t('contractsPage.pricing.loadingDescription'),
			emptyTitle: t('contractsPage.pricing.emptyTitle'),
			emptyDescription: t('contractsPage.pricing.emptyDescription'),
			subsidy: t('contractsPage.pricing.subsidy'),
			auditPowers: t('contractsPage.pricing.auditPowers'),
			configurations: t('contractsPage.pricing.configurations'),
			power: t('contractsPage.pricing.power'),
			view: t('contractsPage.pricing.view'),
			basePrice: t('contractsPage.pricing.basePrice'),
			customerPrice: t('contractsPage.pricing.customerPrice'),
			audit: t('contractsPage.pricing.audit'),
			currency: t('contractsPage.pricing.currency'),
		},
	}

	const [searchQuery, setSearchQuery] = useState('')
	const [statusFilter, setStatusFilter] = useState<string>('all')
	const [panelFilter, setPanelFilter] = useState<string>('all')
	const [inverterFilter, setInverterFilter] = useState<string>('all')
	const [requestedPowerFilter, setRequestedPowerFilter] = useState('')
	const requestedPowerDebounceRef = useRef<number | null>(null)
	const [filters, setFilters] = useState<ContractsListParams>({
		page: 1,
		page_size: 20,
		search: '',
		ordering: '-updated_at',
	})
	const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
	const [editingContract, setEditingContract] = useState<Contract | null>(null)
	const [isFormOpen, setIsFormOpen] = useState(false)
	const [contractToDelete, setContractToDelete] = useState<Contract | null>(null)
	const [isDeleting, setIsDeleting] = useState(false)
	const [isRecalculating, setIsRecalculating] = useState(false)
	const [detailRefreshToken, setDetailRefreshToken] = useState(0)
	const [isPricingOpen, setIsPricingOpen] = useState(false)
	const [isDocumentFormOpen, setIsDocumentFormOpen] = useState(false)
	const [isPricingLoading, setIsPricingLoading] = useState(false)
	const [pricingMatrix, setPricingMatrix] = useState<PricingMatrixData | null>(
		null,
	)

	useEffect(() => {
		const state = location.state as { contractId?: string } | null
		const requestedContractId = state?.contractId
		if (!requestedContractId || typeof requestedContractId !== 'string') {
			return
		}

		setSelectedContractId(requestedContractId)
		navigate(location.pathname, { replace: true, state: null })
	}, [location.pathname, location.state, navigate])

	const fetcher = (params?: ContractsListParams) =>
		services.contracts.listContracts(params)
	const [state, actions] = useList<Contract, ContractsListParams>(fetcher, {
		params: filters,
		autoFetch: true,
	})

	const statusOptions = useMemo(
		() => [
			{ value: 'all', label: tx.allStatuses },
			...Object.entries(tx.statuses).map(([value, label]) => ({ value, label })),
		],
		[tx.allStatuses, tx.statuses],
	)

	const panelOptions = useMemo(
		() => [
			{ value: 'all', label: tx.allPanels },
			{ value: 'jinko_ja', label: 'Jinko / JA Solar' },
			{ value: 'longi_hi_mo_x10', label: 'Longi HI MO X10' },
		],
		[tx.allPanels],
	)

	const inverterOptions = useMemo(
		() => [
			{ value: 'all', label: tx.allInverters },
			{ value: 'deye', label: 'DEYE' },
			{ value: 'solax', label: 'SOLAX' },
		],
		[tx.allInverters],
	)

	const columns = useMemo<DataTableColumn<Contract>[]>(
		() => [
			{
				key: 'title',
				label: tx.columns.title,
				render: contract => (
					<div className='grid gap-0.5'>
						<span className={tablePrimaryTextClassName}>{contract.title}</span>
						<span className={tableSecondaryTextClassName}>
							{contract.client_name || '-'}
						</span>
						{contract.customer_phone ? (
							<span className={tableSecondaryTextClassName}>{contract.customer_phone}</span>
						) : null}
					</div>
				),
			},
			{
				key: 'total_amount',
				label: tx.columns.amount,
				render: contract => {
					const customerAmount = contract.customer_amount ?? null
					const totalAmount = contract.total_amount ?? null
					const resolved =
						Number(customerAmount) > 0 ? customerAmount : totalAmount

					return (
						<span className={tablePrimaryTextClassName}>
							{formatPricingAmount(
								resolved ?? undefined,
								locale,
								tx.pricing.currency,
							)}
						</span>
					)
				},
			},
			{
				key: 'status',
				label: tx.columns.status,
				render: contract => (
					<StatusBadge
						status={contract.status}
						label={
							tx.statuses[
								normalizeContractStatusForUi(contract.status) as keyof typeof tx.statuses
							] ?? contract.status
						}
						tone={statusTone(contract.status)}
					/>
				),
			},
			{
				key: 'updated_at',
				label: tx.columns.updated,
				render: contract => (
					<span className={tablePrimaryTextClassName}>
						{formatLocalizedDate(contract.updated_at, i18n.language, {
							locale,
							withYear: true,
							withTime: false,
							shortMonth: true,
							fallback: '-',
						})}
					</span>
				),
			},
			...(canManageContracts
				? [
						{
							key: 'actions',
							label: tx.columns.actions,
							align: 'right' as const,
							render: (contract: Contract) => (
								<div className='flex items-center justify-end gap-1.5'>
									<button
										type='button'
										className={actionButtonClassName}
										onClick={event => {
											event.stopPropagation()
											setEditingContract(contract)
											setIsFormOpen(true)
										}}
										aria-label={tx.edit}
									>
										<FiEdit2 className='h-3.5 w-3.5' />
									</button>
									<button
										type='button'
										className={actionButtonClassName}
										onClick={event => {
											event.stopPropagation()
											setContractToDelete(contract)
										}}
										aria-label={tx.delete}
									>
										<FiTrash2 className='h-3.5 w-3.5' />
									</button>
								</div>
							),
						},
					]
				: []),
		],
		[canManageContracts, isRu, tx],
	)

	function applyFilters(next: Partial<ContractsListParams>) {
		setFilters(current => ({ ...current, page: 1, ...next }))
		actions.setPage(1)
	}

	useEffect(() => {
		return () => {
			if (requestedPowerDebounceRef.current !== null) {
				window.clearTimeout(requestedPowerDebounceRef.current)
			}
		}
	}, [])

	async function handleConfirmDelete() {
		if (!contractToDelete) {
			return
		}
		setIsDeleting(true)
		try {
			await services.contracts.deleteContract(contractToDelete.id)
			setContractToDelete(null)
			if (selectedContractId === contractToDelete.id) {
				setSelectedContractId(null)
			}
			await actions.refresh()
		} finally {
			setIsDeleting(false)
		}
	}

	async function handleRecalculate(contract: Contract) {
		setIsRecalculating(true)
		try {
			await services.contracts.recalculate(contract.id, {
				client: contract.client,
				title: contract.title,
				status: contract.status,
				panel_type: contract.panel_type,
				inverter_type: contract.inverter_type,
				requested_power_kw: contract.requested_power_kw ?? null,
				audit_power_kw: contract.audit_power_kw ?? null,
				audit_conclusion_kw: contract.audit_conclusion_kw ?? null,
				eligible_subsidy_kw: contract.eligible_subsidy_kw ?? null,
				estimated_subsidy_amount: contract.estimated_subsidy_amount ?? null,
				subsidy_percent: contract.subsidy_percent ?? null,
				customer_phone: contract.customer_phone ?? '',
				installation_address: contract.installation_address ?? '',
				note: contract.note ?? '',
				delivery_status: contract.delivery_status ?? '',
				delivery_notes: contract.delivery_notes ?? '',
				details:
					typeof contract.details === 'string'
						? contract.details
						: JSON.stringify(contract.details ?? {}),
				items: (contract.items ?? []).map(item => ({
					product: item.product,
					quantity: item.quantity,
					unit_price: item.unit_price,
				})),
			})
			setDetailRefreshToken(current => current + 1)
			await actions.refresh()
		} finally {
			setIsRecalculating(false)
		}
	}

	async function openPricingMatrix() {
		setIsPricingOpen(true)
		setIsPricingLoading(true)
		try {
			const result = await services.contracts.getPricingMatrix()
			setPricingMatrix(result)
		} finally {
			setIsPricingLoading(false)
		}
	}

	if (state.error) {
		return (
			<PageLayout
				header={<PageHeader eyebrow={tx.eyebrow} title={tx.title} subtitle={tx.subtitle} />}
			>
				<EmptyState title={tx.errorTitle} description={tx.errorDescription} />
			</PageLayout>
		)
	}

	return (
		<>
			<PageLayout
				header={
					<PageHeader
						eyebrow={tx.eyebrow}
						title={tx.title}
						subtitle={tx.subtitle}
						actions={
							<div className='flex w-full flex-wrap items-center gap-2 min-[768px]:w-auto'>
								{canManageContracts ? (
									<>
										<button
											type='button'
											className='inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface-card px-3.5 text-sm font-semibold text-text-primary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25'
											onClick={() => {
												void openPricingMatrix()
											}}
										>
											<AppIcon name='activity' className='h-4 w-4' aria-hidden='true' />
											{tx.pricing.button}
										</button>
										<button
											type='button'
											className='inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface-card px-3.5 text-sm font-semibold text-text-primary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25'
											onClick={() => setIsDocumentFormOpen(true)}
										>
											<AppIcon name='file' className='h-4 w-4' aria-hidden='true' />
											{t('contractsPage.document.button')}
										</button>
										<button
											type='button'
											className='inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35'
											onClick={() => {
												setEditingContract(null)
												setIsFormOpen(true)
											}}
										>
											<AppIcon name='plus' className='h-4 w-4' aria-hidden='true' />
											{tx.newContract}
										</button>
									</>
								) : null}
								<span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-success-bg px-3 text-[12px] font-semibold text-success'>
									<AppIcon name='contracts' className='h-3.5 w-3.5' aria-hidden='true' />
									{state.items.length} {tx.visible}
								</span>
								{selectedContractId ? (
									<span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent'>
										<AppIcon name='contracts' className='h-3.5 w-3.5' aria-hidden='true' />
										{tx.detailOpen}
									</span>
								) : null}
							</div>
						}
					/>
				}
			>
				<PageSection>
					<div className='flex flex-col gap-4'>
						<FilterBar>
							<SearchInput
								value={searchQuery}
								onChange={value => {
									setSearchQuery(value)
									applyFilters({ search: value || undefined })
								}}
								placeholder={tx.searchPlaceholder}
							/>
							<label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_220px]'>
								<span className={labelClassName}>{tx.statusLabel}</span>
								<FilterSelect
									value={statusFilter}
									options={statusOptions}
									onChange={value => {
										setStatusFilter(value)
										applyFilters({ status: value === 'all' ? undefined : value })
									}}
									disabled={state.isLoading}
								/>
							</label>
							<label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_220px]'>
								<span className={labelClassName}>{tx.panelLabel}</span>
								<FilterSelect
									value={panelFilter}
									options={panelOptions}
									onChange={value => {
										setPanelFilter(value)
										applyFilters({
											panel_type:
												value === 'all'
													? undefined
													: (value as ContractsListParams['panel_type']),
										})
									}}
									disabled={state.isLoading}
								/>
							</label>
							<label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_220px]'>
								<span className={labelClassName}>{tx.inverterLabel}</span>
								<FilterSelect
									value={inverterFilter}
									options={inverterOptions}
									onChange={value => {
										setInverterFilter(value)
										applyFilters({
											inverter_type:
												value === 'all'
													? undefined
													: (value as ContractsListParams['inverter_type']),
										})
									}}
									disabled={state.isLoading}
								/>
							</label>
							<label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_180px]'>
								<span className={labelClassName}>{tx.powerLabel}</span>
								<input
									type='number'
									min={0}
									className='w-full rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 text-sm font-medium text-text-primary placeholder:text-text-muted outline-none transition duration-fast focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
									value={requestedPowerFilter}
									onChange={event => {
										const value = event.target.value
										setRequestedPowerFilter(value)

										if (requestedPowerDebounceRef.current !== null) {
											window.clearTimeout(requestedPowerDebounceRef.current)
										}

										requestedPowerDebounceRef.current = window.setTimeout(() => {
											requestedPowerDebounceRef.current = null
											const normalized = value.trim()
											const parsed =
												normalized === '' ? undefined : Number(normalized)

											applyFilters({
												requested_power_kw:
													parsed === undefined || Number.isFinite(parsed)
														? parsed
												: undefined,
											})
										}, 450)
									}}
									onKeyDown={event => {
										if (event.key !== 'Enter') {
											return
										}

										if (requestedPowerDebounceRef.current !== null) {
											window.clearTimeout(requestedPowerDebounceRef.current)
											requestedPowerDebounceRef.current = null
										}

										const normalized = event.currentTarget.value.trim()
										const parsed =
											normalized === '' ? undefined : Number(normalized)

										applyFilters({
											requested_power_kw:
												parsed === undefined || Number.isFinite(parsed)
													? parsed
													: undefined,
										})
									}}
									onBlur={() => {
										if (requestedPowerDebounceRef.current === null) {
											return
										}

										window.clearTimeout(requestedPowerDebounceRef.current)
										requestedPowerDebounceRef.current = null

										const normalized = requestedPowerFilter.trim()
										const parsed =
											normalized === '' ? undefined : Number(normalized)

										applyFilters({
											requested_power_kw:
												parsed === undefined || Number.isFinite(parsed)
													? parsed
													: undefined,
										})
									}}
								/>
							</label>
						</FilterBar>
						<div className='grid min-w-0 gap-3'>
							<div className='flex flex-wrap items-center justify-between gap-2 px-1'>
								<h2 className='m-0 text-[1rem] font-semibold text-text-primary'>
									{tx.listTitle}
								</h2>
								<span className='text-[12px] font-medium text-text-muted'>
									{tx.listHint}
								</span>
							</div>
							<DataTable
								data={state.items}
								columns={columns}
								rowKey='id'
								selectedRowKey={selectedContractId ?? null}
								loading={state.isLoading}
								onRowClick={contract => setSelectedContractId(contract.id)}
								emptyTitle={tx.errorTitle}
								emptyDescription={tx.errorDescription}
							/>
						</div>
						{state.total > 0 ? (
							<Pagination
								currentPage={filters.page ?? 1}
								totalPages={Math.max(
									1,
									Math.ceil(state.total / (filters.page_size ?? 20)),
								)}
								totalItems={state.total}
								onPageChange={page => {
									actions.setPage(page)
									setFilters(current => ({ ...current, page }))
								}}
							/>
						) : null}
					</div>
				</PageSection>
			</PageLayout>

			{selectedContractId ? (
				<div
					className='fixed inset-0 z-[140] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]'
					role='presentation'
					onClick={() => setSelectedContractId(null)}
				>
						<div
							className='h-full w-full max-w-[760px] overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:p-5'
							onClick={event => event.stopPropagation()}
						>
						<ContractsDetailPanel
							contractId={selectedContractId}
							refreshToken={detailRefreshToken}
							isRecalculating={isRecalculating}
							onClose={() => setSelectedContractId(null)}
							onEdit={contract => {
								setSelectedContractId(null)
								setEditingContract(contract)
								setIsFormOpen(true)
							}}
							onRecalculate={contract => {
								void handleRecalculate(contract)
							}}
							onRequestDelete={contract => {
								setSelectedContractId(null)
								setContractToDelete(contract)
							}}
						/>
					</div>
				</div>
			) : null}

			{isFormOpen ? (
				<div
					className='fixed inset-0 z-[150] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]'
					role='presentation'
					onClick={() => setIsFormOpen(false)}
				>
					<div
						className='h-full w-full max-w-[760px] overflow-x-hidden overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:p-5'
						onClick={event => event.stopPropagation()}
					>
						<ContractsFormPanel
							contract={editingContract ?? undefined}
							onClose={() => {
								setIsFormOpen(false)
								setEditingContract(null)
							}}
							onSuccess={async contract => {
								setIsFormOpen(false)
								setEditingContract(null)
								setSelectedContractId(contract.id)
								setDetailRefreshToken(current => current + 1)
								await actions.refresh()
							}}
						/>
					</div>
				</div>
			) : null}

			{isDocumentFormOpen ? (
				<ContractDocumentFormPanel
					onClose={() => setIsDocumentFormOpen(false)}
					onGenerated={() => {
						void actions.refresh()
					}}
				/>
			) : null}

			{contractToDelete ? (
				<ContractDeleteDialog
					contract={contractToDelete}
					isDeleting={isDeleting}
					onCancel={() => {
						if (!isDeleting) {
							setContractToDelete(null)
						}
					}}
					onConfirm={() => {
						void handleConfirmDelete()
					}}
				/>
			) : null}

			{isPricingOpen ? (
				<div
					className='fixed inset-0 z-[160] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]'
					role='presentation'
					onClick={() => setIsPricingOpen(false)}
				>
					<div
						className='h-full w-full max-w-[560px] overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:p-5'
						onClick={event => event.stopPropagation()}
					>
						<div className='grid gap-3'>
							<header className='rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40'>
								<div className='flex items-start justify-between gap-3'>
									<div>
										<p className='m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary'>
											{tx.pricing.button}
										</p>
										<h2 className='mt-1 font-display text-[1.35rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-text-primary'>
											{tx.pricing.title}
										</h2>
									</div>
									<button
										type='button'
										className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20'
										onClick={() => setIsPricingOpen(false)}
									>
										<AppIcon name='close' className='h-4.5 w-4.5' aria-hidden='true' />
									</button>
								</div>
							</header>

							{isPricingLoading ? (
								<EmptyState
									title={tx.pricing.loadingTitle}
									description={tx.pricing.loadingDescription}
								/>
							) : !pricingMatrix || pricingMatrix.panels.length === 0 ? (
								<EmptyState
									title={tx.pricing.emptyTitle}
									description={tx.pricing.emptyDescription}
								/>
							) : (
									<div className='grid gap-3'>
										<div className='grid gap-2 sm:grid-cols-2'>
											<div className='rounded-xl bg-gradient-to-br from-primary/12 to-primary/4 p-3 ring-1 ring-primary/20'>
												<p className='m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted'>
													{tx.pricing.subsidy}
												</p>
												<p className='mt-1 text-lg font-bold text-text-primary'>
													{pricingMatrix.subsidy_percent}%
												</p>
											</div>
											<div className='rounded-xl bg-surface-card p-3 ring-1 ring-border-soft/40'>
												<p className='m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted'>
													{tx.pricing.auditPowers}
												</p>
												<p className='mt-1 text-sm font-semibold text-text-primary'>
													{pricingMatrix.supported_audit_powers.join(' • ') || '-'}
												</p>
											</div>
										</div>

										<div className='grid gap-2'>
											{pricingMatrix.panels.map((panel, panelIndex) => (
												<details
													key={panel.panel_type}
													open={panelIndex === 0}
													className='group overflow-hidden rounded-xl bg-surface-card shadow-sm ring-1 ring-border-soft/40'
												>
													<summary className='flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 transition duration-fast hover:bg-surface-subtle/65'>
														<div className='min-w-0'>
															<p className='m-0 truncate text-sm font-semibold text-text-primary'>
																{panel.label || panel.panel_type}
															</p>
															<p className='m-0 mt-0.5 text-xs text-text-secondary'>
																{panel.rows.length} {tx.pricing.configurations}
															</p>
														</div>
														<div className='inline-flex items-center gap-1.5'>
															<span className='inline-flex h-7 min-w-7 items-center justify-center rounded-pill bg-surface-subtle px-2 text-[11px] font-semibold text-text-secondary'>
																{panel.rows.length}
															</span>
															<AppIcon
																name='chevron-down'
																className='h-4 w-4 text-text-muted transition duration-fast group-open:rotate-180'
																aria-hidden='true'
															/>
														</div>
													</summary>

													<div className='grid gap-2 border-t border-border-soft/40 p-3'>
														{panel.rows.map((row, rowIndex) => (
															<details
																key={`${panel.panel_type}-${row.power_kw}`}
																open={panelIndex === 0 && rowIndex === 0}
																className='group/row overflow-hidden rounded-lg bg-surface-subtle/55 ring-1 ring-border-soft/35'
															>
																<summary className='flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 transition duration-fast hover:bg-surface-subtle/80'>
																	<p className='m-0 text-sm font-semibold text-text-primary'>
																		{tx.pricing.power}: {row.power_kw} kW
																	</p>
																	<span className='inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted'>
																		{tx.pricing.view}
																		<AppIcon
																			name='chevron-down'
																			className='h-3.5 w-3.5 transition duration-fast group-open/row:rotate-180'
																			aria-hidden='true'
																		/>
																	</span>
																</summary>

																<div className='grid gap-2 border-t border-border-soft/35 p-3'>
																	<div className='grid gap-2 sm:grid-cols-2'>
																		<div className='rounded-md bg-surface-card p-2.5 ring-1 ring-border-soft/35'>
																			<p className='m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted'>
																				{tx.pricing.basePrice}
																			</p>
																			<p className='m-0 mt-1 text-sm font-semibold text-text-primary'>
																				DEYE: {formatPricingAmount(row.base_prices.deye, locale, tx.pricing.currency)}
																			</p>
																			<p className='m-0 mt-0.5 text-sm font-semibold text-text-primary'>
																				SOLAX: {formatPricingAmount(row.base_prices.solax, locale, tx.pricing.currency)}
																			</p>
																		</div>
																		<div className='rounded-md bg-surface-card p-2.5 ring-1 ring-border-soft/35'>
																			<p className='m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted'>
																				{tx.pricing.customerPrice}
																			</p>
																			<p className='m-0 mt-1 text-sm font-semibold text-text-primary'>
																				DEYE: {formatPricingAmount(row.default_customer_prices.deye, locale, tx.pricing.currency)}
																			</p>
																			<p className='m-0 mt-0.5 text-sm font-semibold text-text-primary'>
																				SOLAX: {formatPricingAmount(row.default_customer_prices.solax, locale, tx.pricing.currency)}
																			</p>
																		</div>
																	</div>

																	<div className='grid gap-1.5'>
																		{pricingMatrix.supported_audit_powers.map(power => {
																			const auditPrices = row.audit_customer_prices[String(power)]
																			if (!auditPrices) {
																				return null
																			}
																			return (
																				<div
																					key={`${panel.panel_type}-${row.power_kw}-${power}`}
																					className='rounded-md bg-surface-card px-2.5 py-1.5 text-xs text-text-secondary ring-1 ring-border-soft/35'
																				>
																					{tx.pricing.audit} {power} kW • DEYE:{' '}
																					{formatPricingAmount(auditPrices.deye, locale, tx.pricing.currency)} • SOLAX:{' '}
																					{formatPricingAmount(auditPrices.solax, locale, tx.pricing.currency)}
																				</div>
																			)
																		})}
																	</div>
																</div>
															</details>
														))}
													</div>
												</details>
											))}
										</div>
									</div>
							)}
						</div>
					</div>
				</div>
			) : null}
		</>
	)
}

export default ContractsPage

