import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ru, uz } from 'date-fns/locale'
import { type DateRange } from 'react-day-picker'
import {
	AnimatedNumber,
	DataTable,
	Sparkline,
	type DataTableColumn,
} from '../../../components/shared/data'
import AppIcon, { type AppIconName } from '../../../components/shared/icons/AppIcon'
import { PageLayout } from '../../../components/shared/page'
import { useAuth } from '../../../auth'
import { routePaths, type AppRouteId } from '../../../config/routes'
import { Calendar } from '../../../components/ui/calendar'
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from '../../../components/ui/chart'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '../../../components/ui/popover'
import { getChannelLabel, getOrderStatusLabel } from '../../../i18n/labels'
import {
	formatLocalizedDate,
	formatUzMonthYear,
} from '../../../i18n/date-format'
import { formatCurrencyAmount } from '../../../constants'
import { services } from '../../../services'
import type {
	DashboardBreakdownItem,
	DashboardInterval,
	DashboardOverview,
	DashboardOverviewParams,
	DashboardRegionDemandItem,
	DashboardTopProduct,
} from '../../../services'
import {
	Area,
	AreaChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from 'recharts'

interface PieSlice extends DashboardBreakdownItem {
	color: string
	share: number
}

const SOURCE_COLORS: Record<string, string> = {
	telegram: '#2AABEE',
	instagram: '#E1306C',
	manual: '#F5A524',
}

/**
 * Green NRG chart palette: energy greens and sun ambers first, with sky,
 * teal and violet as neutral contrast hues. Red is reserved for "canceled".
 */
const BRAND_CHART = {
	green: '#16853E',
	leaf: '#5BBF62',
	sun: '#F5A524',
	amber: '#E07A10',
	sky: '#2E8BD8',
	teal: '#14A3A1',
	violet: '#7C5CD6',
	red: '#E5484D',
} as const

const SOURCE_COLORS_FALLBACK = [
	BRAND_CHART.teal,
	BRAND_CHART.violet,
	BRAND_CHART.leaf,
	BRAND_CHART.sun,
]

const CONTRACT_STATUS_COLORS: Record<string, string> = {
	draft: BRAND_CHART.sky,
	audit_pending: BRAND_CHART.sun,
	audit_paid: BRAND_CHART.leaf,
	moderation: BRAND_CHART.violet,
	contract_ready: BRAND_CHART.teal,
	payment_pending: BRAND_CHART.amber,
	paid: BRAND_CHART.green,
	in_lot: BRAND_CHART.sky,
	on_the_way: BRAND_CHART.teal,
	completed: BRAND_CHART.green,
	canceled: BRAND_CHART.red,
}
const STATUS_COLORS_FALLBACK = [
	BRAND_CHART.green,
	BRAND_CHART.sun,
	BRAND_CHART.sky,
	BRAND_CHART.violet,
	BRAND_CHART.teal,
	BRAND_CHART.amber,
]

const dashCardClassName =
	'app-rise relative min-w-0 overflow-hidden rounded-xl bg-surface-card p-5 shadow-md ring-1 ring-border-soft/50 transition duration-base hover:shadow-lg hover:ring-primary/20 max-[640px]:p-4'

type MetricTone = 'green' | 'sun' | 'sky' | 'violet' | 'teal'

const METRIC_TONES: Record<MetricTone, { color: string; chip: string }> = {
	green: { color: BRAND_CHART.green, chip: 'bg-primary/12 text-text-accent' },
	sun: { color: BRAND_CHART.sun, chip: 'bg-sun/15 text-sun-strong' },
	sky: { color: BRAND_CHART.sky, chip: 'bg-[#2E8BD8]/12 text-[#2E8BD8]' },
	violet: { color: BRAND_CHART.violet, chip: 'bg-[#7C5CD6]/12 text-[#7C5CD6]' },
	teal: { color: BRAND_CHART.teal, chip: 'bg-[#14A3A1]/12 text-[#14A3A1]' },
}

interface MetricCardData {
	key: string
	label: string
	icon: AppIconName
	tone: MetricTone
	value: number
	format: (value: number) => string
	series?: number[]
	hint?: string
	routeId: AppRouteId
}

function DashSectionHeading({
	icon,
	title,
	description,
	aside,
}: {
	icon: AppIconName
	title: string
	description?: string
	aside?: ReactNode
}) {
	return (
		<div className='flex flex-wrap items-start justify-between gap-3'>
			<div className='flex min-w-0 items-start gap-3'>
				<span
					aria-hidden='true'
					className='mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-sun/15 text-text-accent ring-1 ring-primary/15'
				>
					<AppIcon name={icon} className='h-4 w-4' />
				</span>
				<div className='min-w-0'>
					<h2 className='m-0 font-display text-[1.12rem] font-extrabold tracking-[-0.01em] text-text-primary'>
						{title}
					</h2>
					{description ? (
						<p className='mt-0.5 text-sm text-text-secondary'>{description}</p>
					) : null}
				</div>
			</div>
			{aside}
		</div>
	)
}

function DashboardSkeleton() {
	return (
		<PageLayout>
			<section className='grid gap-4 min-[768px]:gap-5' aria-busy='true'>
				<div className='app-skeleton h-[188px] rounded-2xl' />
				<div className='grid grid-cols-2 gap-3 xl:grid-cols-5'>
					{Array.from({ length: 5 }, (_, index) => (
						<div
							key={index}
							className='rounded-xl bg-surface-card p-5 shadow-md ring-1 ring-border-soft/50'
						>
							<div className='app-skeleton h-9 w-9 rounded-lg' />
							<div className='app-skeleton mt-4 h-3 w-24 rounded-full' />
							<div className='app-skeleton mt-3 h-7 w-20 rounded-lg' />
						</div>
					))}
				</div>
				<div className='rounded-xl bg-surface-card p-5 shadow-md ring-1 ring-border-soft/50'>
					<div className='app-skeleton h-4 w-40 rounded-full' />
					<div className='app-skeleton mt-5 h-[250px] rounded-xl' />
				</div>
			</section>
		</PageLayout>
	)
}

const tablePrimaryTextClassName =
	'block max-w-[180px] truncate text-sm font-semibold leading-[1.35] text-text-primary min-[640px]:max-w-[320px]'

const tableSecondaryTextClassName =
	'block max-w-[180px] truncate text-[12px] leading-[1.45] text-text-secondary min-[640px]:max-w-[320px]'

interface DashboardFilters {
	interval: DashboardInterval
	customDateFrom?: string
	customDateTo?: string
}

interface DashboardIntervalDropdownProps {
	value: DashboardInterval
	options: Array<{ value: DashboardInterval; label: string }>
	onChange: (value: DashboardInterval) => void
	ariaLabel: string
}

interface StylishDropdownProps {
	value: string
	options: Array<{ value: string; label: string }>
	onChange: (value: string) => void
	ariaLabel: string
}

interface SubsidyInputState {
	panel_type: string
	inverter_type: string
	requested_power_kw: number
	audit_power_kw: number
}

interface SubsidyResultCardData {
	basePrice: number
	subsidyAmount: number
	customerAmount: number
	subsidyReferencePowerKw: number
}

const DASHBOARD_DEFAULT_DAYS = 30

function asNumber(value: number | string): number {
	const parsed = typeof value === 'number' ? value : Number(value)
	return Number.isFinite(parsed) ? parsed : 0
}

function formatCount(value: number, locale: string): string {
	return new Intl.NumberFormat(locale).format(value)
}

function formatAmount(value: number | string, locale: string): string {
	return formatCurrencyAmount(asNumber(value), locale)
}

function formatPercent(value: number | string): string {
	return `${asNumber(value).toFixed(2)}%`
}

function formatDateLabel(
	value: string,
	locale: string,
	language: string,
): string {
	return formatLocalizedDate(`${value}T00:00:00`, language, {
		locale,
		withYear: true,
		shortMonth: true,
		fallback: value,
	})
}

function formatSeriesLabel(
	value: string,
	locale: string,
	language: string,
): string {
	return formatLocalizedDate(`${value}T00:00:00`, language, {
		locale,
		withYear: false,
		shortMonth: true,
		fallback: value,
	})
}

function toIsoDate(value: Date): string {
	const year = value.getFullYear()
	const month = `${value.getMonth() + 1}`.padStart(2, '0')
	const day = `${value.getDate()}`.padStart(2, '0')
	return `${year}-${month}-${day}`
}

function isIsoDate(value: string | undefined): value is string {
	return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function parseIsoDate(value: string | undefined): Date | undefined {
	if (!isIsoDate(value)) {
		return undefined
	}

	const [year, month, day] = value.split('-').map(Number)
	if (!year || !month || !day) {
		return undefined
	}

	return new Date(year, month - 1, day)
}

function buildDashboardQuery(
	filters: DashboardFilters,
): DashboardOverviewParams {
	if (
		isIsoDate(filters.customDateFrom) &&
		isIsoDate(filters.customDateTo) &&
		filters.customDateFrom <= filters.customDateTo
	) {
		return {
			date_from: filters.customDateFrom,
			date_to: filters.customDateTo,
			interval: filters.interval,
		}
	}

	const dateTo = new Date()
	const dateFrom = new Date(dateTo)
	dateFrom.setDate(dateFrom.getDate() - (DASHBOARD_DEFAULT_DAYS - 1))

	return {
		date_from: toIsoDate(dateFrom),
		date_to: toIsoDate(dateTo),
		interval: filters.interval,
	}
}

function pickForDisplay(
	items: DashboardBreakdownItem[],
	maxItems: number,
): DashboardBreakdownItem[] {
	const nonZero = items.filter(item => item.count > 0)
	return (nonZero.length > 0 ? nonZero : items).slice(0, maxItems)
}

function hexToRgba(hexColor: string, alpha: number): string {
	const normalized = hexColor.replace('#', '')
	if (normalized.length !== 6) {
		return `rgb(var(--color-surface-subtle) / ${alpha})`
	}
	const r = Number.parseInt(normalized.slice(0, 2), 16)
	const g = Number.parseInt(normalized.slice(2, 4), 16)
	const b = Number.parseInt(normalized.slice(4, 6), 16)
	return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getChannelChipStyle(channelKey: string) {
	const color = SOURCE_COLORS[channelKey]
	if (!color) {
		return undefined
	}
	return {
		backgroundColor: hexToRgba(color, 0.16),
		color,
	}
}

function DashboardIntervalDropdown({
	value,
	options,
	onChange,
	ariaLabel,
}: DashboardIntervalDropdownProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [openAbove, setOpenAbove] = useState(false)
	const rootRef = useRef<HTMLDivElement | null>(null)

	const selectedOption = useMemo(
		() => options.find(option => option.value === value) ?? options[0],
		[options, value],
	)

	useEffect(() => {
		function handlePointerDown(event: MouseEvent | TouchEvent) {
			if (!rootRef.current?.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setIsOpen(false)
			}
		}

		window.addEventListener('mousedown', handlePointerDown)
		window.addEventListener('touchstart', handlePointerDown)
		window.addEventListener('keydown', handleKeyDown)

		return () => {
			window.removeEventListener('mousedown', handlePointerDown)
			window.removeEventListener('touchstart', handlePointerDown)
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [])

	useEffect(() => {
		setIsOpen(false)
	}, [value])

	useEffect(() => {
		if (!isOpen) {
			return
		}

		function updatePlacement() {
			const rect = rootRef.current?.getBoundingClientRect()
			if (!rect) {
				return
			}

			const expectedMenuHeight = 176
			const spaceBelow = window.innerHeight - rect.bottom
			const spaceAbove = rect.top
			setOpenAbove(spaceBelow < expectedMenuHeight && spaceAbove > spaceBelow)
		}

		updatePlacement()
		window.addEventListener('resize', updatePlacement)
		window.addEventListener('scroll', updatePlacement, true)

		return () => {
			window.removeEventListener('resize', updatePlacement)
			window.removeEventListener('scroll', updatePlacement, true)
		}
	}, [isOpen])

	return (
		<div
			ref={rootRef}
			className={['relative', isOpen ? 'z-[140]' : 'z-20'].join(' ')}
		>
			<button
				type='button'
				onClick={() => setIsOpen(current => !current)}
				className={[
					'group inline-flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition duration-fast min-[480px]:w-auto min-[480px]:min-w-[130px]',
					'bg-gradient-to-b from-surface-card to-surface-subtle/80 shadow-[0_15px_26px_-22px_rgba(22,133,62,0.85)]',
					isOpen
						? 'border-primary/60 text-text-primary ring-2 ring-primary/20'
						: 'border-border-soft/70 text-text-secondary hover:border-primary/45 hover:text-text-primary',
				].join(' ')}
				aria-label={ariaLabel}
				aria-haspopup='listbox'
				aria-expanded={isOpen}
			>
				<span className='truncate'>{selectedOption?.label}</span>
				<AppIcon
					name='chevron-down'
					className={[
						'h-3.5 w-3.5 shrink-0 text-text-muted transition duration-fast',
						isOpen
							? 'rotate-180 text-primary'
							: 'group-hover:text-text-secondary',
					].join(' ')}
					aria-hidden='true'
				/>
			</button>

			{isOpen ? (
				<div
					className={[
						'absolute left-0 z-[150] min-w-full overflow-hidden rounded-xl bg-surface-card/95 p-1.5 shadow-[0_26px_46px_-28px_rgba(15,23,42,0.52)] ring-1 ring-border-soft/80 backdrop-blur-sm',
						openAbove ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]',
					].join(' ')}
					role='listbox'
					aria-label={ariaLabel}
				>
					<div className='grid gap-1'>
						{options.map(option => {
							const isSelected = option.value === value

							return (
								<button
									key={option.value}
									type='button'
									className={[
										'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] transition duration-fast',
										isSelected
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'text-text-secondary hover:bg-primary/10 hover:text-text-primary',
									].join(' ')}
									role='option'
									aria-selected={isSelected}
									onClick={() => {
										onChange(option.value)
										setIsOpen(false)
									}}
								>
									<span>{option.label}</span>
									{isSelected ? (
										<span className='h-1.5 w-1.5 rounded-full bg-current' />
									) : null}
								</button>
							)
						})}
					</div>
				</div>
			) : null}
		</div>
	)
}

function DashboardPage() {
	const { t, i18n } = useTranslation()
	const { canAccessRoute } = useAuth()
	const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ'
	const calendarLocale = i18n.language === 'ru' ? ru : uz
	const publicTx = {
		title: t('dashboard.publicApi.title'),
		subtitle: t('dashboard.publicApi.subtitle'),
		subsidyTitle: t('dashboard.publicApi.subsidyTitle'),
		subsidyDescription: t('dashboard.publicApi.subsidyDescription'),
		panelType: t('dashboard.publicApi.panelType'),
		inverterType: t('dashboard.publicApi.inverterType'),
		requestedPower: t('dashboard.publicApi.requestedPower'),
		auditPower: t('dashboard.publicApi.auditPower'),
		calculate: t('dashboard.publicApi.calculate'),
		calculating: t('dashboard.publicApi.calculating'),
		subsidyError: t('dashboard.publicApi.subsidyError'),
		subsidyEmpty: t('dashboard.publicApi.subsidyEmpty'),
		basePrice: t('dashboard.publicApi.basePrice'),
		subsidyAmount: t('dashboard.publicApi.subsidyAmount'),
		customerAmount: t('dashboard.publicApi.customerAmount'),
		referencePower: t('dashboard.publicApi.referencePower'),
		jinkoLabel: t('dashboard.publicApi.panelTypes.jinkoJa'),
		longiLabel: t('dashboard.publicApi.panelTypes.longiHiMoX10'),
		deyeLabel: t('dashboard.publicApi.inverterTypes.deye'),
		solaxLabel: t('dashboard.publicApi.inverterTypes.solax'),
	}
	const [overview, setOverview] = useState<DashboardOverview | null>(null)
	const [filters, setFilters] = useState<DashboardFilters>({
		interval: 'day',
	})
	const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)
	const [loading, setLoading] = useState(true)
	const [hasError, setHasError] = useState(false)
	const [subsidyInput, setSubsidyInput] = useState<SubsidyInputState>({
		panel_type: 'jinko_ja',
		inverter_type: 'deye',
		requested_power_kw: 10,
		audit_power_kw: 10,
	})
	const [subsidyResult, setSubsidyResult] = useState<unknown>(null)
	const [subsidyLoading, setSubsidyLoading] = useState(false)
	const [subsidyError, setSubsidyError] = useState<string | null>(null)

	const query = useMemo(() => buildDashboardQuery(filters), [filters])
	const intervalOptions = useMemo(
		() => [
			{ value: 'day' as const, label: t('dashboard.filters.intervals.day') },
			{ value: 'week' as const, label: t('dashboard.filters.intervals.week') },
			{
				value: 'month' as const,
				label: t('dashboard.filters.intervals.month'),
			},
		],
		[t],
	)

	useEffect(() => {
		let active = true

		async function loadOverview() {
			setLoading(true)
			setHasError(false)

			try {
				const nextOverview = await services.dashboard.getDashboardOverview(query)

				if (!active) {
					return
				}

				setOverview(nextOverview)
			} catch {
				if (!active) {
					return
				}
				setHasError(true)
				setOverview(null)
			} finally {
				if (active) {
					setLoading(false)
				}
			}
		}

		void loadOverview()

		return () => {
			active = false
		}
	}, [query])

	const trendChartConfig = useMemo(
		() =>
			({
				clients: {
					label: t('routes.clients.title', { defaultValue: 'Clients' }),
					color: 'rgb(var(--color-primary))',
				},
				chats: {
					label: t('routes.chat.title', { defaultValue: 'Chats' }),
					color: BRAND_CHART.sky,
				},
				contracts: {
					label: t('routes.contracts.title', { defaultValue: 'Contracts' }),
					color: BRAND_CHART.sun,
				},
			}) satisfies ChartConfig,
		[t],
	)

	const sourceChartConfig = useMemo(
		() =>
			({
				count: {},
			}) satisfies ChartConfig,
		[],
	)

	const statusChartConfig = useMemo(
		() =>
			({
				count: {},
			}) satisfies ChartConfig,
		[],
	)

	if (loading) {
		return (
			<>
				<span className='sr-only' role='status'>
					{t('dashboard.loadingTitle')}
				</span>
				<DashboardSkeleton />
			</>
		)
	}

	if (hasError || !overview) {
		return (
			<PageLayout>
				<section className='app-rise rounded-xl bg-surface-card p-7 shadow-md ring-1 ring-danger/25'>
					<span
						aria-hidden='true'
						className='mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-danger-bg text-danger'
					>
						<AppIcon name='activity' className='h-5 w-5' />
					</span>
					<h1 className='m-0 font-display text-[2rem] font-extrabold text-text-primary'>
						{t('dashboard.errorTitle')}
					</h1>
					<p className='mt-2 text-sm text-text-secondary'>
						{t('dashboard.errorDescription')}
					</p>
				</section>
			</PageLayout>
		)
	}

	const localizedTimeSeries = overview.time_series.map(point => ({
		...point,
		localizedLabel: formatSeriesLabel(
			point.bucket_start,
			locale,
			i18n.language,
		),
	}))
	const sourceTotal = overview.breakdowns.leads_by_source.reduce(
		(sum, item) => sum + item.count,
		0,
	)

	const displaySourceItems = pickForDisplay(
		overview.breakdowns.leads_by_source,
		5,
	)
	const displaySourceTotal = displaySourceItems.reduce(
		(sum, item) => sum + item.count,
		0,
	)
	const sourcePieData: PieSlice[] = displaySourceItems.map((item, index) => ({
		...item,
		label: getChannelLabel(t, item.key, item.label),
		color:
			SOURCE_COLORS[item.key] ??
			SOURCE_COLORS_FALLBACK[index % SOURCE_COLORS_FALLBACK.length]!,
		share: (item.count / displaySourceTotal) * 100,
	}))

	const contractStatusDistribution = (overview as any)
		?.contract_status_distribution as
		| Array<{ status: string; total: number }>
		| undefined

	const contractStatusItems: DashboardBreakdownItem[] =
		Array.isArray(contractStatusDistribution) &&
		contractStatusDistribution.length > 0
			? contractStatusDistribution.map(item => ({
					key: String(item.status ?? ''),
					label: String(item.status ?? ''),
					count: Number(item.total ?? 0),
				}))
			: overview.breakdowns.contracts_by_status

	const leadStatusData = pickForDisplay(contractStatusItems, 6).map(item => ({
		...item,
		label:
			['all', 'contract', 'contracts'].includes(item.key) ||
			['contract', 'contracts'].includes(item.label.trim().toLowerCase())
				? t('routes.contracts.title', { defaultValue: item.label })
				: t(`contractsPage.statuses.${item.key}`, {
						defaultValue: getOrderStatusLabel(t, item.key, item.label),
					}),
	}))
	const leadStatusTotal = leadStatusData.reduce(
		(sum, item) => sum + item.count,
		0,
	)
	const leadStatusPieData: PieSlice[] = leadStatusData.map((item, index) => ({
		...item,
		color:
			CONTRACT_STATUS_COLORS[item.key] ??
			STATUS_COLORS_FALLBACK[
				index % STATUS_COLORS_FALLBACK.length
			]!,
		share: (item.count / leadStatusTotal) * 100,
	}))
	const topProducts = overview.breakdowns.top_products.slice(0, 15)
	const regionDemand = overview.region_demand ?? []
	const topProductColumns: DataTableColumn<DashboardTopProduct>[] = [
		{
			key: 'product',
			label: t('dashboard.topProducts.columns.product'),
			render: item => (
				<div className='grid gap-0.5'>
					<span className={tablePrimaryTextClassName}>{item.label}</span>
					<span className={tableSecondaryTextClassName}>
						{item.product_id ?? item.key}
					</span>
				</div>
			),
		},
		{
			key: 'sold',
			label: t('dashboard.topProducts.columns.sold'),
			align: 'right',
			render: item => (
				<span className='block text-right text-sm font-semibold text-text-primary'>
					{formatCount(item.count, locale)}
				</span>
			),
		},
		{
			key: 'revenue',
			label: t('dashboard.topProducts.columns.revenue'),
			align: 'right',
			render: item => (
				<span className='block text-right text-sm font-semibold text-text-primary'>
					{formatAmount(item.revenue ?? '0', locale)}
				</span>
			),
		},
	]
	const regionDemandColumns: DataTableColumn<DashboardRegionDemandItem>[] = [
		{
			key: 'region',
			label: t('dashboard.regionDemand.columns.region'),
			render: item => (
				<span className={tablePrimaryTextClassName}>{item.region}</span>
			),
		},
		{
			key: 'total',
			label: t('dashboard.regionDemand.columns.total'),
			align: 'right',
			render: item => (
				<span className='block text-right text-sm font-semibold text-text-primary'>
					{formatCount(item.total, locale)}
				</span>
			),
		},
	]
	const countFormat = (value: number) => formatCount(value, locale)
	const seriesOf = (key: 'clients' | 'chats' | 'contracts' | 'leads') =>
		overview.time_series.map(point => point[key])
	const sumOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0)
	const inRangeHint = (values: number[]) =>
		values.length > 1
			? t('dashboard.kpi.inRange', { count: sumOf(values), value: countFormat(sumOf(values)) })
			: undefined
	const clientsSeries = seriesOf('clients')
	const chatsSeries = seriesOf('chats')
	const contractsSeries = seriesOf('contracts')
	const metricCards: MetricCardData[] = [
		{
			key: 'clients',
			routeId: 'clients',
			label: t('routes.clients.title', { defaultValue: 'Clients' }),
			icon: 'clients',
			tone: 'green',
			value: overview.clients,
			format: countFormat,
			series: clientsSeries,
			hint: inRangeHint(clientsSeries),
		},
		{
			key: 'chats',
			routeId: 'chats',
			label: t('routes.chat.title', { defaultValue: 'Chats' }),
			icon: 'chat',
			tone: 'sky',
			value: overview.chats ?? 0,
			format: countFormat,
			series: chatsSeries,
			hint: inRangeHint(chatsSeries),
		},
		{
			key: 'contracts',
			routeId: 'contracts',
			label: t('routes.contracts.title', { defaultValue: 'Contracts' }),
			icon: 'contracts',
			tone: 'sun',
			value: overview.contracts,
			format: countFormat,
			series: contractsSeries,
			hint: inRangeHint(contractsSeries),
		},
		{
			key: 'products',
			routeId: 'products',
			label: t('routes.products.title', { defaultValue: 'Products' }),
			icon: 'products',
			tone: 'teal',
			value: overview.products ?? 0,
			format: countFormat,
		},
		{
			key: 'notifications',
			routeId: 'notifications',
			label: t('routes.notifications.title', { defaultValue: 'Notifications' }),
			icon: 'notifications',
			tone: 'violet',
			value: overview.notifications ?? 0,
			format: countFormat,
		},
	]
	// Big amount: collected. Small amount: pipeline.
	const collectedAmount = asNumber(
		overview.collected_amount ?? overview.filtered_summary.collected_amount,
	)
	const pipelineAmount = asNumber(overview.pipeline_amount ?? '0')
	const collectedShare =
		collectedAmount + pipelineAmount > 0
			? (collectedAmount / (collectedAmount + pipelineAmount)) * 100
			: 0

	const rangeLabel = overview.date_range?.date_from && overview.date_range?.date_to
		? `${formatDateLabel(
				overview.date_range.date_from,
				locale,
				i18n.language,
			)} - ${formatDateLabel(overview.date_range.date_to, locale, i18n.language)}`
		: t('dashboard.filters.pickRange')
	const selectedDateRange: DateRange | undefined =
		isIsoDate(filters.customDateFrom) && isIsoDate(filters.customDateTo)
			? {
					from: parseIsoDate(filters.customDateFrom),
					to: parseIsoDate(filters.customDateTo),
				}
			: undefined
	const dateRangeButtonLabel =
		selectedDateRange?.from && selectedDateRange?.to
			? `${formatLocalizedDate(selectedDateRange.from, i18n.language, {
					locale,
					withYear: true,
					shortMonth: true,
				})} - ${formatLocalizedDate(selectedDateRange.to, i18n.language, {
					locale,
					withYear: true,
					shortMonth: true,
				})}`
			: t('dashboard.filters.pickRange')

	const panelTypeOptions = [
		{ value: 'jinko_ja', label: publicTx.jinkoLabel },
		{ value: 'longi_hi_mo_x10', label: publicTx.longiLabel },
	]
	const inverterTypeOptions = [
		{ value: 'deye', label: publicTx.deyeLabel },
		{ value: 'solax', label: publicTx.solaxLabel },
	]
	const requestedPowerOptions = [10, 15, 20, 30, 50].map(value => ({
		value: String(value),
		label: `${value} kW`,
	}))
	const auditPowerOptions = requestedPowerOptions
	const parsedSubsidyResult = parseSubsidyResult(subsidyResult)

	async function handleCalculateSubsidy(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setSubsidyLoading(true)
		setSubsidyError(null)

		try {
			const payload = await services.common.calculateSubsidy(subsidyInput)
			setSubsidyResult(payload)
		} catch {
			setSubsidyError(publicTx.subsidyError)
			setSubsidyResult(null)
		} finally {
			setSubsidyLoading(false)
		}
	}

	return (
		<PageLayout>
			<section className='grid gap-4 min-[768px]:gap-5'>
				<header className='app-rise relative isolate overflow-hidden rounded-2xl p-5 text-white shadow-lg min-[640px]:p-7'
					style={{
						background:
							'linear-gradient(118deg, #0A3A1E 0%, #0E542A 40%, #16853E 100%)',
					}}
				>
					<div aria-hidden='true' className='pointer-events-none absolute inset-0 -z-10'>
						<div
							className='dash-hero-ray absolute -right-24 -top-24 h-[340px] w-[340px] rounded-full'
							style={{
								background:
									'radial-gradient(circle, rgb(255 214 102 / 0.95) 0%, rgb(255 182 39 / 0.55) 22%, rgb(255 182 39 / 0) 62%)',
							}}
						/>
						<svg
							className='absolute bottom-0 right-0 h-[58%] w-[62%] opacity-[0.16]'
							viewBox='0 0 400 140'
							preserveAspectRatio='xMaxYMax slice'
						>
							{Array.from({ length: 7 }, (_, column) => (
								<g key={column} transform={`translate(${40 + column * 52} 64) skewX(-18)`}>
									<rect width='44' height='60' rx='3' fill='none' stroke='white' strokeWidth='1.5' />
									<line x1='22' y1='0' x2='22' y2='60' stroke='white' strokeWidth='1' />
									<line x1='0' y1='20' x2='44' y2='20' stroke='white' strokeWidth='1' />
									<line x1='0' y1='40' x2='44' y2='40' stroke='white' strokeWidth='1' />
								</g>
							))}
						</svg>
					</div>

					<div className='flex flex-wrap items-start justify-between gap-5'>
						<div className='min-w-0'>
							<p className='m-0 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white/75'>
								<svg viewBox='0 0 32 32' className='app-sun-spin h-4 w-4' aria-hidden='true'>
									<circle cx='16' cy='16' r='6' fill='#FFD166' />
									{Array.from({ length: 8 }, (_, index) => (
										<rect
											key={index}
											x='15'
											y='2.5'
											width='2'
											height='5'
											rx='1'
											fill='#FFD166'
											transform={`rotate(${index * 45} 16 16)`}
										/>
									))}
								</svg>
								{t('dashboard.metrics.collectedAmount')}
							</p>
							<p className='m-0 mt-2 font-display text-[clamp(1.9rem,4.4vw,3rem)] font-extrabold leading-none tracking-[-0.04em]'>
								<AnimatedNumber
									value={collectedAmount}
									format={value => formatAmount(value, locale)}
									durationMs={1400}
								/>
							</p>
							<p className='m-0 mt-2.5 text-sm font-semibold text-white/80'>
								{formatAmount(pipelineAmount, locale)}{' '}
								<span className='font-medium text-white/60'>
									{t('dashboard.metrics.pending')}
								</span>
							</p>
							<div className='mt-4 w-[min(320px,72vw)]'>
								<div className='h-2 overflow-hidden rounded-full bg-white/15'>
									<span
										className='block h-full rounded-full transition-[width] duration-1000 ease-out'
										style={{
											width: `${collectedShare}%`,
											background: 'linear-gradient(90deg, #9BE36D, #FFD166)',
										}}
									/>
								</div>
								<p className='m-0 mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60'>
									{t('dashboard.hero.collectedShare', {
										value: formatPercent(collectedShare),
									})}
								</p>
							</div>
						</div>

						<div className='grid w-full gap-2 min-[480px]:w-auto min-[480px]:justify-items-end'>
							<p className='m-0 max-w-full break-words rounded-pill bg-white/12 px-3 py-1.5 text-[12px] font-semibold text-white/85 ring-1 ring-white/20 backdrop-blur-sm'>
								{rangeLabel} ({overview.date_range.timezone})
							</p>
						<div className='relative flex flex-wrap items-stretch gap-2 min-[480px]:items-center'>
							<Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
								<PopoverTrigger asChild>
									<button
										type='button'
										className='inline-flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-border-soft/70 bg-gradient-to-b from-surface-card to-surface-subtle/80 px-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary shadow-[0_15px_26px_-22px_rgba(22,133,62,0.6)] transition duration-fast hover:border-primary/45 hover:text-text-primary min-[480px]:w-auto min-[480px]:min-w-[248px]'
										aria-label={t('dashboard.filters.customRange')}
									>
										<span className='inline-flex items-center gap-2 truncate'>
											<AppIcon
												name='calendar'
												className='h-3.5 w-3.5 text-primary'
												aria-hidden='true'
											/>
											<span className='truncate'>{dateRangeButtonLabel}</span>
										</span>
										<AppIcon
											name='chevron-down'
											className={[
												'h-3.5 w-3.5 shrink-0 transition duration-fast',
												isDatePopoverOpen
													? 'rotate-180 text-primary'
													: 'text-text-muted',
											].join(' ')}
											aria-hidden='true'
										/>
									</button>
								</PopoverTrigger>
								<PopoverContent className='w-auto p-3'>
									<Calendar
										mode='range'
										selected={selectedDateRange}
										defaultMonth={
											selectedDateRange?.to ?? selectedDateRange?.from ?? new Date()
										}
										locale={calendarLocale}
										formatters={
											i18n.language === 'uz'
												? {
														formatCaption: date => formatUzMonthYear(date, false),
													}
												: undefined
										}
										onSelect={(range: DateRange | undefined) => {
											if (!range?.from) {
												setFilters(current => ({
													...current,
													customDateFrom: undefined,
													customDateTo: undefined,
												}))
												return
											}

											const from = toIsoDate(range.from)
											const to = toIsoDate(range.to ?? range.from)

											setFilters(current => ({
												...current,
												customDateFrom: from,
												customDateTo: to,
											}))

											if (range.to) {
												setIsDatePopoverOpen(false)
											}
										}}
									/>
									<div className='mt-2 flex items-center justify-between gap-2 border-t border-border-soft/70 pt-2'>
										<button
											type='button'
											className='inline-flex h-8 items-center rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary transition duration-fast hover:bg-surface-subtle hover:text-text-primary'
											onClick={() =>
												setFilters(current => ({
													...current,
													customDateFrom: undefined,
													customDateTo: undefined,
												}))
											}
										>
											{t('dashboard.filters.clearRange')}
										</button>
										<button
											type='button'
											className='inline-flex h-8 items-center rounded-md bg-primary px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-foreground transition duration-fast hover:bg-primary-accent'
											onClick={() => setIsDatePopoverOpen(false)}
										>
											{t('common.save')}
										</button>
									</div>
								</PopoverContent>
							</Popover>

							<DashboardIntervalDropdown
								value={filters.interval}
								options={intervalOptions}
								onChange={interval =>
									setFilters(current => ({
										...current,
										interval,
									}))
								}
								ariaLabel={t('dashboard.filters.intervalLabel')}
							/>
						</div>
						</div>
					</div>
				</header>

				<section className='grid grid-cols-2 gap-3 xl:grid-cols-5'>
					{metricCards.map((card, index) => {
						const tone = METRIC_TONES[card.tone]
						const href = canAccessRoute(card.routeId)
							? routePaths[card.routeId as keyof typeof routePaths]
							: undefined
						const cardClassName = `${dashCardClassName} group hover:-translate-y-0.5 ${index === metricCards.length - 1 ? 'max-xl:col-span-2' : ''}`
						const cardStyle = { ['--rise-index' as string]: index + 1 }
						const body = (
							<>
								<span
									aria-hidden='true'
									className='absolute inset-x-0 top-0 h-[3px] opacity-80'
									style={{
										background: `linear-gradient(90deg, ${tone.color}, transparent 85%)`,
									}}
								/>
								<div className='flex h-10 items-center justify-between gap-3'>
									<span
										aria-hidden='true'
										className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition duration-base group-hover:scale-105 ${tone.chip}`}
									>
										<AppIcon name={card.icon} className='h-[18px] w-[18px]' />
									</span>
									{card.series && card.series.some(value => value > 0) ? (
										<Sparkline
											values={card.series}
											color={tone.color}
											className='h-9 w-[44%] max-w-[120px]'
										/>
									) : null}
								</div>
								<p className='m-0 mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted'>
									{card.label}
								</p>
								<p className='m-0 mt-1 font-display text-[clamp(1.45rem,5vw,1.85rem)] font-extrabold leading-tight tracking-[-0.03em] text-text-primary'>
									<AnimatedNumber value={card.value} format={card.format} />
								</p>
								{card.hint ? (
									<p className='m-0 mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-text-secondary'>
										<AppIcon
											name='trending-up'
											className='h-3.5 w-3.5'
											style={{ color: tone.color }}
											aria-hidden='true'
										/>
										{card.hint}
									</p>
								) : null}
							</>
						)
						return href ? (
							<Link
								key={card.key}
								to={href}
								aria-label={card.label}
								className={`${cardClassName} block cursor-pointer text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
								style={cardStyle}
							>
								{body}
							</Link>
						) : (
							<article key={card.key} className={cardClassName} style={cardStyle}>
								{body}
							</article>
						)
					})}
				</section>

				<section className='grid gap-3'>
					<article className={dashCardClassName} style={{ ['--rise-index' as string]: 6 }}>
						<DashSectionHeading
							icon='activity'
							title={t('dashboard.sections.trend')}
							description={t('dashboard.descriptions.trend')}
							aside={
								<ul className='m-0 flex list-none flex-wrap gap-2 p-0'>
									{(['clients', 'chats', 'contracts'] as const).map(key => (
										<li
											key={key}
											className='inline-flex items-center gap-1.5 rounded-pill bg-surface-subtle px-2.5 py-1 text-[11px] font-semibold text-text-secondary ring-1 ring-border-soft/50'
										>
											<span
												className='h-2 w-2 rounded-full'
												style={{ backgroundColor: trendChartConfig[key].color }}
											/>
											{trendChartConfig[key].label}
										</li>
									))}
								</ul>
							}
						/>
						<div className='mt-4 h-[250px] min-[480px]:h-[290px]'>
							<ChartContainer
								config={trendChartConfig}
								className='h-full w-full'
							>
								<AreaChart
									data={localizedTimeSeries}
									margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
								>
									<defs>
										{(['clients', 'chats', 'contracts'] as const).map(key => (
											<linearGradient key={key} id={`dash-trend-${key}`} x1='0' x2='0' y1='0' y2='1'>
												<stop offset='0%' stopColor={trendChartConfig[key].color} stopOpacity={0.26} />
												<stop offset='100%' stopColor={trendChartConfig[key].color} stopOpacity={0} />
											</linearGradient>
										))}
									</defs>
									<CartesianGrid
										vertical={false}
										strokeDasharray='0'
										stroke='rgb(var(--color-border-soft) / 0.34)'
									/>
									<XAxis
										dataKey='localizedLabel'
										axisLine={false}
										tickLine={false}
										tickMargin={8}
										minTickGap={22}
										interval='preserveStartEnd'
										className='text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted'
									/>
									<YAxis
										axisLine={false}
										tickLine={false}
										tickMargin={8}
										width={36}
										allowDecimals={false}
										className='text-[11px] font-semibold text-text-muted'
									/>
									<ChartTooltip
										cursor={{ stroke: 'rgb(var(--color-primary) / 0.35)', strokeDasharray: '4 4' }}
										content={<ChartTooltipContent />}
									/>
									{(['contracts', 'chats', 'clients'] as const).map(key => (
										<Area
											key={key}
											type='monotone'
											dataKey={key}
											stroke={trendChartConfig[key].color}
											strokeWidth={key === 'clients' ? 2.6 : 2.2}
											fill={`url(#dash-trend-${key})`}
											dot={false}
											activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'rgb(var(--color-surface-card))' }}
											animationDuration={1100}
										/>
									))}
								</AreaChart>
							</ChartContainer>
						</div>
					</article>
				</section>

				<section className='grid gap-3 lg:grid-cols-2'>
					<article className={dashCardClassName} style={{ ['--rise-index' as string]: 7 }}>
						<DashSectionHeading
							icon='chat'
							title={t('dashboard.sections.source')}
							description={t('dashboard.descriptions.source')}
						/>
						{displaySourceTotal <= 0 ? (
							<div className='mt-6 flex items-center justify-center rounded-xl border border-border-soft/60 bg-surface-subtle/65 p-12'>
								<div className='text-center'>
									<p className='text-sm font-medium text-text-secondary'>
										{t('dashboard.sourceDataHint')}
									</p>
								</div>
							</div>
						) : (
							<>
								<div className='relative mt-4 min-w-0 grid place-items-center rounded-xl border border-border-soft/60 bg-surface-subtle/65 p-3'>
									<div className='h-[170px] w-[170px] min-[420px]:h-[198px] min-[420px]:w-[198px]'>
										<ChartContainer
											config={sourceChartConfig}
											className='h-full w-full'
										>
											<PieChart>
												<Pie
													data={sourcePieData}
													dataKey='count'
													nameKey='label'
													innerRadius={52}
													outerRadius={84}
													paddingAngle={3}
													cornerRadius={7}
													stroke='rgb(var(--color-surface-card))'
													strokeWidth={3}
												>
													{sourcePieData.map(item => (
														<Cell key={item.key} fill={item.color} />
													))}
												</Pie>
												<ChartTooltip
													content={
														<ChartTooltipContent
															hideLabel
															formatter={value =>
																`${value ?? 0} ${t('dashboard.metrics.leads').toLowerCase()}`
															}
														/>
													}
												/>
											</PieChart>
										</ChartContainer>
									</div>
									<div className='pointer-events-none absolute inset-0 grid place-items-center'>
										<div className='rounded-full bg-surface-card/90 px-3 py-1.5 text-center shadow-sm ring-1 ring-border-soft/60 backdrop-blur-sm'>
											<p className='font-display text-[1.2rem] font-extrabold leading-none text-text-primary'>
												{formatCount(sourceTotal, locale)}
											</p>
											<p className='mt-0.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-text-muted'>
												{t('dashboard.metrics.leads')}
											</p>
										</div>
									</div>
								</div>
								<ul className='mt-3 grid list-none gap-2 p-0'>
									{sourcePieData.map(item => (
										<li
											key={item.key}
											className='rounded-lg bg-surface-subtle/85 px-3 py-2.5'
										>
											<div className='flex items-center justify-between gap-2'>
												<span className='inline-flex min-w-0 items-center gap-2 text-sm font-medium text-text-primary'>
													<span
														className='h-2.5 w-2.5 rounded-full'
														style={{ backgroundColor: item.color }}
													/>
													<span className='truncate'>{item.label}</span>
												</span>
												<div className='flex shrink-0 items-center gap-2 text-sm font-semibold text-text-secondary'>
													<span>{formatCount(item.count, locale)}</span>
													<span className='rounded-pill bg-surface-card px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-text-muted'>
														{formatPercent(item.share)}
													</span>
												</div>
											</div>
											<div className='mt-2 h-1.5 overflow-hidden rounded-full bg-border-soft/35'>
												<span
													className='block h-full rounded-full'
													style={{
														width: `${item.share > 0 ? Math.max(item.share, 6) : 0}%`,
														backgroundColor: item.color,
													}}
												/>
											</div>
										</li>
									))}
								</ul>
							</>
						)}
					</article>

					<article className={dashCardClassName} style={{ ['--rise-index' as string]: 8 }}>
						<DashSectionHeading
							icon='contracts'
							title={t('dashboard.sections.contractStatus')}
							description={t('dashboard.descriptions.contractStatus')}
						/>
						{leadStatusTotal <= 0 ? (
							<div className='mt-6 flex items-center justify-center rounded-xl border border-border-soft/60 bg-surface-subtle/65 p-12'>
								<div className='text-center'>
									<p className='text-sm font-medium text-text-secondary'>
										{t('dashboard.sourceDataHint')}
									</p>
								</div>
							</div>
						) : (
							<div className='mt-4 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]'>
								<div className='relative grid place-items-center rounded-xl border border-border-soft/60 bg-surface-subtle/65 p-3'>
									<div className='h-[180px] w-[180px] min-[420px]:h-[210px] min-[420px]:w-[210px]'>
										<ChartContainer
											config={statusChartConfig}
											className='h-full w-full'
										>
											<PieChart>
												<Pie
													data={leadStatusPieData}
													dataKey='count'
													nameKey='label'
													innerRadius={48}
													outerRadius={78}
													paddingAngle={3}
													cornerRadius={6}
													stroke='rgb(var(--color-surface-card))'
													strokeWidth={3}
												>
													{leadStatusPieData.map(item => (
														<Cell key={item.key} fill={item.color} />
													))}
												</Pie>
												<ChartTooltip
													content={
														<ChartTooltipContent
															hideLabel
														/>
													}
												/>
											</PieChart>
										</ChartContainer>
									</div>
									<div className='pointer-events-none absolute inset-0 grid place-items-center'>
										<div className='rounded-full bg-surface-card/90 px-3 py-1.5 text-center shadow-sm ring-1 ring-border-soft/60 backdrop-blur-sm'>
											<p className='font-display text-[1.2rem] font-extrabold leading-none text-text-primary'>
												{formatCount(leadStatusTotal, locale)}
											</p>
											<p className='mt-0.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-text-muted'>
												{t('routes.contracts.title')}
											</p>
										</div>
									</div>
								</div>

								<ul className='grid min-w-0 list-none gap-2 p-0'>
									{leadStatusPieData.map(item => (
										<li
											key={item.key}
											className='rounded-lg bg-surface-subtle/85 px-3 py-2.5'
										>
											<div className='flex items-center justify-between gap-2'>
												<span className='inline-flex min-w-0 items-center gap-2 text-sm font-medium text-text-primary'>
													<span
														className='h-2.5 w-2.5 rounded-full'
														style={{ backgroundColor: item.color }}
													/>
													<span className='truncate'>{item.label}</span>
												</span>
												<div className='flex shrink-0 items-center gap-2 text-sm font-semibold text-text-secondary'>
													<span>{formatCount(item.count, locale)}</span>
													<span className='rounded-pill bg-surface-card px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-text-muted'>
														{formatPercent(item.share)}
													</span>
												</div>
											</div>
											<div className='mt-2 h-1.5 overflow-hidden rounded-full bg-border-soft/35'>
												<span
													className='block h-full rounded-full'
													style={{
														width: `${item.share > 0 ? Math.max(item.share, 6) : 0}%`,
														backgroundColor: item.color,
													}}
												/>
											</div>
										</li>
									))}
								</ul>
							</div>
						)}
					</article>
				</section>

				<section className='min-w-0'>
					<article className={dashCardClassName} style={{ ['--rise-index' as string]: 9 }}>
						<DashSectionHeading
							icon='products'
							title={t('dashboard.sections.topProducts')}
							description={t('dashboard.descriptions.topProducts')}
							aside={
								<p className='m-0 rounded-pill bg-sun/12 px-2.5 py-1 text-[12px] font-semibold text-sun-strong'>
									{t('dashboard.topProducts.hint')}
								</p>
							}
						/>

						<div className='mt-4 min-w-0'>
							<DataTable
								data={topProducts}
								columns={topProductColumns}
								rowKey={(item, index) =>
									item.product_id ?? item.key ?? `top-product-${index}`
								}
								emptyTitle={t('dashboard.topProducts.empty')}
								emptyDescription={t('dashboard.descriptions.topProducts')}
							/>
						</div>
					</article>
				</section>

				<section className='grid gap-3 lg:grid-cols-2'>
					<article className={dashCardClassName} style={{ ['--rise-index' as string]: 10 }}>
						<DashSectionHeading
							icon='table'
							title={t('dashboard.sections.regionDemand')}
							description={t('dashboard.descriptions.regionDemand')}
						/>
						<div className='mt-4 min-w-0 overflow-x-auto'>
							<DataTable
								data={regionDemand}
								compact
								columns={regionDemandColumns}
								rowKey={(item, index) => item.region || `region-${index}`}
								emptyTitle={t('dashboard.regionDemand.empty')}
								emptyDescription={t('dashboard.regionDemand.emptyDescription')}
							/>
						</div>
					</article>

					<article
						className={dashCardClassName.replace('overflow-hidden', 'overflow-visible')}
						style={{ ['--rise-index' as string]: 11 }}
					>
						<DashSectionHeading
							icon='sun'
							title={publicTx.subsidyTitle}
							description={publicTx.subsidyDescription}
						/>

						<form className='mt-4 grid gap-2.5' onSubmit={handleCalculateSubsidy}>
							<label className='grid gap-1.5'>
								<span className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>
									{publicTx.panelType}
								</span>
								<StylishDropdown
									value={subsidyInput.panel_type}
									onChange={value =>
										setSubsidyInput(current => ({
											...current,
											panel_type: value,
										}))
									}
									options={panelTypeOptions}
									ariaLabel={publicTx.panelType}
								/>
							</label>

							<label className='grid gap-1.5'>
								<span className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>
									{publicTx.inverterType}
								</span>
								<StylishDropdown
									value={subsidyInput.inverter_type}
									onChange={value =>
										setSubsidyInput(current => ({
											...current,
											inverter_type: value,
										}))
									}
									options={inverterTypeOptions}
									ariaLabel={publicTx.inverterType}
								/>
							</label>

							<label className='grid gap-1.5'>
								<span className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>
									{publicTx.requestedPower}
								</span>
								<StylishDropdown
									value={String(subsidyInput.requested_power_kw)}
									onChange={value =>
										setSubsidyInput(current => ({
											...current,
											requested_power_kw: Number(value),
										}))
									}
									options={requestedPowerOptions}
									ariaLabel={publicTx.requestedPower}
								/>
							</label>

							<label className='grid gap-1.5'>
								<span className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>
									{publicTx.auditPower}
								</span>
								<StylishDropdown
									value={String(subsidyInput.audit_power_kw)}
									onChange={value =>
										setSubsidyInput(current => ({
											...current,
											audit_power_kw: Number(value),
										}))
									}
									options={auditPowerOptions}
									ariaLabel={publicTx.auditPower}
								/>
							</label>

							<button
								type='submit'
								className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-accent px-4 text-sm font-semibold text-primary-foreground shadow-glow transition duration-fast hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-65'
								disabled={subsidyLoading}
							>
								<AppIcon name='activity' className='h-4 w-4' aria-hidden='true' />
								{subsidyLoading ? publicTx.calculating : publicTx.calculate}
							</button>
						</form>

						<div className='mt-4 rounded-lg bg-surface-subtle/70 p-2.5 ring-1 ring-border-soft/35'>
							{subsidyError ? (
								<p className='m-0 text-sm font-medium text-danger'>{subsidyError}</p>
							) : parsedSubsidyResult ? (
								<div className='grid gap-2 sm:grid-cols-2'>
									<div className='rounded-lg bg-surface-card p-2.5 ring-1 ring-border-soft/50'>
										<p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>
											{publicTx.basePrice}
										</p>
										<p className='mt-1 font-display text-[1.25rem] font-extrabold text-text-primary'>
											{formatAmount(parsedSubsidyResult.basePrice, locale)}
										</p>
									</div>
									<div className='rounded-lg bg-success-bg/65 p-2.5 ring-1 ring-success/35'>
										<p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-success'>
											{publicTx.subsidyAmount}
										</p>
										<p className='mt-1 font-display text-[1.25rem] font-extrabold text-success'>
											{formatAmount(parsedSubsidyResult.subsidyAmount, locale)}
										</p>
									</div>
									<div className='rounded-lg bg-primary/10 p-2.5 ring-1 ring-primary/30 sm:col-span-2'>
										<p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-primary'>
											{publicTx.customerAmount}
										</p>
										<p className='mt-1 font-display text-[1.4rem] font-extrabold text-text-primary'>
											{formatAmount(parsedSubsidyResult.customerAmount, locale)}
										</p>
									</div>
									<div className='rounded-lg bg-surface-card p-2.5 ring-1 ring-border-soft/50 sm:col-span-2'>
										<p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>
											{publicTx.referencePower}
										</p>
										<p className='mt-1 text-sm font-semibold text-text-primary'>
											{formatCount(parsedSubsidyResult.subsidyReferencePowerKw, locale)} kW
										</p>
									</div>
								</div>
							) : subsidyResult ? (
								<div className='rounded-lg bg-surface-card p-3 ring-1 ring-border-soft/50'>
									<pre className='m-0 max-h-[220px] overflow-auto text-[12px] leading-5 text-text-primary'>
										{JSON.stringify(subsidyResult, null, 2)}
									</pre>
								</div>
							) : (
								<p className='m-0 text-sm text-text-secondary'>{publicTx.subsidyEmpty}</p>
							)}
						</div>
					</article>
				</section>
			</section>
		</PageLayout>
	)
}

function StylishDropdown({
	value,
	options,
	onChange,
	ariaLabel,
}: StylishDropdownProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [openAbove, setOpenAbove] = useState(false)
	const rootRef = useRef<HTMLDivElement | null>(null)

	const selectedOption = useMemo(
		() => options.find(option => option.value === value) ?? options[0],
		[options, value],
	)

	useEffect(() => {
		function handlePointerDown(event: MouseEvent) {
			if (!rootRef.current?.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setIsOpen(false)
			}
		}

		window.addEventListener('mousedown', handlePointerDown)
		window.addEventListener('keydown', handleKeyDown)

		return () => {
			window.removeEventListener('mousedown', handlePointerDown)
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [])

	useEffect(() => {
		if (!isOpen) {
			return
		}

		function updatePlacement() {
			const rect = rootRef.current?.getBoundingClientRect()
			if (!rect) {
				return
			}

			const expectedMenuHeight = 176
			const spaceBelow = window.innerHeight - rect.bottom
			const spaceAbove = rect.top
			setOpenAbove(spaceBelow < expectedMenuHeight && spaceAbove > spaceBelow)
		}

		updatePlacement()
		window.addEventListener('resize', updatePlacement)
		window.addEventListener('scroll', updatePlacement, true)

		return () => {
			window.removeEventListener('resize', updatePlacement)
			window.removeEventListener('scroll', updatePlacement, true)
		}
	}, [isOpen])

	return (
		<div
			ref={rootRef}
			className={['relative', isOpen ? 'z-[140]' : 'z-20'].join(' ')}
		>
			<button
				type='button'
				onClick={() => setIsOpen(current => !current)}
				className={[
					'group inline-flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm font-semibold transition duration-fast',
					'bg-gradient-to-b from-surface-card to-surface-subtle/80 shadow-[0_15px_26px_-22px_rgba(22,133,62,0.55)]',
					isOpen
						? 'border-primary/60 text-text-primary ring-2 ring-primary/20'
						: 'border-border-soft/70 text-text-secondary hover:border-primary/45 hover:text-text-primary',
				].join(' ')}
				aria-label={ariaLabel}
				aria-haspopup='listbox'
				aria-expanded={isOpen}
			>
				<span className='truncate'>{selectedOption?.label}</span>
				<AppIcon
					name='chevron-down'
					className={[
						'h-3.5 w-3.5 shrink-0 text-text-muted transition duration-fast',
						isOpen
							? 'rotate-180 text-primary'
							: 'group-hover:text-text-secondary',
					].join(' ')}
					aria-hidden='true'
				/>
			</button>

			{isOpen ? (
				<div
					className={[
						'absolute left-0 z-[150] min-w-full overflow-hidden rounded-xl bg-surface-card/95 p-1.5 shadow-[0_26px_46px_-28px_rgba(15,23,42,0.52)] ring-1 ring-border-soft/80 backdrop-blur-sm',
						openAbove ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]',
					].join(' ')}
					role='listbox'
					aria-label={ariaLabel}
				>
					<div className='grid gap-1'>
						{options.map(option => {
							const isSelected = option.value === value

							return (
								<button
									key={option.value}
									type='button'
									className={[
										'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition duration-fast',
										isSelected
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'text-text-secondary hover:bg-primary/10 hover:text-text-primary',
									].join(' ')}
									role='option'
									aria-selected={isSelected}
									onClick={() => {
										onChange(option.value)
										setIsOpen(false)
									}}
								>
									<span>{option.label}</span>
									{isSelected ? (
										<span className='h-1.5 w-1.5 rounded-full bg-current' />
									) : null}
								</button>
							)
						})}
					</div>
				</div>
			) : null}
		</div>
	)
}

function parseSubsidyResult(payload: unknown): SubsidyResultCardData | null {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return null
	}

	const item = payload as Record<string, unknown>
	const basePrice = Number(item.base_price)
	const subsidyAmount = Number(item.subsidy_amount)
	const customerAmount = Number(item.customer_amount)
	const subsidyReferencePowerKw = Number(item.subsidy_reference_power_kw)

	if (
		!Number.isFinite(basePrice) ||
		!Number.isFinite(subsidyAmount) ||
		!Number.isFinite(customerAmount) ||
		!Number.isFinite(subsidyReferencePowerKw)
	) {
		return null
	}

	return {
		basePrice,
		subsidyAmount,
		customerAmount,
		subsidyReferencePowerKw,
	}
}

export default DashboardPage


