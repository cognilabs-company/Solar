/**
 * Warehouse (sklad) service.
 *
 * Items, stock entries (kirim) and sales live under `/api/warehouse/`. Edits
 * go through PATCH; the backend recalculates totals and stock balance and
 * rejects edits that would make stock negative with a 400.
 */

import { apiClient } from '../../lib/api-client'
import type {
	WarehouseItem,
	WarehouseItemInput,
	WarehouseListParams,
	WarehouseListResult,
	WarehouseSale,
	WarehouseSaleInput,
	WarehouseStats,
	WarehouseStockEntry,
	WarehouseStockEntryInput,
} from '../../types/warehouse'

const ITEMS_ENDPOINT = '/api/warehouse/items/'
const STOCK_ENTRIES_ENDPOINT = '/api/warehouse/stock-entries/'
const SALES_ENDPOINT = '/api/warehouse/sales/'
const STATS_ENDPOINT = '/api/warehouse/stats/'

function toRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null
	}

	return value as Record<string, unknown>
}

function unwrapData(payload: unknown): unknown {
	const record = toRecord(payload)
	if (record && 'data' in record && !('id' in record)) {
		return record.data
	}

	return payload
}

function readText(value: unknown): string {
	if (typeof value === 'string') {
		return value
	}

	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value)
	}

	return ''
}

function readOptionalText(value: unknown): string | undefined {
	const text = readText(value)
	return text.trim().length ? text : undefined
}

function readBoolean(value: unknown): boolean {
	if (typeof value === 'boolean') {
		return value
	}

	return typeof value === 'string' && value.trim().toLowerCase() === 'true'
}

/** FK fields can arrive as a plain id or as a nested object. */
function readReferenceId(value: unknown): string {
	const nested = toRecord(value)
	return nested ? readText(nested.id) : readText(value)
}

function readReferenceName(value: unknown, ...nameKeys: string[]): string {
	const nested = toRecord(value)
	if (!nested) {
		return ''
	}

	for (const key of nameKeys) {
		const name = readText(nested[key])
		if (name.trim().length) {
			return name
		}
	}

	return ''
}

function mapItem(payload: unknown): WarehouseItem {
	const dto = toRecord(unwrapData(payload)) ?? {}

	return {
		id: readText(dto.id),
		name: readText(dto.name),
		category: readText(dto.category),
		description: readText(dto.description),
		unit: readText(dto.unit),
		default_price: readText(dto.default_price),
		default_currency: readText(dto.default_currency),
		is_panel: readBoolean(dto.is_panel),
		panel_watt: readText(dto.panel_watt),
		panel_count: readText(dto.panel_count),
		panel_price: readText(dto.panel_price),
		low_stock_threshold: readText(dto.low_stock_threshold),
		current_quantity: readText(dto.current_quantity),
		is_low_stock:
			typeof dto.is_low_stock === 'boolean' ? dto.is_low_stock : null,
		panel_total_watt: readText(dto.panel_total_watt),
		panel_total_price: readText(dto.panel_total_price),
		created_at: readOptionalText(dto.created_at),
		updated_at: readOptionalText(dto.updated_at),
	}
}

function mapStockEntry(payload: unknown): WarehouseStockEntry {
	const dto = toRecord(unwrapData(payload)) ?? {}

	return {
		id: readText(dto.id),
		item: readReferenceId(dto.item),
		item_name:
			readText(dto.item_name) ||
			readReferenceName(dto.item, 'name') ||
			readReferenceName(dto.item_detail, 'name'),
		quantity: readText(dto.quantity),
		currency: readText(dto.currency),
		unit_cost: readText(dto.unit_cost),
		total_cost: readText(dto.total_cost),
		supplier_name: readText(dto.supplier_name),
		received_at: readOptionalText(dto.received_at),
		notes: readText(dto.notes),
		created_at: readOptionalText(dto.created_at),
		updated_at: readOptionalText(dto.updated_at),
	}
}

function mapSale(payload: unknown): WarehouseSale {
	const dto = toRecord(unwrapData(payload)) ?? {}
	const clientId = readReferenceId(dto.client)

	return {
		id: readText(dto.id),
		item: readReferenceId(dto.item),
		item_name:
			readText(dto.item_name) ||
			readReferenceName(dto.item, 'name') ||
			readReferenceName(dto.item_detail, 'name'),
		client: clientId || null,
		client_name:
			readText(dto.client_name) ||
			readReferenceName(dto.client, 'full_name', 'name'),
		client_phone:
			readText(dto.client_phone) || readReferenceName(dto.client, 'phone'),
		quantity: readText(dto.quantity),
		currency: readText(dto.currency),
		unit_price: readText(dto.unit_price),
		total_amount: readText(dto.total_amount),
		paid_amount: readText(dto.paid_amount),
		payment_type: readText(dto.payment_type),
		sold_at: readOptionalText(dto.sold_at),
		notes: readText(dto.notes),
		created_at: readOptionalText(dto.created_at),
		updated_at: readOptionalText(dto.updated_at),
	}
}

function mapList<T>(
	payload: unknown,
	mapper: (item: unknown) => T,
): WarehouseListResult<T> {
	// `{ data: [...], meta: {...} }` keeps its meta; `{ status, data: { results } }` is unwrapped.
	const data = Array.isArray(toRecord(payload)?.data) ? payload : unwrapData(payload)

	if (Array.isArray(data)) {
		return { items: data.map(mapper), totalItems: data.length }
	}

	const record = toRecord(data) ?? {}
	const rawItems = Array.isArray(record.results)
		? record.results
		: Array.isArray(record.items)
			? record.items
			: Array.isArray(record.data)
				? record.data
				: []
	const meta = toRecord(record.meta) ?? toRecord(record.pagination) ?? {}
	const total = [record.count, record.total, record.total_count, meta.count, meta.total].find(
		value => typeof value === 'number',
	)

	return {
		items: rawItems.map(mapper),
		totalItems: typeof total === 'number' ? total : rawItems.length,
	}
}

function toListQuery(params?: WarehouseListParams) {
	return {
		page: params?.page,
		page_size: params?.pageSize,
		search: params?.search || undefined,
		ordering: params?.ordering,
	}
}

/**
 * Undefined keys are dropped. Edits send the full documented field set so the
 * backend can recalculate stock from `item` and `quantity`; read-only totals
 * are never part of the input.
 */
function toPayload(input: object): Record<string, unknown> {
	const payload: Record<string, unknown> = {}

	Object.entries(input).forEach(([key, value]) => {
		if (value === undefined) {
			return
		}

		payload[key] = typeof value === 'string' ? value.trim() : value
	})

	return payload
}

export async function listWarehouseItems(
	params?: WarehouseListParams,
): Promise<WarehouseListResult<WarehouseItem>> {
	const { data } = await apiClient.get<unknown>(ITEMS_ENDPOINT, {
		params: toListQuery(params),
	})
	return mapList(data, mapItem)
}

export async function getWarehouseItem(id: string): Promise<WarehouseItem> {
	const { data } = await apiClient.get<unknown>(`${ITEMS_ENDPOINT}${id}/`)
	return mapItem(data)
}

export async function createWarehouseItem(
	input: WarehouseItemInput,
): Promise<WarehouseItem> {
	const { data } = await apiClient.post<unknown>(ITEMS_ENDPOINT, toPayload(input))
	return mapItem(data)
}

export async function patchWarehouseItem(
	id: string,
	input: WarehouseItemInput,
): Promise<WarehouseItem> {
	const { data } = await apiClient.patch<unknown>(
		`${ITEMS_ENDPOINT}${id}/`,
		toPayload(input),
	)
	return mapItem(data)
}

export async function listWarehouseStockEntries(
	params?: WarehouseListParams,
): Promise<WarehouseListResult<WarehouseStockEntry>> {
	const { data } = await apiClient.get<unknown>(STOCK_ENTRIES_ENDPOINT, {
		params: toListQuery(params),
	})
	return mapList(data, mapStockEntry)
}

export async function getWarehouseStockEntry(
	id: string,
): Promise<WarehouseStockEntry> {
	const { data } = await apiClient.get<unknown>(`${STOCK_ENTRIES_ENDPOINT}${id}/`)
	return mapStockEntry(data)
}

export async function createWarehouseStockEntry(
	input: WarehouseStockEntryInput,
): Promise<WarehouseStockEntry> {
	const { data } = await apiClient.post<unknown>(
		STOCK_ENTRIES_ENDPOINT,
		toPayload(input),
	)
	return mapStockEntry(data)
}

export async function patchWarehouseStockEntry(
	id: string,
	input: WarehouseStockEntryInput,
): Promise<WarehouseStockEntry> {
	const { data } = await apiClient.patch<unknown>(
		`${STOCK_ENTRIES_ENDPOINT}${id}/`,
		toPayload(input),
	)
	return mapStockEntry(data)
}

export async function deleteWarehouseStockEntry(id: string): Promise<void> {
	await apiClient.delete(`${STOCK_ENTRIES_ENDPOINT}${id}/`)
}

export async function listWarehouseSales(
	params?: WarehouseListParams,
): Promise<WarehouseListResult<WarehouseSale>> {
	const { data } = await apiClient.get<unknown>(SALES_ENDPOINT, {
		params: toListQuery(params),
	})
	return mapList(data, mapSale)
}

export async function getWarehouseSale(id: string): Promise<WarehouseSale> {
	const { data } = await apiClient.get<unknown>(`${SALES_ENDPOINT}${id}/`)
	return mapSale(data)
}

export async function createWarehouseSale(
	input: WarehouseSaleInput,
): Promise<WarehouseSale> {
	const { data } = await apiClient.post<unknown>(SALES_ENDPOINT, toPayload(input))
	return mapSale(data)
}

export async function patchWarehouseSale(
	id: string,
	input: WarehouseSaleInput,
): Promise<WarehouseSale> {
	const { data } = await apiClient.patch<unknown>(
		`${SALES_ENDPOINT}${id}/`,
		toPayload(input),
	)
	return mapSale(data)
}

export async function deleteWarehouseSale(id: string): Promise<void> {
	await apiClient.delete(`${SALES_ENDPOINT}${id}/`)
}

export async function getWarehouseStats(): Promise<WarehouseStats> {
	const { data } = await apiClient.get<unknown>(STATS_ENDPOINT)
	return toRecord(unwrapData(data)) ?? {}
}

export const apiWarehouseService = {
	listItems: listWarehouseItems,
	getItem: getWarehouseItem,
	createItem: createWarehouseItem,
	patchItem: patchWarehouseItem,
	listStockEntries: listWarehouseStockEntries,
	getStockEntry: getWarehouseStockEntry,
	createStockEntry: createWarehouseStockEntry,
	patchStockEntry: patchWarehouseStockEntry,
	deleteStockEntry: deleteWarehouseStockEntry,
	listSales: listWarehouseSales,
	getSale: getWarehouseSale,
	createSale: createWarehouseSale,
	patchSale: patchWarehouseSale,
	deleteSale: deleteWarehouseSale,
	getStats: getWarehouseStats,
}
