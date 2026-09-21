/**
 * API request utilities for adapters
 */

import type {
	ApiErrorResponse,
	PaginatedResponse,
	ServiceError,
} from '../../contracts'
import { ServiceError as ServiceErrorClass } from '../../contracts'
import { getAccessToken } from '../../../lib/auth-storage'
import { requestTokenRefresh } from '../../../lib/api-client'

const NGROK_BYPASS_HEADER_NAME = 'ngrok-skip-browser-warning'

function isNgrokHost(baseUrl: string): boolean {
	if (!baseUrl) {
		return false
	}

	try {
		const hostname = new URL(baseUrl).hostname.toLowerCase()
		return (
			hostname.endsWith('.ngrok-free.dev') ||
			hostname.endsWith('.ngrok-free.app') ||
			hostname.endsWith('.ngrok.io')
		)
	} catch {
		return false
	}
}

export interface RequestConfig {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
	headers?: Record<string, string>
	body?: unknown
	params?: Record<string, unknown>
	timeout?: number
	_retry?: boolean
}

export class ApiRequestor {
	private shouldAttachNgrokBypassHeader: boolean

	constructor(private baseUrl: string) {
		this.shouldAttachNgrokBypassHeader = isNgrokHost(baseUrl)
	}

	async request<T>(endpoint: string, config?: RequestConfig): Promise<T> {
		const url = new URL(endpoint, this.baseUrl)

		// Add query parameters
		if (config?.params) {
			Object.entries(config.params).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					url.searchParams.append(key, String(value))
				}
			})
		}

		const isFormData = config?.body instanceof FormData
		const headers: Record<string, string> = {
			...config?.headers,
		}

		// Only attach this header when we are actually talking to an ngrok host.
		// Sending it to non-ngrok APIs may break CORS preflight checks.
		if (this.shouldAttachNgrokBypassHeader) {
			headers[NGROK_BYPASS_HEADER_NAME] = 'true'
		}

		if (!isFormData) {
			headers['Content-Type'] = 'application/json'
		}

		// Add authorization token
		const token = getAccessToken()
		if (token) {
			headers['Authorization'] = `Bearer ${token}`
		}

		try {
			const fetchConfig: RequestInit = {
				method: config?.method || 'GET',
				headers,
				cache: 'no-store' as RequestCache,
				body: isFormData 
					? (config?.body as FormData) 
					: (config?.body ? JSON.stringify(config.body) : undefined),
				signal: config?.timeout
					? AbortSignal.timeout(config.timeout)
					: undefined,
			}

			let response = await fetch(url.toString(), fetchConfig)

			if (response.status === 401 && !config?._retry) {
				const refreshedTokens = await requestTokenRefresh()
				if (refreshedTokens?.access) {
					// Retry with new token
					headers['Authorization'] = `Bearer ${refreshedTokens.access}`
					fetchConfig.headers = headers
					response = await fetch(url.toString(), fetchConfig)
				}
			}

			if (!response.ok) {
				const errorData = await this.parseErrorResponse(response)
				throw new ServiceErrorClass(
					response.status,
					errorData?.detail || errorData?.message || 'Request failed',
					errorData ?? undefined,
				)
			}

			// Handle 204 No Content
			if (response.status === 204) {
				return undefined as T
			}

			// DELETE (and some custom actions) answer 200 with an empty body -
			// `response.json()` would throw and make a successful call look failed.
			const rawBody = await response.text()
			if (!rawBody.trim().length) {
				return undefined as T
			}

			let json: unknown
			try {
				json = JSON.parse(rawBody)
			} catch {
				throw new ServiceErrorClass(response.status, 'Invalid JSON response')
			}
			
			if (json && 
				typeof json === 'object' && 
				!Array.isArray(json) && 
				(json as any).status === 'success' && 
				'data' in (json as any)
			) {
				const unwrappedData = (json as any).data;
				return this.normalizeResponse<T>(unwrappedData);
			}

			return this.normalizeResponse<T>(json) as T;
		} catch (error) {
			if (error instanceof ServiceErrorClass) {
				throw error
			}

			throw new ServiceErrorClass(
				0,
				error instanceof Error ? error.message : 'Unknown error',
			)
		}
	}

	private normalizeResponse<T>(data: any): T {
		if (data && typeof data === 'object' && !Array.isArray(data)) {
			// Normalize paginated response keys (results -> items, count -> total)
			if ('results' in data && Array.isArray(data.results) && !('items' in data)) {
				data.items = data.results;
			}
			if ('count' in data && typeof data.count === 'number' && !('total' in data)) {
				data.total = data.count;
			}
		}
		return data as T;
	}

	private async parseErrorResponse(
		response: Response,
	): Promise<ApiErrorResponse | null> {
		try {
			return (await response.json()) as ApiErrorResponse
		} catch {
			return null
		}
	}

	async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
		return this.request<T>(endpoint, { method: 'GET', params })
	}

	async post<T>(
		endpoint: string,
		body?: unknown,
		params?: Record<string, unknown>,
	): Promise<T> {
		return this.request<T>(endpoint, { method: 'POST', body, params })
	}

	async put<T>(
		endpoint: string,
		body?: unknown,
		params?: Record<string, unknown>,
	): Promise<T> {
		return this.request<T>(endpoint, { method: 'PUT', body, params })
	}

	async patch<T>(
		endpoint: string,
		body?: unknown,
		params?: Record<string, unknown>,
	): Promise<T> {
		return this.request<T>(endpoint, { method: 'PATCH', body, params })
	}

	async delete<T>(
		endpoint: string,
		params?: Record<string, unknown>,
	): Promise<T> {
		return this.request<T>(endpoint, { method: 'DELETE', params })
	}

	async blob(endpoint: string, params?: Record<string, unknown>): Promise<Blob> {
		const url = new URL(endpoint, this.baseUrl)

		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					url.searchParams.append(key, String(value))
				}
			})
		}

		const headers: Record<string, string> = {
			'ngrok-skip-browser-warning': 'true',
		}

		const token = getAccessToken()
		if (token) {
			headers['Authorization'] = `Bearer ${token}`
		}

		const fetchConfig: RequestInit = {
			method: 'GET',
			headers,
			cache: 'no-store',
		}

		let response = await fetch(url.toString(), fetchConfig)

		if (response.status === 401) {
			const refreshedTokens = await requestTokenRefresh()
			if (refreshedTokens?.access) {
				headers['Authorization'] = `Bearer ${refreshedTokens.access}`
				fetchConfig.headers = headers
				response = await fetch(url.toString(), fetchConfig)
			}
		}

		if (!response.ok) {
			const errorData = await this.parseErrorResponse(response)
			throw new ServiceErrorClass(
				response.status,
				errorData?.detail || errorData?.message || 'Request failed',
				errorData ?? undefined,
			)
		}

		return response.blob()
	}
}
