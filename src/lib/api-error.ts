/**
 * Pulls a human-readable message out of an API failure, whether it came from
 * axios (`error.response.data`), the adapters' ServiceError (`errorData`) or a
 * plain Error.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null
	}

	return value as Record<string, unknown>
}

function readMessage(value: unknown): string | null {
	if (typeof value === 'string' && value.trim().length) {
		return value.trim()
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			const message = readMessage(item)
			if (message) {
				return message
			}
		}
	}

	return null
}

export function extractApiErrorMessage(error: unknown, fallback: string): string {
	const topLevel = asRecord(error)
	const response = asRecord(topLevel?.response)
	const payload =
		asRecord(response?.data) ?? asRecord(topLevel?.errorData) ?? asRecord(topLevel?.data)

	const candidates: unknown[] = [
		payload?.detail,
		payload?.message,
		payload?.error,
		payload?.non_field_errors,
		payload?.errors,
	]

	for (const candidate of candidates) {
		const message = readMessage(candidate)
		if (message) {
			return message
		}
	}

	// DRF field errors: { field: ["msg"] } - surface the first one.
	if (payload) {
		for (const [key, value] of Object.entries(payload)) {
			if (key === 'status') {
				continue
			}
			const message = readMessage(value)
			if (message) {
				return message
			}
		}
	}

	// ServiceError already carries the server's detail as its message; a bare
	// network failure ("Failed to fetch") is not useful to show.
	const message = readMessage(topLevel?.message)
	if (message && topLevel?.name === 'ServiceError' && message !== 'Request failed') {
		return message
	}

	return fallback
}

export function getApiErrorStatus(error: unknown): number | undefined {
	const topLevel = asRecord(error)
	const response = asRecord(topLevel?.response)
	if (typeof response?.status === 'number') {
		return response.status
	}
	if (typeof topLevel?.statusCode === 'number') {
		return topLevel.statusCode
	}
	return undefined
}
