/**
 * Warehouse (sklad) contracts.
 *
 * Backend owns every derived number: `current_quantity`, `total_cost`,
 * `total_amount`, `panel_total_watt` and `panel_total_price` are read-only and
 * are only rendered, never computed or sent by the frontend.
 */

export type WarehouseCurrency = 'uzs' | 'usd'

export interface WarehouseItem {
	id: string
	name: string
	category: string
	description: string
	unit: string
	default_price: string
	default_currency: string
	is_panel: boolean
	panel_watt: string
	panel_count: string
	panel_price: string
	low_stock_threshold: string
	/** Read-only. */
	current_quantity: string
	/** Read-only, only when the backend exposes it. */
	is_low_stock: boolean | null
	/** Read-only. */
	panel_total_watt: string
	/** Read-only. */
	panel_total_price: string
	created_at?: string
	updated_at?: string
}

export interface WarehouseItemInput {
	name?: string
	category?: string
	description?: string
	unit?: string
	default_price?: string
	default_currency?: string
	is_panel?: boolean
	panel_watt?: string
	panel_count?: string
	panel_price?: string
	low_stock_threshold?: string
}

export interface WarehouseStockEntry {
	id: string
	item: string
	item_name: string
	quantity: string
	currency: string
	unit_cost: string
	/** Read-only. */
	total_cost: string
	supplier_name: string
	received_at?: string
	notes: string
	created_at?: string
	updated_at?: string
}

export interface WarehouseStockEntryInput {
	item?: string
	quantity?: string
	currency?: string
	unit_cost?: string
	supplier_name?: string
	received_at?: string
	notes?: string
}

export interface WarehouseSale {
	id: string
	item: string
	item_name: string
	client: string | null
	client_name: string
	client_phone: string
	quantity: string
	currency: string
	unit_price: string
	/** Read-only. */
	total_amount: string
	paid_amount: string
	payment_type: string
	sold_at?: string
	notes: string
	created_at?: string
	updated_at?: string
}

export interface WarehouseSaleInput {
	item?: string
	client?: string | null
	client_name?: string
	client_phone?: string
	quantity?: string
	currency?: string
	unit_price?: string
	paid_amount?: string
	payment_type?: string
	sold_at?: string
	notes?: string
}

export interface WarehouseListParams {
	page?: number
	pageSize?: number
	search?: string
	ordering?: string
}

export interface WarehouseListResult<T> {
	items: T[]
	totalItems: number
}

/** Stats payload is rendered generically: top-level key -> number or per-currency map. */
export type WarehouseStats = Record<string, unknown>
