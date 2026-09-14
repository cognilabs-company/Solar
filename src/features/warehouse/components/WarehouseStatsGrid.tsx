import { useTranslation } from 'react-i18next'
import { PageCard } from '../../../components/shared/page'
import type { WarehouseStats } from '../../../types/warehouse'
import {
	WAREHOUSE_CURRENCIES,
	formatMoney,
	formatQuantity,
	toNumber,
} from '../utils/warehouse-format'

interface WarehouseStatsGridProps {
	stats: WarehouseStats | null
	isLoading: boolean
	hasError: boolean
}

interface StatLine {
	key: string
	label: string
	value: string
}

interface StatCardModel {
	key: string
	label: string
	lines: StatLine[]
}

const labelClassName =
	'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'

const valueClassName =
	'text-sm font-semibold text-text-primary [overflow-wrap:anywhere]'

const CURRENCY_KEYS = new Set<string>(WAREHOUSE_CURRENCIES)

function humanizeKey(key: string): string {
	const text = key.replace(/[_-]+/g, ' ').trim()
	return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * `/api/warehouse/stats/` is rendered as-is: every numeric top-level value is a
 * card, and a one-level object (e.g. `{ "uzs": ..., "usd": ... }`) becomes a
 * card with one line per key. Nothing is recalculated on the frontend.
 */
function WarehouseStatsGrid({ stats, isLoading, hasError }: WarehouseStatsGridProps) {
	const { t, i18n } = useTranslation()
	const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ'

	function resolveLabel(key: string): string {
		return t(`warehouse.stats.labels.${key}`, { defaultValue: humanizeKey(key) })
	}

	function formatValue(key: string, value: unknown): string {
		return CURRENCY_KEYS.has(key.toLowerCase())
			? formatMoney(value, key, locale)
			: formatQuantity(value, locale)
	}

	const cards: StatCardModel[] = Object.entries(stats ?? {}).flatMap(
		([key, value]): StatCardModel[] => {
			if (toNumber(value) !== null) {
				return [
					{
						key,
						label: resolveLabel(key),
						lines: [{ key, label: '', value: formatValue(key, value) }],
					},
				]
			}

			if (!value || typeof value !== 'object' || Array.isArray(value)) {
				return []
			}

			const lines = Object.entries(value as Record<string, unknown>)
				.filter(([, nestedValue]) => toNumber(nestedValue) !== null)
				.map(([nestedKey, nestedValue]) => ({
					key: nestedKey,
					label: CURRENCY_KEYS.has(nestedKey.toLowerCase())
						? nestedKey.toUpperCase()
						: resolveLabel(nestedKey),
					value: formatValue(nestedKey, nestedValue),
				}))

			return lines.length ? [{ key, label: resolveLabel(key), lines }] : []
		},
	)

	if (isLoading && !stats) {
		return (
			<p className='m-0 text-sm font-medium text-text-secondary'>
				{t('warehouse.stats.loading')}
			</p>
		)
	}

	if (hasError) {
		return (
			<p className='m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger'>
				{t('warehouse.stats.error')}
			</p>
		)
	}

	if (!cards.length) {
		return null
	}

	return (
		<div className='grid gap-3 sm:grid-cols-2 min-[1100px]:grid-cols-4'>
			{cards.map(card => (
				<PageCard key={card.key} muted>
					<p className={labelClassName}>{card.label}</p>
					<div className='mt-1 grid gap-0.5'>
						{card.lines.map(line => (
							<p key={line.key} className={`m-0 ${valueClassName}`}>
								{line.label ? (
									<span className='mr-1.5 text-[12px] font-medium text-text-secondary'>
										{line.label}:
									</span>
								) : null}
								{line.value}
							</p>
						))}
					</div>
				</PageCard>
			))}
		</div>
	)
}

export default WarehouseStatsGrid
