/**
 * Contract document generation (`POST /api/contracts/generate/`).
 *
 * Every value is sent as a string; dates use the `DD.MM.YYYY` format the
 * DOCX template prints as-is.
 */

export type ContractDocumentType = 'retail_sale' | 'guarantee'

export interface ContractDocumentProduct {
	name: string
	unit: string
	quantity: string
	model: string
	price: string
}

export interface ContractDocumentInput {
	contract_type: ContractDocumentType
	contract_date: string
	contract_number: string
	contract_place: string
	seller_organization_name: string
	seller_director_full_name: string
	buyer_full_name: string
	buyer_address: string
	products: ContractDocumentProduct[]
	total_amount: string
	payment_method: string
	contract_end_date: string
	late_payment_daily_penalty_text: string
	/** Only for `retail_sale`. */
	penalty_amount?: string
}

export type ContractDocumentResult =
	| { kind: 'file'; blob: Blob; filename: string }
	| { kind: 'link'; url: string }
	| { kind: 'none' }
