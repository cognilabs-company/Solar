import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../../../components/shared/data'
import AppIcon from '../../../components/shared/icons/AppIcon'
import { usePersistentState } from '../../../lib/persistent-state'
import { services } from '../../../services'
import type {
	ContractDocumentInput,
	ContractDocumentType,
} from '../../../types/contract-document'
import { parseApiError } from '../../subsidy/utils/subsidy-errors'
import {
	formatAmountInput,
	parseAmountInput,
} from '../../subsidy/utils/subsidy-format'

export interface ContractDocumentFormPanelProps {
	onClose: () => void
	onGenerated?: () => void
}

interface ProductRow {
	key: number
	name: string
	unit: string
	quantity: string
	model: string
	price: string
}

interface DocumentFormState {
	contract_type: ContractDocumentType
	contract_date: string
	contract_number: string
	contract_place: string
	seller_organization_name: string
	seller_director_full_name: string
	buyer_full_name: string
	buyer_address: string
	total_amount: string
	payment_method: string
	contract_end_date: string
	late_payment_daily_penalty_text: string
	penalty_amount: string
}

interface SellerDefaults {
	contract_place: string
	seller_organization_name: string
	seller_director_full_name: string
}

type ProductErrors = Record<number, Partial<Record<keyof Omit<ProductRow, 'key'>, string>>>

const inputClassName = [
	'w-full rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 text-sm font-medium text-text-primary',
	'placeholder:text-text-muted outline-none transition duration-fast',
	'focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
	'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ')

const labelClassName =
	'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'

const sectionClassName =
	'grid gap-3 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40'

const CONTRACT_TYPES: ContractDocumentType[] = ['retail_sale', 'guarantee']

const PAYMENT_METHOD_SUGGESTIONS = ['Naqd', 'Plastik karta', "Bank o'tkazmasi"]

const REQUIRED_FIELDS = [
	'contract_date',
	'contract_number',
	'buyer_full_name',
	'total_amount',
] as const

let productRowKey = 0

function createProductRow(): ProductRow {
	productRowKey += 1
	return { key: productRowKey, name: '', unit: 'Dona', quantity: '', model: '', price: '' }
}

function todayInputValue(): string {
	const now = new Date()
	const month = String(now.getMonth() + 1).padStart(2, '0')
	const day = String(now.getDate()).padStart(2, '0')
	return `${now.getFullYear()}-${month}-${day}`
}

/** `2026-09-14` (date input) -> `14.09.2026` (template format). */
function toDocumentDate(value: string): string {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	return match ? `${match[3]}.${match[2]}.${match[1]}` : value
}

function normalizeQuantity(value: string): string {
	return value.replace(/\s/g, '').replace(',', '.')
}

function readFirstMessage(value: unknown): string | null {
	if (typeof value === 'string' && value.trim().length) {
		return value.trim()
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			const message = readFirstMessage(item)
			if (message) {
				return message
			}
		}
	}

	if (value && typeof value === 'object') {
		for (const item of Object.values(value)) {
			const message = readFirstMessage(item)
			if (message) {
				return message
			}
		}
	}

	return null
}

/** DRF nested list errors: `{"products": [{}, {"price": ["..."]}]}`. */
function readProductErrors(error: unknown): ProductErrors {
	const data = (error as { response?: { data?: unknown } })?.response?.data
	const products = (data as { products?: unknown } | null)?.products
	if (!Array.isArray(products)) {
		return {}
	}

	const result: ProductErrors = {}
	products.forEach((rowErrors, index) => {
		if (!rowErrors || typeof rowErrors !== 'object' || Array.isArray(rowErrors)) {
			return
		}

		Object.entries(rowErrors).forEach(([field, value]) => {
			const message = readFirstMessage(value)
			if (message) {
				result[index] = { ...result[index], [field]: message }
			}
		})
	})

	return result
}

function ContractDocumentFormPanel({ onClose, onGenerated }: ContractDocumentFormPanelProps) {
	const { t } = useTranslation()
	const [sellerDefaults, setSellerDefaults] = usePersistentState<SellerDefaults>(
		'contracts:document-seller',
		{ contract_place: '', seller_organization_name: '', seller_director_full_name: '' },
	)

	const [form, setForm] = useState<DocumentFormState>(() => ({
		contract_type: 'retail_sale',
		contract_date: todayInputValue(),
		contract_number: '',
		contract_place: sellerDefaults.contract_place,
		seller_organization_name: sellerDefaults.seller_organization_name,
		seller_director_full_name: sellerDefaults.seller_director_full_name,
		buyer_full_name: '',
		buyer_address: '',
		total_amount: '',
		payment_method: 'Naqd',
		contract_end_date: '',
		late_payment_daily_penalty_text: '',
		penalty_amount: '',
	}))
	const [products, setProducts] = useState<ProductRow[]>(() => [createProductRow()])
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
	const [productErrors, setProductErrors] = useState<ProductErrors>({})
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [successMessage, setSuccessMessage] = useState<string | null>(null)
	const [generatedLink, setGeneratedLink] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const isRetailSale = form.contract_type === 'retail_sale'

	const contractTypeOptions = useMemo(
		() =>
			CONTRACT_TYPES.map(type => ({
				value: type,
				label: t(`contractsPage.document.types.${type}`),
			})),
		[t],
	)

	const productsTotal = useMemo(
		() =>
			products.reduce((sum, product) => {
				const quantity = Number(normalizeQuantity(product.quantity))
				const price = Number(parseAmountInput(product.price))
				return Number.isFinite(quantity) && Number.isFinite(price)
					? sum + quantity * price
					: sum
			}, 0),
		[products],
	)

	function updateField<Key extends keyof DocumentFormState>(
		key: Key,
		value: DocumentFormState[Key],
	) {
		setForm(current => ({ ...current, [key]: value }))
		setFieldErrors(current => {
			if (!current[key]) {
				return current
			}

			const next = { ...current }
			delete next[key]
			return next
		})
	}

	function updateProduct(index: number, key: keyof Omit<ProductRow, 'key'>, value: string) {
		setProducts(current =>
			current.map((product, productIndex) =>
				productIndex === index ? { ...product, [key]: value } : product,
			),
		)
		setProductErrors(current => {
			if (!current[index]?.[key]) {
				return current
			}

			return { ...current, [index]: { ...current[index], [key]: undefined } }
		})
	}

	function removeProduct(index: number) {
		setProducts(current => current.filter((_, productIndex) => productIndex !== index))
		setProductErrors({})
	}

	function validate(): boolean {
		const errors: Record<string, string> = {}
		REQUIRED_FIELDS.forEach(key => {
			if (!form[key].trim()) {
				errors[key] = t('contractsPage.document.requiredError')
			}
		})

		const rowErrors: ProductErrors = {}
		products.forEach((product, index) => {
			if (!product.name.trim()) {
				rowErrors[index] = { ...rowErrors[index], name: t('contractsPage.document.requiredError') }
			}
			const quantity = Number(normalizeQuantity(product.quantity))
			if (!product.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) {
				rowErrors[index] = { ...rowErrors[index], quantity: t('contractsPage.document.numberError') }
			}
			if (!parseAmountInput(product.price)) {
				rowErrors[index] = { ...rowErrors[index], price: t('contractsPage.document.requiredError') }
			}
		})

		if (!products.length) {
			errors.products = t('contractsPage.document.productsRequired')
		}

		setFieldErrors(errors)
		setProductErrors(rowErrors)
		return Object.keys(errors).length === 0 && Object.keys(rowErrors).length === 0
	}

	function toInput(): ContractDocumentInput {
		return {
			contract_type: form.contract_type,
			contract_date: toDocumentDate(form.contract_date),
			contract_number: form.contract_number,
			contract_place: form.contract_place,
			seller_organization_name: form.seller_organization_name,
			seller_director_full_name: form.seller_director_full_name,
			buyer_full_name: form.buyer_full_name,
			buyer_address: form.buyer_address,
			products: products.map(product => ({
				name: product.name,
				unit: product.unit,
				quantity: normalizeQuantity(product.quantity),
				model: product.model,
				price: parseAmountInput(product.price),
			})),
			total_amount: parseAmountInput(form.total_amount),
			payment_method: form.payment_method,
			contract_end_date: toDocumentDate(form.contract_end_date),
			late_payment_daily_penalty_text: form.late_payment_daily_penalty_text,
			penalty_amount: isRetailSale ? parseAmountInput(form.penalty_amount) : undefined,
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setErrorMessage(null)
		setSuccessMessage(null)
		setGeneratedLink(null)

		if (isSubmitting || !validate()) {
			return
		}

		setIsSubmitting(true)

		try {
			const result = await services.contractDocuments.generate(toInput())

			if (result.kind === 'file') {
				const url = window.URL.createObjectURL(result.blob)
				const anchor = document.createElement('a')
				anchor.href = url
				anchor.download = result.filename
				document.body.appendChild(anchor)
				anchor.click()
				anchor.remove()
				window.URL.revokeObjectURL(url)
			} else if (result.kind === 'link') {
				setGeneratedLink(result.url)
			}

			setSellerDefaults({
				contract_place: form.contract_place.trim(),
				seller_organization_name: form.seller_organization_name.trim(),
				seller_director_full_name: form.seller_director_full_name.trim(),
			})
			setSuccessMessage(
				result.kind === 'file'
					? t('contractsPage.document.downloaded')
					: t('contractsPage.document.generated'),
			)
			onGenerated?.()
		} catch (error) {
			const parsed = parseApiError(error, t('contractsPage.document.generateError'))
			const nextProductErrors = readProductErrors(error)
			setFieldErrors(parsed.fieldErrors)
			setProductErrors(nextProductErrors)
			setErrorMessage(
				parsed.message ??
					Object.values(parsed.fieldErrors)[0] ??
					readFirstMessage(nextProductErrors) ??
					t('contractsPage.document.generateError'),
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	function renderField(
		key: keyof DocumentFormState,
		label: string,
		input: ReactNode,
		options?: { hint?: string; className?: string },
	) {
		return (
			<div className={['grid content-start gap-1.5', options?.className ?? ''].join(' ')}>
				<label className={labelClassName} htmlFor={`contract-document-${key}`}>
					{label}
				</label>
				{input}
				{options?.hint ? (
					<p className='m-0 text-[12px] leading-5 text-text-muted'>{options.hint}</p>
				) : null}
				{fieldErrors[key] ? (
					<p className='m-0 text-[12px] font-semibold text-danger'>{fieldErrors[key]}</p>
				) : null}
			</div>
		)
	}

	function textInput(key: keyof DocumentFormState, props?: { placeholder?: string; list?: string }) {
		return (
			<input
				id={`contract-document-${key}`}
				className={inputClassName}
				value={form[key]}
				placeholder={props?.placeholder}
				list={props?.list}
				onChange={event => updateField(key, event.target.value)}
			/>
		)
	}

	function amountInput(key: 'total_amount' | 'penalty_amount', placeholder: string) {
		return (
			<div className='relative'>
				<input
					id={`contract-document-${key}`}
					className={`${inputClassName} pr-14`}
					inputMode='numeric'
					value={form[key]}
					placeholder={placeholder}
					onChange={event => updateField(key, formatAmountInput(event.target.value))}
				/>
				<span className='pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] font-semibold text-text-muted'>
					{t('contractsPage.document.currency')}
				</span>
			</div>
		)
	}

	return (
		<div
			className='fixed inset-0 z-[150] flex justify-end bg-background-overlay/72 backdrop-blur-[3px]'
			role='presentation'
			onClick={() => {
				if (!isSubmitting) {
					onClose()
				}
			}}
		>
			<aside
				className='h-full w-full max-w-[760px] overflow-x-hidden overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:p-5'
				onClick={event => event.stopPropagation()}
				aria-label={t('contractsPage.document.title')}
			>
				<header className='mb-4 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40'>
					<div className='flex items-start justify-between gap-3'>
						<div className='min-w-0'>
							<p className='m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary'>
								{t('contractsPage.document.eyebrow')}
							</p>
							<h2 className='mt-1 font-display text-[1.45rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-text-primary'>
								{t('contractsPage.document.title')}
							</h2>
							<p className='mt-1.5 text-sm leading-6 text-text-secondary'>
								{t('contractsPage.document.subtitle')}
							</p>
						</div>
						<button
							type='button'
							className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60'
							onClick={onClose}
							disabled={isSubmitting}
							aria-label={t('contractsPage.document.close')}
						>
							<AppIcon name='close' className='h-4.5 w-4.5' aria-hidden='true' />
						</button>
					</div>
				</header>

				<form className='grid gap-3' onSubmit={event => void handleSubmit(event)} noValidate>
					<fieldset className='m-0 grid min-w-0 gap-3 border-0 p-0' disabled={isSubmitting}>
						<section className={sectionClassName}>
							<div className='grid gap-3 sm:grid-cols-2'>
								<div className='grid content-start gap-1.5'>
									<span className={labelClassName}>{t('contractsPage.document.fields.contract_type')}</span>
									<FilterSelect
										value={form.contract_type}
										options={contractTypeOptions}
										onChange={value => updateField('contract_type', value as ContractDocumentType)}
										disabled={isSubmitting}
									/>
								</div>
								{renderField('contract_number', t('contractsPage.document.fields.contract_number'), textInput('contract_number', { placeholder: '100' }))}
								{renderField(
									'contract_date',
									t('contractsPage.document.fields.contract_date'),
									<input
										id='contract-document-contract_date'
										type='date'
										className={inputClassName}
										value={form.contract_date}
										onChange={event => updateField('contract_date', event.target.value)}
									/>,
								)}
								{renderField('contract_place', t('contractsPage.document.fields.contract_place'), textInput('contract_place', { placeholder: "Bog'ot tumani" }))}
							</div>
						</section>

						<section className={sectionClassName}>
							<p className='m-0 text-sm font-semibold text-text-primary'>{t('contractsPage.document.sections.parties')}</p>
							<div className='grid gap-3 sm:grid-cols-2'>
								{renderField('seller_organization_name', t('contractsPage.document.fields.seller_organization_name'), textInput('seller_organization_name'))}
								{renderField('seller_director_full_name', t('contractsPage.document.fields.seller_director_full_name'), textInput('seller_director_full_name'))}
								{renderField('buyer_full_name', t('contractsPage.document.fields.buyer_full_name'), textInput('buyer_full_name'))}
								{renderField('buyer_address', t('contractsPage.document.fields.buyer_address'), textInput('buyer_address'))}
							</div>
						</section>

						<section className={sectionClassName}>
							<div className='flex flex-wrap items-center justify-between gap-2'>
								<p className='m-0 text-sm font-semibold text-text-primary'>{t('contractsPage.document.sections.products')}</p>
								<button
									type='button'
									className='inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface-subtle px-3 text-sm font-semibold text-text-primary transition duration-fast hover:bg-surface-muted'
									onClick={() => setProducts(current => [...current, createProductRow()])}
								>
									<AppIcon name='plus' className='h-4 w-4' aria-hidden='true' />
									{t('contractsPage.document.addProduct')}
								</button>
							</div>

							{products.map((product, index) => (
								<div key={product.key} className='grid gap-2 rounded-lg bg-surface-subtle/70 p-3 ring-1 ring-border-soft/25'>
									<div className='flex items-center justify-between gap-2'>
										<span className={labelClassName}>
											{t('contractsPage.document.productNumber', { number: index + 1 })}
										</span>
										{products.length > 1 ? (
											<button
												type='button'
												className='inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-card text-danger shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-danger/5'
												onClick={() => removeProduct(index)}
												aria-label={t('contractsPage.document.removeProduct')}
											>
												<FiTrash2 className='h-4 w-4' />
											</button>
										) : null}
									</div>
									<div className='grid gap-2 sm:grid-cols-6'>
										{(
											[
												['name', 'sm:col-span-3', 'Quyosh panel', 'text'],
												['model', 'sm:col-span-3', 'Jinko', 'text'],
												['unit', 'sm:col-span-2', 'Dona', 'text'],
												['quantity', 'sm:col-span-1', '2', 'decimal'],
												['price', 'sm:col-span-3', '40 000 000', 'numeric'],
											] as const
										).map(([key, span, placeholder, inputMode]) => (
											<div key={key} className={`grid content-start gap-1 ${span}`}>
												<label className={labelClassName} htmlFor={`contract-document-product-${product.key}-${key}`}>
													{t(`contractsPage.document.productFields.${key}`)}
												</label>
												<input
													id={`contract-document-product-${product.key}-${key}`}
													className={inputClassName}
													inputMode={inputMode}
													value={product[key]}
													placeholder={placeholder}
													onChange={event =>
														updateProduct(
															index,
															key,
															key === 'price' ? formatAmountInput(event.target.value) : event.target.value,
														)
													}
												/>
												{productErrors[index]?.[key] ? (
													<p className='m-0 text-[12px] font-semibold text-danger'>{productErrors[index]?.[key]}</p>
												) : null}
											</div>
										))}
									</div>
								</div>
							))}
							{fieldErrors.products ? (
								<p className='m-0 text-[12px] font-semibold text-danger'>{fieldErrors.products}</p>
							) : null}
						</section>

						<section className={sectionClassName}>
							<p className='m-0 text-sm font-semibold text-text-primary'>{t('contractsPage.document.sections.payment')}</p>
							<div className='grid gap-3 sm:grid-cols-2'>
								{renderField(
									'total_amount',
									t('contractsPage.document.fields.total_amount'),
									<>
										{amountInput('total_amount', '80 000 000')}
										{productsTotal > 0 ? (
											<button
												type='button'
												className='justify-self-start text-[12px] font-semibold text-text-accent hover:underline'
												onClick={() =>
													updateField('total_amount', formatAmountInput(String(Math.round(productsTotal))))
												}
											>
												{t('contractsPage.document.fillTotal', {
													amount: formatAmountInput(String(Math.round(productsTotal))),
												})}
											</button>
										) : null}
									</>,
								)}
								{renderField(
									'payment_method',
									t('contractsPage.document.fields.payment_method'),
									<>
										{textInput('payment_method', { list: 'contract-document-payment-methods' })}
										<datalist id='contract-document-payment-methods'>
											{PAYMENT_METHOD_SUGGESTIONS.map(method => (
												<option key={method} value={method} />
											))}
										</datalist>
									</>,
								)}
								{renderField(
									'contract_end_date',
									t('contractsPage.document.fields.contract_end_date'),
									<input
										id='contract-document-contract_end_date'
										type='date'
										className={inputClassName}
										value={form.contract_end_date}
										onChange={event => updateField('contract_end_date', event.target.value)}
									/>,
								)}
								{renderField(
									'late_payment_daily_penalty_text',
									t('contractsPage.document.fields.late_payment_daily_penalty_text'),
									textInput('late_payment_daily_penalty_text', { placeholder: '1' }),
									{ hint: t('contractsPage.document.latePenaltyHint') },
								)}
								{isRetailSale
									? renderField(
											'penalty_amount',
											t('contractsPage.document.fields.penalty_amount'),
											amountInput('penalty_amount', '15 000 000'),
											{ hint: t('contractsPage.document.penaltyHint'), className: 'sm:col-span-2' },
										)
									: null}
							</div>
						</section>
					</fieldset>

					{errorMessage ? (
						<p className='m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger'>{errorMessage}</p>
					) : null}

					{successMessage ? (
						<div className='flex flex-wrap items-center gap-2 rounded-lg bg-success-bg px-3 py-2 text-sm font-semibold text-success'>
							<span>{successMessage}</span>
							{generatedLink ? (
								<a className='underline' href={generatedLink} target='_blank' rel='noreferrer'>
									{t('contractsPage.document.openFile')}
								</a>
							) : null}
						</div>
					) : null}

					<div className='mt-1 flex flex-wrap items-center gap-2'>
						<button
							type='button'
							className='inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-card px-4 text-sm font-semibold text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60'
							onClick={onClose}
							disabled={isSubmitting}
						>
							{t('contractsPage.document.close')}
						</button>
						<button
							type='submit'
							className='ml-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60'
							disabled={isSubmitting}
						>
							<AppIcon name='download' className='h-4 w-4' aria-hidden='true' />
							{isSubmitting ? t('contractsPage.document.generating') : t('contractsPage.document.generate')}
						</button>
					</div>
				</form>
			</aside>
		</div>
	)
}

export default ContractDocumentFormPanel
