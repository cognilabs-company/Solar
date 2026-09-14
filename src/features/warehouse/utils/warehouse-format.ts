import { DEFAULT_CURRENCY_LABEL } from '../../../constants'

export const WAREHOUSE_CURRENCIES = ['uzs', 'usd'] as const

export const WAREHOUSE_PAYMENT_TYPES = ['cash', 'card', 'transfer'] as const

const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/

/** `1 200,50` -> `1200.50`, the form DRF's DecimalField accepts. */
export function normalizeDecimalInput(value: string): string {
	return value.replace(/\s/g, '').replace(',', '.')
}

export function isDecimalString(value: string): boolean {
	return NUMERIC_PATTERN.test(normalizeDecimalInput(value))
}

export function toNumber(value: unknown): number | null {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null
	}

	if (typeof value === 'string' && NUMERIC_PATTERN.test(value.trim())) {
		return Number(value.trim())
	}

	return null
}

export function formatQuantity(value: unknown, locale: string): string {
	const parsed = toNumber(value)
	if (parsed === null) {
		return '-'
	}

	return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(parsed)
}

export function formatMoney(
	value: unknown,
	currency: string,
	locale: string,
): string {
	const parsed = toNumber(value)
	if (parsed === null) {
		return '-'
	}

	const normalizedCurrency = currency.trim().toLowerCase()
	const amount = new Intl.NumberFormat(locale, {
		maximumFractionDigits: normalizedCurrency === 'usd' ? 2 : 0,
	}).format(parsed)

	if (normalizedCurrency === 'usd') {
		return `$${amount}`
	}

	if (normalizedCurrency === 'uzs' || !normalizedCurrency) {
		return `${amount} ${DEFAULT_CURRENCY_LABEL}`
	}

	return `${amount} ${normalizedCurrency.toUpperCase()}`
}

export function getCurrencyLabel(currency: string): string {
	const normalized = currency.trim().toLowerCase()
	if (normalized === 'usd') {
		return 'USD ($)'
	}

	if (normalized === 'uzs') {
		return `UZS (${DEFAULT_CURRENCY_LABEL})`
	}

	return normalized.toUpperCase()
}

function padTwo(value: number): string {
	return String(value).padStart(2, '0')
}

/** Backend ISO datetime -> `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`. */
export function toDateTimeInputValue(value?: string): string {
	if (!value) {
		return ''
	}

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		return ''
	}

	return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}T${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`
}

/** `YYYY-MM-DDTHH:mm` (browser local time) -> ISO string with the local offset, e.g. `+05:00`. */
export function fromDateTimeInputValue(value: string): string | undefined {
	const trimmed = value.trim()
	if (!trimmed) {
		return undefined
	}

	const date = new Date(trimmed)
	if (Number.isNaN(date.getTime())) {
		return undefined
	}

	const offsetMinutes = -date.getTimezoneOffset()
	const sign = offsetMinutes >= 0 ? '+' : '-'
	const absoluteOffset = Math.abs(offsetMinutes)
	const offset = `${sign}${padTwo(Math.floor(absoluteOffset / 60))}:${padTwo(absoluteOffset % 60)}`

	return `${trimmed.length === 16 ? `${trimmed}:00` : trimmed}${offset}`
}

/**
 * Keeps only the keys whose value differs from the initial snapshot, so edit
 * PATCH requests (and the backend audit log) contain just the changed fields.
 */
export function pickChangedFields<T extends object>(initial: T, next: T): Partial<T> {
	const changed: Partial<T> = {}

	;(Object.keys(next) as (keyof T)[]).forEach(key => {
		if (next[key] !== initial[key]) {
			changed[key] = next[key]
		}
	})

	return changed
}
