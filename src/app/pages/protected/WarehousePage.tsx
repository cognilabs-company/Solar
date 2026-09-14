import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiEye } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../auth'
import {
	DataTable,
	FilterBar,
	Pagination,
	SearchInput,
	StatusBadge,
	type DataTableColumn,
} from '../../../components/shared/data'
import AppIcon from '../../../components/shared/icons/AppIcon'
import {
	EmptyState,
	LoadingState,
	PageCard,
	PageHeader,
	PageLayout,
	PageSection,
} from '../../../components/shared/page'
import WarehouseItemFormPanel from '../../../features/warehouse/components/WarehouseItemFormPanel'
import WarehouseSaleFormPanel from '../../../features/warehouse/components/WarehouseSaleFormPanel'
import WarehouseStatsGrid from '../../../features/warehouse/components/WarehouseStatsGrid'
import WarehouseStockEntryFormPanel from '../../../features/warehouse/components/WarehouseStockEntryFormPanel'
import {
	formatMoney,
	formatQuantity,
	toNumber,
} from '../../../features/warehouse/utils/warehouse-format'
import { formatLocalizedDate } from '../../../i18n/date-format'
import { usePersistentState } from '../../../lib/persistent-state'
import { services } from '../../../services'
import type {
	WarehouseItem,
	WarehouseListResult,
	WarehouseSale,
	WarehouseStats,
	WarehouseStockEntry,
} from '../../../types/warehouse'

type WarehouseTab = 'items' | 'stock-entries' | 'sales'

type OpenPanel =
	| { kind: 'item'; id: string | null }
	| { kind: 'stock-entry'; id: string | null }
	| { kind: 'sale'; id: string | null }

const PAGE_SIZE = 10
const ITEM_OPTIONS_FETCH_SIZE = 500
const SEARCH_DEBOUNCE_MS = 300
const SUCCESS_MESSAGE_MS = 4000

const WAREHOUSE_TABS: WarehouseTab[] = ['items', 'stock-entries', 'sales']

const tablePrimaryTextClassName =
	'block max-w-[160px] truncate text-sm font-semibold leading-[1.35] text-text-primary min-[640px]:max-w-[240px]'

const tableSecondaryTextClassName =
	'block max-w-[160px] truncate text-[12px] leading-[1.45] text-text-secondary min-[640px]:max-w-[240px]'

const actionButtonClassName =
	'inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-card text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20'

function isLowStock(item: WarehouseItem): boolean {
	if (item.is_low_stock !== null) {
		return item.is_low_stock
	}

	const quantity = toNumber(item.current_quantity)
	const threshold = toNumber(item.low_stock_threshold)
	return quantity !== null && threshold !== null && threshold > 0 && quantity <= threshold
}

/** Works with DRF pagination and with plain-array responses. */
function toPage<T>(result: WarehouseListResult<T>, page: number): WarehouseListResult<T> {
	if (result.items.length <= PAGE_SIZE) {
		return result
	}

	const start = (page - 1) * PAGE_SIZE
	return {
		items: result.items.slice(start, start + PAGE_SIZE),
		totalItems: result.totalItems,
	}
}

function WarehousePage() {
	const { t, i18n } = useTranslation()
	const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ'
	const { hasPermission } = useAuth()
	const canManage = hasPermission('can_manage_warehouse')

	const [activeTab, setActiveTab] = usePersistentState<WarehouseTab>(
		'warehouse:tab',
		'items',
		{
			deserialize: value => {
				const parsed = JSON.parse(value)
				return WAREHOUSE_TABS.includes(parsed) ? parsed : 'items'
			},
		},
	)
	const [search, setSearch] = useState('')
	const [debouncedSearch, setDebouncedSearch] = useState('')
	const [currentPage, setCurrentPage] = useState(1)
	const [reloadCursor, setReloadCursor] = useState(0)

	const [items, setItems] = useState<WarehouseItem[]>([])
	const [stockEntries, setStockEntries] = useState<WarehouseStockEntry[]>([])
	const [sales, setSales] = useState<WarehouseSale[]>([])
	const [totalItems, setTotalItems] = useState(0)
	const [isLoading, setIsLoading] = useState(true)
	const [hasError, setHasError] = useState(false)
	const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

	const [itemOptions, setItemOptions] = useState<WarehouseItem[]>([])
	const [stats, setStats] = useState<WarehouseStats | null>(null)
	const [isStatsLoading, setIsStatsLoading] = useState(true)
	const [hasStatsError, setHasStatsError] = useState(false)

	const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null)
	const [successMessage, setSuccessMessage] = useState<string | null>(null)

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			setDebouncedSearch(search.trim())
		}, SEARCH_DEBOUNCE_MS)

		return () => window.clearTimeout(timeoutId)
	}, [search])

	useEffect(() => {
		setCurrentPage(1)
	}, [activeTab, debouncedSearch])

	useEffect(() => {
		if (!successMessage) {
			return
		}

		const timeoutId = window.setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_MS)
		return () => window.clearTimeout(timeoutId)
	}, [successMessage])

	useEffect(() => {
		let isActive = true

		async function loadList() {
			setIsLoading(true)
			setHasError(false)

			const params = {
				page: currentPage,
				pageSize: PAGE_SIZE,
				search: debouncedSearch || undefined,
			}

			try {
				if (activeTab === 'items') {
					const result = toPage(await services.warehouse.listItems(params), currentPage)
					if (!isActive) {
						return
					}
					setItems(result.items)
					setTotalItems(result.totalItems)
				} else if (activeTab === 'stock-entries') {
					const result = toPage(
						await services.warehouse.listStockEntries(params),
						currentPage,
					)
					if (!isActive) {
						return
					}
					setStockEntries(result.items)
					setTotalItems(result.totalItems)
				} else {
					const result = toPage(await services.warehouse.listSales(params), currentPage)
					if (!isActive) {
						return
					}
					setSales(result.items)
					setTotalItems(result.totalItems)
				}
			} catch {
				if (isActive) {
					setHasError(true)
					setTotalItems(0)
				}
			} finally {
				if (isActive) {
					setIsLoading(false)
					setHasLoadedOnce(true)
				}
			}
		}

		void loadList()

		return () => {
			isActive = false
		}
	}, [activeTab, currentPage, debouncedSearch, reloadCursor])

	useEffect(() => {
		let isActive = true

		async function loadItemOptions() {
			try {
				const result = await services.warehouse.listItems({
					page: 1,
					pageSize: ITEM_OPTIONS_FETCH_SIZE,
				})
				if (isActive) {
					setItemOptions(result.items)
				}
			} catch {
				if (isActive) {
					setItemOptions([])
				}
			}
		}

		async function loadStats() {
			setIsStatsLoading(true)
			setHasStatsError(false)

			try {
				const result = await services.warehouse.getStats()
				if (isActive) {
					setStats(result)
				}
			} catch {
				if (isActive) {
					setHasStatsError(true)
				}
			} finally {
				if (isActive) {
					setIsStatsLoading(false)
				}
			}
		}

		void loadItemOptions()
		void loadStats()

		return () => {
			isActive = false
		}
	}, [reloadCursor])

	const itemNameById = useMemo(
		() => new Map(itemOptions.map(item => [item.id, item.name])),
		[itemOptions],
	)

	const categorySuggestions = useMemo(
		() =>
			Array.from(
				new Set(itemOptions.map(item => item.category.trim()).filter(Boolean)),
			).sort((left, right) => left.localeCompare(right, locale)),
		[itemOptions, locale],
	)

	const handleSaved = useCallback(() => {
		setOpenPanel(null)
		setSuccessMessage(t('warehouse.form.saved'))
		// Edits change stock and totals everywhere: items, entries, sales and stats.
		setReloadCursor(current => current + 1)
	}, [t])

	const formatDate = useCallback(
		(value?: string) =>
			formatLocalizedDate(value, locale, {
				locale,
				withYear: true,
				withTime: true,
				shortMonth: true,
				fallback: '-',
			}),
		[locale],
	)

	const renderRowAction = useCallback(
		(onOpen: () => void) => (
			<div className='flex justify-end gap-2'>
				<button
					type='button'
					className={actionButtonClassName}
					onClick={event => {
						event.stopPropagation()
						onOpen()
					}}
					aria-label={canManage ? t('warehouse.actions.edit') : t('warehouse.actions.view')}
				>
					{canManage ? <FiEdit2 className='h-4 w-4' /> : <FiEye className='h-4 w-4' />}
				</button>
			</div>
		),
		[canManage, t],
	)

	const itemColumns = useMemo<DataTableColumn<WarehouseItem>[]>(
		() => [
			{
				key: 'name',
				label: t('warehouse.fields.name'),
				render: item => (
					<div className='grid min-w-0 gap-0.5'>
						<div className='flex flex-wrap items-center gap-2'>
							<span className={tablePrimaryTextClassName}>{item.name}</span>
							{isLowStock(item) ? (
								<StatusBadge
									status='low-stock'
									tone='danger'
									label={t('warehouse.lowStock')}
								/>
							) : null}
						</div>
						<span className={tableSecondaryTextClassName}>
							{item.category || t('warehouse.noCategory')}
						</span>
					</div>
				),
			},
			{
				key: 'current_quantity',
				label: t('warehouse.fields.current_quantity'),
				render: item => (
					<span className={tablePrimaryTextClassName}>
						{formatQuantity(item.current_quantity, locale)} {item.unit}
					</span>
				),
			},
			{
				key: 'default_price',
				label: t('warehouse.fields.default_price'),
				render: item => (
					<span className={tablePrimaryTextClassName}>
						{formatMoney(item.default_price, item.default_currency, locale)}
					</span>
				),
			},
			{
				key: 'panel',
				label: t('warehouse.columns.panel'),
				render: item =>
					item.is_panel ? (
						<div className='grid gap-0.5'>
							<span className={tablePrimaryTextClassName}>
								{formatQuantity(item.panel_watt, locale)} W ×{' '}
								{formatQuantity(item.panel_count, locale)}
							</span>
							{toNumber(item.panel_total_watt) !== null ? (
								<span className={tableSecondaryTextClassName}>
									{formatQuantity(item.panel_total_watt, locale)} W ·{' '}
									{formatQuantity(item.panel_total_price, locale)}
								</span>
							) : null}
						</div>
					) : (
						<span className={tableSecondaryTextClassName}>-</span>
					),
			},
			{
				key: 'updated_at',
				label: t('warehouse.fields.updated_at'),
				render: item => (
					<span className={tablePrimaryTextClassName}>{formatDate(item.updated_at)}</span>
				),
			},
			{
				key: 'actions',
				label: t('warehouse.columns.actions'),
				align: 'right',
				render: item => renderRowAction(() => setOpenPanel({ kind: 'item', id: item.id })),
			},
		],
		[formatDate, locale, renderRowAction, t],
	)

	const stockEntryColumns = useMemo<DataTableColumn<WarehouseStockEntry>[]>(
		() => [
			{
				key: 'item',
				label: t('warehouse.fields.item'),
				render: entry => (
					<div className='grid min-w-0 gap-0.5'>
						<span className={tablePrimaryTextClassName}>
							{entry.item_name || itemNameById.get(entry.item) || '-'}
						</span>
						<span className={tableSecondaryTextClassName}>
							{entry.supplier_name || t('warehouse.noSupplier')}
						</span>
					</div>
				),
			},
			{
				key: 'quantity',
				label: t('warehouse.fields.quantity'),
				render: entry => (
					<span className={tablePrimaryTextClassName}>
						{formatQuantity(entry.quantity, locale)}
					</span>
				),
			},
			{
				key: 'unit_cost',
				label: t('warehouse.fields.unit_cost'),
				render: entry => (
					<span className={tablePrimaryTextClassName}>
						{formatMoney(entry.unit_cost, entry.currency, locale)}
					</span>
				),
			},
			{
				key: 'total_cost',
				label: t('warehouse.fields.total_cost'),
				render: entry => (
					<span className={tablePrimaryTextClassName}>
						{formatMoney(entry.total_cost, entry.currency, locale)}
					</span>
				),
			},
			{
				key: 'received_at',
				label: t('warehouse.fields.received_at'),
				render: entry => (
					<span className={tablePrimaryTextClassName}>{formatDate(entry.received_at)}</span>
				),
			},
			{
				key: 'actions',
				label: t('warehouse.columns.actions'),
				align: 'right',
				render: entry =>
					renderRowAction(() => setOpenPanel({ kind: 'stock-entry', id: entry.id })),
			},
		],
		[formatDate, itemNameById, locale, renderRowAction, t],
	)

	const saleColumns = useMemo<DataTableColumn<WarehouseSale>[]>(
		() => [
			{
				key: 'item',
				label: t('warehouse.fields.item'),
				render: sale => (
					<div className='grid min-w-0 gap-0.5'>
						<span className={tablePrimaryTextClassName}>
							{sale.item_name || itemNameById.get(sale.item) || '-'}
						</span>
						<span className={tableSecondaryTextClassName}>
							{formatQuantity(sale.quantity, locale)} ×{' '}
							{formatMoney(sale.unit_price, sale.currency, locale)}
						</span>
					</div>
				),
			},
			{
				key: 'client',
				label: t('warehouse.fields.client'),
				render: sale => (
					<div className='grid min-w-0 gap-0.5'>
						<span className={tablePrimaryTextClassName}>{sale.client_name || '-'}</span>
						<span className={tableSecondaryTextClassName}>{sale.client_phone || '-'}</span>
					</div>
				),
			},
			{
				key: 'total_amount',
				label: t('warehouse.fields.total_amount'),
				render: sale => (
					<span className={tablePrimaryTextClassName}>
						{formatMoney(sale.total_amount, sale.currency, locale)}
					</span>
				),
			},
			{
				key: 'paid_amount',
				label: t('warehouse.fields.paid_amount'),
				render: sale => (
					<div className='grid min-w-0 gap-0.5'>
						<span className={tablePrimaryTextClassName}>
							{formatMoney(sale.paid_amount, sale.currency, locale)}
						</span>
						<span className={tableSecondaryTextClassName}>
							{sale.payment_type
								? t(`warehouse.paymentTypes.${sale.payment_type}`, {
										defaultValue: sale.payment_type,
									})
								: '-'}
						</span>
					</div>
				),
			},
			{
				key: 'sold_at',
				label: t('warehouse.fields.sold_at'),
				render: sale => (
					<span className={tablePrimaryTextClassName}>{formatDate(sale.sold_at)}</span>
				),
			},
			{
				key: 'actions',
				label: t('warehouse.columns.actions'),
				align: 'right',
				render: sale => renderRowAction(() => setOpenPanel({ kind: 'sale', id: sale.id })),
			},
		],
		[formatDate, itemNameById, locale, renderRowAction, t],
	)

	function openCreatePanel() {
		if (activeTab === 'items') {
			setOpenPanel({ kind: 'item', id: null })
		} else if (activeTab === 'stock-entries') {
			setOpenPanel({ kind: 'stock-entry', id: null })
		} else {
			setOpenPanel({ kind: 'sale', id: null })
		}
	}

	const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))

	const tabLabels: Record<WarehouseTab, string> = {
		items: t('warehouse.tabs.items'),
		'stock-entries': t('warehouse.tabs.stockEntries'),
		sales: t('warehouse.tabs.sales'),
	}

	const createLabels: Record<WarehouseTab, string> = {
		items: t('warehouse.actions.newItem'),
		'stock-entries': t('warehouse.actions.newStockEntry'),
		sales: t('warehouse.actions.newSale'),
	}

	const header = (
		<PageHeader
			eyebrow={t('warehouse.eyebrow')}
			title={t('warehouse.title')}
			subtitle={t('warehouse.subtitle')}
			actions={
				<div className='flex w-full flex-wrap items-center gap-2 min-[768px]:w-auto'>
					{canManage ? (
						<button
							type='button'
							className='inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35'
							onClick={openCreatePanel}
						>
							<AppIcon name='plus' className='h-4 w-4' aria-hidden='true' />
							{createLabels[activeTab]}
						</button>
					) : null}
					<span className='inline-flex min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent'>
						<AppIcon name='warehouse' className='h-3.5 w-3.5' aria-hidden='true' />
						{totalItems} {t('warehouse.records')}
					</span>
				</div>
			}
		/>
	)

	if (!hasLoadedOnce && isLoading) {
		return (
			<PageLayout header={header}>
				<PageSection>
					<PageCard>
						<LoadingState
							title={t('warehouse.loadingTitle')}
							description={t('warehouse.loadingDescription')}
						/>
					</PageCard>
				</PageSection>
			</PageLayout>
		)
	}

	return (
		<PageLayout header={header}>
			<PageSection>
				<WarehouseStatsGrid
					stats={stats}
					isLoading={isStatsLoading}
					hasError={hasStatsError}
				/>
			</PageSection>

			<PageSection>
				{successMessage ? (
					<p className='m-0 rounded-lg bg-success-bg px-3 py-2 text-sm font-semibold text-success'>
						{successMessage}
					</p>
				) : null}

				{!canManage ? (
					<p className='m-0 rounded-lg bg-surface-subtle px-3 py-2 text-[12px] font-medium text-text-secondary'>
						{t('warehouse.readOnlyHint')}
					</p>
				) : null}

				<FilterBar>
					<SearchInput
						value={search}
						onChange={setSearch}
						placeholder={t('warehouse.searchPlaceholder')}
					/>
				</FilterBar>

				<PageCard>
					<div className='mb-3 min-w-0 max-w-full overflow-x-auto'>
						<div className='inline-flex min-w-max flex-nowrap items-center gap-1 rounded-pill bg-surface-subtle/85 p-1 ring-1 ring-border-soft/50'>
							{WAREHOUSE_TABS.map(tab => (
								<button
									key={tab}
									type='button'
									onClick={() => setActiveTab(tab)}
									className={[
										'shrink-0 whitespace-nowrap rounded-pill px-4 py-2 text-sm font-semibold transition duration-fast',
										activeTab === tab
											? 'bg-background-subtle text-text-primary shadow-sm ring-1 ring-border-soft/55'
											: 'text-text-secondary hover:bg-background-subtle/65 hover:text-text-primary',
									].join(' ')}
								>
									{tabLabels[tab]}
								</button>
							))}
						</div>
					</div>

					{hasError ? (
						<EmptyState
							title={t('warehouse.errorTitle')}
							description={t('warehouse.errorDescription')}
						/>
					) : activeTab === 'items' ? (
						<DataTable
							data={items}
							columns={itemColumns}
							rowKey='id'
							loading={isLoading}
							getRowClassName={item =>
								isLowStock(item)
									? 'bg-danger-bg/55 shadow-[inset_0_0_0_1px_rgb(var(--color-danger)/0.16)] hover:bg-danger-bg/70'
									: ''
							}
							onRowClick={item => setOpenPanel({ kind: 'item', id: item.id })}
							emptyTitle={t('warehouse.empty.itemsTitle')}
							emptyDescription={t('warehouse.empty.itemsDescription')}
						/>
					) : activeTab === 'stock-entries' ? (
						<DataTable
							data={stockEntries}
							columns={stockEntryColumns}
							rowKey='id'
							loading={isLoading}
							onRowClick={entry => setOpenPanel({ kind: 'stock-entry', id: entry.id })}
							emptyTitle={t('warehouse.empty.stockEntriesTitle')}
							emptyDescription={t('warehouse.empty.stockEntriesDescription')}
						/>
					) : (
						<DataTable
							data={sales}
							columns={saleColumns}
							rowKey='id'
							loading={isLoading}
							onRowClick={sale => setOpenPanel({ kind: 'sale', id: sale.id })}
							emptyTitle={t('warehouse.empty.salesTitle')}
							emptyDescription={t('warehouse.empty.salesDescription')}
						/>
					)}
				</PageCard>

				{!isLoading && !hasError && totalItems > 0 ? (
					<Pagination
						currentPage={Math.min(currentPage, totalPages)}
						totalPages={totalPages}
						totalItems={totalItems}
						onPageChange={setCurrentPage}
					/>
				) : null}
			</PageSection>

			{openPanel?.kind === 'item' ? (
				<WarehouseItemFormPanel
					key={openPanel.id ?? 'new'}
					itemId={openPanel.id}
					canManage={canManage}
					categorySuggestions={categorySuggestions}
					onClose={() => setOpenPanel(null)}
					onSaved={handleSaved}
				/>
			) : null}

			{openPanel?.kind === 'stock-entry' ? (
				<WarehouseStockEntryFormPanel
					key={openPanel.id ?? 'new'}
					entryId={openPanel.id}
					canManage={canManage}
					items={itemOptions}
					onClose={() => setOpenPanel(null)}
					onSaved={handleSaved}
				/>
			) : null}

			{openPanel?.kind === 'sale' ? (
				<WarehouseSaleFormPanel
					key={openPanel.id ?? 'new'}
					saleId={openPanel.id}
					canManage={canManage}
					items={itemOptions}
					onClose={() => setOpenPanel(null)}
					onSaved={handleSaved}
				/>
			) : null}
		</PageLayout>
	)
}

export default WarehousePage
