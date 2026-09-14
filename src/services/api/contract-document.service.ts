/**
 * Contract document generation service.
 *
 * `POST /api/contracts/generate/` renders a DOCX from the form values. The
 * response is read as a blob so both a direct file and a JSON body with a file
 * link work; JSON error bodies are decoded back so DRF field errors still parse.
 */

import { apiClient } from '../../lib/api-client'
import type {
	ContractDocumentInput,
	ContractDocumentResult,
} from '../../types/contract-document'

const GENERATE_ENDPOINT = '/api/contracts/generate/'

const FILE_URL_KEYS = [
	'file_url',
	'download_url',
	'document_url',
	'docx_url',
	'file',
	'url',
] as const

function toRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null
	}

	return value as Record<string, unknown>
}

async function readBlobJson(blob: Blob): Promise<unknown> {
	try {
		return JSON.parse(await blob.text())
	} catch {
		return null
	}
}

function findFileUrl(payload: unknown): string | null {
	const record = toRecord(payload)
	if (!record) {
		return null
	}

	for (const key of FILE_URL_KEYS) {
		const value = record[key]
		if (typeof value === 'string' && value.trim().length) {
			const base = apiClient.defaults.baseURL || window.location.origin
			return new URL(value.trim(), base).toString()
		}
	}

	return findFileUrl(record.data)
}

function resolveFilename(
	contentDisposition: unknown,
	contractNumber: string,
): string {
	const header = typeof contentDisposition === 'string' ? contentDisposition : ''
	const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)
	if (encoded?.[1]) {
		try {
			return decodeURIComponent(encoded[1].replace(/"/g, ''))
		} catch {
			// Fall through to the plain filename.
		}
	}

	const plain = header.match(/filename="?([^";]+)"?/i)
	if (plain?.[1]) {
		return plain[1]
	}

	const suffix = contractNumber.trim().replace(/[^\w.-]+/g, '_') || 'document'
	return `shartnoma-${suffix}.docx`
}

function buildPayload(input: ContractDocumentInput): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		contract_type: input.contract_type,
		contract_date: input.contract_date.trim(),
		contract_number: input.contract_number.trim(),
		contract_place: input.contract_place.trim(),
		seller_organization_name: input.seller_organization_name.trim(),
		seller_director_full_name: input.seller_director_full_name.trim(),
		buyer_full_name: input.buyer_full_name.trim(),
		buyer_address: input.buyer_address.trim(),
		products: input.products.map(product => ({
			name: product.name.trim(),
			unit: product.unit.trim(),
			quantity: product.quantity.trim(),
			model: product.model.trim(),
			price: product.price.trim(),
		})),
		total_amount: input.total_amount.trim(),
		payment_method: input.payment_method.trim(),
		contract_end_date: input.contract_end_date.trim(),
		late_payment_daily_penalty_text: input.late_payment_daily_penalty_text.trim(),
	}

	// penalty_amount belongs to the retail sale template only.
	if (input.contract_type === 'retail_sale' && input.penalty_amount?.trim()) {
		payload.penalty_amount = input.penalty_amount.trim()
	}

	return payload
}

export async function generateContractDocument(
	input: ContractDocumentInput,
): Promise<ContractDocumentResult> {
	try {
		const response = await apiClient.post<Blob>(
			GENERATE_ENDPOINT,
			buildPayload(input),
			{ responseType: 'blob', headers: { Accept: '*/*' } },
		)

		const contentType = String(response.headers['content-type'] ?? '').toLowerCase()
		if (contentType.includes('application/json')) {
			const url = findFileUrl(await readBlobJson(response.data))
			return url ? { kind: 'link', url } : { kind: 'none' }
		}

		return {
			kind: 'file',
			blob: response.data,
			filename: resolveFilename(
				response.headers['content-disposition'],
				input.contract_number,
			),
		}
	} catch (error) {
		const response = toRecord(toRecord(error)?.response)
		if (response && response.data instanceof Blob) {
			response.data = await readBlobJson(response.data)
		}

		throw error
	}
}

export const apiContractDocumentService = {
	generate: generateContractDocument,
}
