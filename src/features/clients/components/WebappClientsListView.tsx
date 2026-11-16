import { useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiTrash2 } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import {
	DataTable,
	EntityCell,
	FilterBar,
	FilterSelect,
	Pagination,
	SearchInput,
	StatusBadge,
	type DataTableColumn,
} from '../../../components/shared/data'
import { services } from '../../../services'
import type { Client } from '../../../services/contracts'
import { isWebappClient } from '../webappFilter'
import { getContractStatusLabel, getDeliveryStatusLabel } from '../../contracts/statusLabels'

export interface WebappClientsListViewProps {
	onRowClick?: (client: Client) => void
	onEditClient?: (client: Client) => void
	onDeleteClient?: (client: Client) => void
	selectedClientId?: string | null
	canManageClients?: boolean
	onStatsChange?: (stats: { visible: number; total: number; loading: boolean }) => void
}

type SelectOption = { value: string; label: string }

const PAGE_SIZE = 20
// Upper bound on how many pages we walk when collecting every client for the
// client-side webapp filter. 20 * 100 = 2000 clients, well above current scale.
const FETCH_PAGE_SIZE = 100
const MAX_FETCH_PAGES = 20

const labelClassName =
	'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'

const tablePrimaryTextClassName =
	'block max-w-[140px] truncate text-sm font-semibold leading-[1.35] text-text-primary min-[640px]:max-w-[220px]'

const tableSecondaryTextClassName =
	'block max-w-[140px] truncate text-[12px] leading-[1.45] text-text-secondary min-[640px]:max-w-[220px]'

const actionButtonClassName =
	'table-action'

function statusTone(status?: string): 'info' | 'warning' | 'accent' | 'success' | 'danger' {
	switch (status) {
		case 'new':
			return 'info'
		case 'contacted':
		case 'need_follow_up':
		case 'proposal_preparing':
		case 'proposal_sent':
		case 'negotiation':
		case 'waiting_for_decision':
		case 'postponed':
			return 'warning'
		case 'qualified':
			return 'accent'
		case 'won':
			return 'success'
		case 'lost':
			return 'danger'
		default:
			return 'info'
	}
}

/**
 * Extracts the product names a WebApp client showed interest in. Product names
 * are only available inside the `notes` field (lines that start with the
 * "WebApp ... mahsulotlar:" marker); the checkout metadata carries ids only.
 */
function extractWebappInterests(client: Client): { names: string[]; count: number } {
	const names: string[] = []
	const notes = typeof client.notes === 'string' ? client.notes : ''

	for (const rawLine of notes.split('\n')) {
		const line = rawLine.trim()
		const separatorIndex = line.indexOf(':')
		if (separatorIndex === -1) {
			continue
		}

		const marker = line.slice(0, separatorIndex).toLowerCase()
		if (!marker.includes('webapp') || !marker.includes('mahsulot')) {
			continue
		}

		const value = line.slice(separatorIndex + 1).trim()
		if (value) {
			names.push(value)
		}
	}

	const checkout = (client.metadata as Record<string, unknown> | undefined)?.webapp_checkout_items
	const checkoutCount = Array.isArray(checkout) ? checkout.length : 0

	return { names, count: names.length || checkoutCount }
}

function timeValue(value?: string | null): number {
	if (!value) {
		return 0
	}
	const parsed = new Date(value).getTime()
	return Number.isNaN(parsed) ? 0 : parsed
}

function sortClients(clients: Client[], ordering: string): Client[] {
	const direction = ordering.startsWith('-') ? -1 : 1
	const field = (ordering.startsWith('-') ? ordering.slice(1) : ordering) as
		| 'updated_at'
		| 'created_at'

	return [...clients].sort((left, right) => {
		const leftValue = timeValue(left[field])
		const rightValue = timeValue(right[field])
		return (leftValue - rightValue) * direction
	})
}

export function WebappClientsListView({
	onRowClick,
	onEditClient,
	onDeleteClient,
	selectedClientId,
	canManageClients = false,
	onStatsChange,
}: WebappClientsListViewProps) {
	const { i18n } = useTranslation()
	const isRu = i18n.language === 'ru'

	const tx = isRu
		? {
				searchPlaceholder: 'Поиск по имени, телефону, региону или заметкам...',
				allStatuses: 'Все статусы',
				updatedNewest: 'Обновлено (сначала новые)',
				updatedOldest: 'Обновлено (сначала старые)',
				createdNewest: 'Создано (сначала новые)',
				createdOldest: 'Создано (сначала старые)',
				statusLabel: 'Статус',
				orderLabel: 'Сортировка',
				listTitle: 'Очередь WebApp',
				listHint: 'Клиенты, пришедшие через Telegram WebApp.',
				columns: {
					name: 'Клиент',
					phone: 'Телефон',
					region: 'Регион',
					orders: 'Заказы',
					status: 'Статус',
					actions: 'Действия',
				},
				statuses: {
					new: 'Новый',
					contacted: 'Связались',
					qualified: 'Квалифицирован',
					need_follow_up: 'Нужен фоллоу-ап',
					proposal_preparing: 'Подготовка предложения',
					proposal_sent: 'Предложение отправлено',
					negotiation: 'Переговоры',
					waiting_for_decision: 'Ожидает оплату',
					won: 'Выигран',
					lost: 'Потерян',
					postponed: 'Отложен',
				},
				empty: 'WebApp клиенты не найдены',
				emptyHint: 'Измените параметры поиска или фильтры.',
				loadError: 'Не удалось загрузить WebApp клиентов.',
				items: 'товаров',
				ordersWord: 'заказ.',
				noOrders: 'Нет заказов',
				edit: 'Редактировать',
				delete: 'Удалить',
			}
		: {
				searchPlaceholder: 'Ism, telefon, hudud yoki izoh bo\'yicha qidiring...',
				allStatuses: 'Barcha holatlar',
				updatedNewest: 'Yangilangan (yangi)',
				updatedOldest: 'Yangilangan (eski)',
				createdNewest: 'Yaratilgan (yangi)',
				createdOldest: 'Yaratilgan (eski)',
				statusLabel: 'Holat',
				orderLabel: 'Saralash',
				listTitle: 'WebApp navbati',
				listHint: 'Telegram WebApp orqali kelgan mijozlar.',
				columns: {
					name: 'Mijoz',
					phone: 'Telefon',
					region: 'Hudud',
					orders: 'Buyurtmalar',
					status: 'Holat',
					actions: 'Amallar',
				},
				statuses: {
					new: 'Yangi',
					contacted: "Bog'lanildi",
					qualified: 'Saralangan',
					need_follow_up: 'Qayta aloqa kerak',
					proposal_preparing: 'Taklif tayyorlanmoqda',
					proposal_sent: 'Taklif yuborildi',
					negotiation: 'Muzokara',
					waiting_for_decision: "To'lov kutilmoqda",
					won: 'Yutildi',
					lost: "Yo'qotildi",
					postponed: 'Kechiktirildi',
				},
				empty: 'WebApp mijozlari topilmadi',
				emptyHint: 'Qidiruv yoki filtrlarni o\'zgartiring.',
				loadError: 'WebApp mijozlarini yuklab bo\'lmadi.',
				items: 'mahsulot',
				ordersWord: 'buyurtma',
				noOrders: 'Buyurtma yo\'q',
				edit: 'Tahrirlash',
				delete: 'O\'chirish',
			}

	const [allClients, setAllClients] = useState<Client[]>([])
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
	const [searchQuery, setSearchQuery] = useState('')
	const [statusFilter, setStatusFilter] = useState<string>('all')
	const [ordering, setOrdering] = useState<string>('-updated_at')
	const [page, setPage] = useState(1)

	useEffect(() => {
		let isActive = true

		async function loadAllWebappClients() {
			setStatus('loading')

			try {
				const collected: Client[] = []

				for (let pageIndex = 1; pageIndex <= MAX_FETCH_PAGES; pageIndex += 1) {
					const response = await services.clients.listClients({
						page: pageIndex,
						page_size: FETCH_PAGE_SIZE,
						ordering: '-updated_at',
					})

					collected.push(...response.items)

					const reachedTotal = collected.length >= (response.total || collected.length)
					if (!response.next || response.items.length < FETCH_PAGE_SIZE || reachedTotal) {
						break
					}
				}

				if (!isActive) {
					return
				}

				setAllClients(collected.filter(isWebappClient))
				setStatus('ready')
			} catch {
				if (!isActive) {
					return
				}
				setStatus('error')
			}
		}

		void loadAllWebappClients()

		return () => {
			isActive = false
		}
	}, [])

	const statusOptions = useMemo<SelectOption[]>(
		() => [
			{ value: 'all', label: tx.allStatuses },
			{ value: 'new', label: tx.statuses.new },
			{ value: 'contacted', label: tx.statuses.contacted },
			{ value: 'qualified', label: tx.statuses.qualified },
			{ value: 'need_follow_up', label: tx.statuses.need_follow_up },
			{ value: 'proposal_preparing', label: tx.statuses.proposal_preparing },
			{ value: 'proposal_sent', label: tx.statuses.proposal_sent },
			{ value: 'negotiation', label: tx.statuses.negotiation },
			{ value: 'waiting_for_decision', label: tx.statuses.waiting_for_decision },
			{ value: 'won', label: tx.statuses.won },
			{ value: 'lost', label: tx.statuses.lost },
			{ value: 'postponed', label: tx.statuses.postponed },
		],
		[tx],
	)

	const orderingOptions = useMemo<SelectOption[]>(
		() => [
			{ value: '-updated_at', label: tx.updatedNewest },
			{ value: 'updated_at', label: tx.updatedOldest },
			{ value: '-created_at', label: tx.createdNewest },
			{ value: 'created_at', label: tx.createdOldest },
		],
		[tx],
	)

	const filteredClients = useMemo(() => {
		let rows = allClients

		if (statusFilter !== 'all') {
			rows = rows.filter(client => (client.status || 'new') === statusFilter)
		}

		const query = searchQuery.trim().toLowerCase()
		if (query) {
			rows = rows.filter(client =>
				[client.full_name, client.phone, client.region, client.address, client.notes].some(
					value => String(value ?? '').toLowerCase().includes(query),
				),
			)
		}

		return sortClients(rows, ordering)
	}, [allClients, statusFilter, searchQuery, ordering])

	const totalFiltered = filteredClients.length
	const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
	const currentPage = Math.min(page, totalPages)
	const pageRows = useMemo(
		() => filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
		[filteredClients, currentPage],
	)

	useEffect(() => {
		onStatsChange?.({
			visible: pageRows.length,
			total: totalFiltered,
			loading: status === 'loading',
		})
	}, [onStatsChange, pageRows.length, totalFiltered, status])

	const columns = useMemo<DataTableColumn<Client>[]>(
		() => [
			{
				key: 'full_name',
				label: tx.columns.name,
				render: client => (
					<EntityCell
						name={client.full_name || '-'}
						seed={client.id}
						subtitle={client.ai_summary || '-'}
					/>
				),
			},
			{
				key: 'phone',
				label: tx.columns.phone,
				render: client => <span className={tablePrimaryTextClassName}>{client.phone || '-'}</span>,
			},
			{
				key: 'region',
				label: tx.columns.region,
				render: client => <span className={tablePrimaryTextClassName}>{client.region || '-'}</span>,
			},
			{
				key: 'orders',
				label: tx.columns.orders,
				render: client => {
					const orders = client.recent_contracts ?? []

					if (orders.length > 0) {
						const latest = orders[0]
						const latestStatus = [
							latest.status ? getContractStatusLabel(latest.status, isRu) : null,
							latest.delivery_status
								? latest.delivery_status_label || getDeliveryStatusLabel(latest.delivery_status, isRu)
								: null,
						]
							.filter(Boolean)
							.join(' · ')

						return (
							<div className='grid gap-0.5'>
								<span className={tablePrimaryTextClassName}>
									{orders.length} {tx.ordersWord}
								</span>
								<span className={tableSecondaryTextClassName}>{latestStatus || '-'}</span>
							</div>
						)
					}

					// No order yet — fall back to the products the client showed
					// interest in during WebApp checkout.
					const { names, count } = extractWebappInterests(client)
					if (!count) {
						return <span className={tablePrimaryTextClassName}>{tx.noOrders}</span>
					}

					return (
						<div className='grid gap-0.5'>
							<span className={tablePrimaryTextClassName}>{names[0] || `${count} ${tx.items}`}</span>
							<span className={tableSecondaryTextClassName}>
								{count} {tx.items}
							</span>
						</div>
					)
				},
			},
			{
				key: 'status',
				label: tx.columns.status,
				render: client => {
					const statusKey = (client.status || 'new') as keyof typeof tx.statuses
					const localizedLabel = tx.statuses[statusKey]
					return (
						<StatusBadge
							status={client.status || 'new'}
							label={localizedLabel || client.status_label || client.status || 'new'}
							tone={statusTone(client.status)}
						/>
					)
				},
			},
			...(canManageClients
				? [
						{
							key: 'actions',
							label: tx.columns.actions,
							align: 'right' as const,
							render: (client: Client) => (
								<div className='flex items-center justify-end gap-1.5'>
									<button
										type='button'
										className={actionButtonClassName}
										onClick={event => {
											event.stopPropagation()
											onEditClient?.(client)
										}}
										aria-label={tx.edit}
									>
										<FiEdit2 className='h-3.5 w-3.5' />
									</button>
									<button
										type='button'
										className={`${actionButtonClassName} table-action--danger`}
										onClick={event => {
											event.stopPropagation()
											onDeleteClient?.(client)
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
		[canManageClients, isRu, onDeleteClient, onEditClient, tx],
	)

	const handleSearch = (value: string) => {
		setSearchQuery(value)
		setPage(1)
	}

	const applyStatusFilter = (value: string) => {
		setStatusFilter(value)
		setPage(1)
	}

	const applyOrdering = (value: string) => {
		setOrdering(value)
		setPage(1)
	}

	return (
		<div className='flex flex-col gap-4'>
			<FilterBar>
				<SearchInput
					value={searchQuery}
					onChange={handleSearch}
					placeholder={tx.searchPlaceholder}
				/>

				<label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_200px]'>
					<span className={labelClassName}>{tx.statusLabel}</span>
					<FilterSelect
						value={statusFilter}
						options={statusOptions}
						onChange={applyStatusFilter}
						disabled={status === 'loading'}
					/>
				</label>

				<label className='grid min-w-[min(180px,100%)] flex-[1_1_180px] gap-1.5 min-[640px]:flex-[0_1_240px]'>
					<span className={labelClassName}>{tx.orderLabel}</span>
					<FilterSelect
						value={ordering}
						options={orderingOptions}
						onChange={applyOrdering}
						disabled={status === 'loading'}
					/>
				</label>
			</FilterBar>

			<div className='grid min-w-0 gap-3'>
				<div className='flex flex-wrap items-center justify-between gap-2 px-1'>
					<div className='flex items-center gap-2'>
						<h2 className='m-0 text-[1rem] font-semibold text-text-primary'>{tx.listTitle}</h2>
						<span className='text-[12px] font-medium text-text-muted'>{tx.listHint}</span>
					</div>
				</div>

				<div className='min-w-0 [&_.data-table__row--clickable:hover_.status-badge]:-translate-y-px'>
					<DataTable
						data={pageRows}
						columns={columns}
						rowKey='id'
						selectedRowKey={selectedClientId ?? null}
						loading={status === 'loading'}
						onRowClick={onRowClick}
						emptyTitle={status === 'error' ? tx.loadError : tx.empty}
						emptyDescription={status === 'error' ? tx.loadError : tx.emptyHint}
					/>
				</div>
			</div>

			{totalFiltered > 0 ? (
				<Pagination
					currentPage={currentPage}
					totalPages={totalPages}
					totalItems={totalFiltered}
					onPageChange={setPage}
				/>
			) : null}
		</div>
	)
}
