import {
	parseApiError,
	type ParsedApiError,
} from '../../subsidy/utils/subsidy-errors'

/**
 * DRF validation errors for warehouse forms.
 *
 * Errors for inputs the form renders stay inline; the banner always carries a
 * message too, so a 400 like `{"quantity": "Skladda yetarli mahsulot yo'q."}`
 * is visible next to the submit button even when the field is scrolled away.
 */
export function parseWarehouseError(
	error: unknown,
	fallback: string,
	formFieldKeys: readonly string[],
): ParsedApiError {
	const parsed = parseApiError(error, fallback)
	const fieldErrors: Record<string, string> = {}
	const otherMessages: string[] = []

	Object.entries(parsed.fieldErrors).forEach(([key, message]) => {
		if (formFieldKeys.includes(key)) {
			fieldErrors[key] = message
			return
		}

		otherMessages.push(message)
	})

	return {
		fieldErrors,
		message:
			parsed.message ??
			otherMessages[0] ??
			Object.values(fieldErrors)[0] ??
			fallback,
	}
}
