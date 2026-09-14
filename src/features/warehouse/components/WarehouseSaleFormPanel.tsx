import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../../../components/shared/data'
import { services } from '../../../services'
import type { SelectOption } from '../../../types/common'
import type {
	WarehouseItem,
	WarehouseSale,
	WarehouseSaleInput,
} from '../../../types/warehouse'
import { parseWarehouseError } from '../utils/warehouse-errors'
import {
	WAREHOUSE_CURRENCIES,
	WAREHOUSE_PAYMENT_TYPES,
	formatMoney,
	formatQuantity,
	fromDateTimeInputValue,
	getCurrencyLabel,
	isDecimalString,
	normalizeDecimalInput,
	hasChangedFields,
	toDateTimeInputValue,
	toNumber,
} from '../utils/warehouse-format'
import WarehouseFormPanel, {
	WarehouseField,
	WarehouseReadonlyValue,
	warehouseInputClassName,
} from './WarehouseFormPanel'

interface WarehouseSaleFormPanelProps {
	/** `null` opens the create form. */
	saleId: string | null
	canManage: boolean
	items: WarehouseItem[]
	onClose: () => void
	onSaved: () => void
}

interface SaleFormState {
	item: string
	client: string
	client_name: string
	client_phone: string
	quantity: string
	currency: string
	unit_price: string
	paid_amount: string
	payment_type: string
	sold_at: string
	notes: string
}

interface ClientOption {
	id: string
	fullName: string
	phone: string
}

const CLIENT_FETCH_SIZE = 200

const FORM_FIELD_KEYS = [
	'item',
	'client',
	'client_name',
	'client_phone',
	'quantity',
	'currency',
	'unit_price',
	'paid_amount',
	'payment_type',
	'sold_at',
	'notes',
] as const

function createEmptyForm(): SaleFormState {
	return {
		item: '',
		client: '',
		client_name: '',
		client_phone: '',
		quantity: '',
		currency: 'uzs',
		unit_price: '',
		paid_amount: '',
		payment_type: 'cash',
		sold_at: toDateTimeInputValue(new Date().toISOString()),
		notes: '',
	}
}

function toFormState(sale: WarehouseSale): SaleFormState {
	return {
		item: sale.item,
		client: sale.client ?? '',
		client_name: sale.client_name,
		client_phone: sale.client_phone,
		quantity: sale.quantity,
		currency: sale.currency || 'uzs',
		unit_price: sale.unit_price,
		paid_amount: sale.paid_amount,
		payment_type: sale.payment_type,
		sold_at: toDateTimeInputValue(sale.sold_at),
		notes: sale.notes,
	}
}

function optionalDecimal(value: string): string | undefined {
	const normalized = normalizeDecimalInput(value)
	return normalized.length ? normalized : undefined
}

function toInput(form: SaleFormState): WarehouseSaleInput {
	return {
		item: form.item,
		client: form.client || null,
		client_name: form.client_name.trim(),
		client_phone: form.client_phone.trim(),
		quantity: normalizeDecimalInput(form.quantity),
		currency: form.currency,
		// Omitted unit_price keeps the sale's existing price on the backend.
		unit_price: optionalDecimal(form.unit_price),
		paid_amount: optionalDecimal(form.paid_amount),
		payment_type: form.payment_type || undefined,
		sold_at: fromDateTimeInputValue(form.sold_at),
		notes: form.notes.trim(),
	}
}

function WarehouseSaleFormPanel({
	saleId,
	canManage,
	items,
	onClose,
	onSaved,
}: WarehouseSaleFormPanelProps) {
	const { t, i18n } = useTranslation()
	const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ'
	const isEdit = saleId !== null

	const [sale, setSale] = useState<WarehouseSale | null>(null)
	const [initialForm, setInitialForm] = useState<SaleFormState>(createEmptyForm)
	const [form, setForm] = useState<SaleFormState>(createEmptyForm)
	const [clients, setClients] = useState<ClientOption[]>([])
	const [isLoading, setIsLoading] = useState(isEdit)
	const [loadError, setLoadError] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useEffect(() => {
		if (!saleId) {
			return
		}

		let isActive = true

		// Doc flow: open the edit form only after loading the sale detail.
		async function loadSale(id: string) {
			setIsLoading(true)
			setLoadError(false)

			try {
				const detail = await services.warehouse.getSale(id)
				if (!isActive) {
					return
				}

				const nextForm = toFormState(detail)
				setSale(detail)
				setInitialForm(nextForm)
				setForm(nextForm)
			} catch {
				if (isActive) {
					setLoadError(true)
				}
			} finally {
				if (isActive) {
					setIsLoading(false)
				}
			}
		}

		void loadSale(saleId)

		return () => {
			isActive = false
		}
	}, [saleId])

	useEffect(() => {
		let isActive = true

		async function loadClients() {
			try {
				const result = await services.clients.listClients({
					page: 1,
					page_size: CLIENT_FETCH_SIZE,
					ordering: '-created_at',
				})

				if (!isActive) {
					return
				}

				const rawClients: unknown[] = Array.isArray(result?.items) ? result.items : []
				setClients(
					rawClients.flatMap(raw => {
						const record = raw as Record<string, unknown>
						const id = typeof record.id === 'string' ? record.id : ''
						if (!id) {
							return []
						}

						return [
							{
								id,
								fullName: typeof record.full_name === 'string' ? record.full_name : '',
								phone: typeof record.phone === 'string' ? record.phone : '',
							},
						]
					}),
				)
			} catch {
				// Linking a CRM client is optional; the sale can still use name/phone.
				if (isActive) {
					setClients([])
				}
			}
		}

		void loadClients()

		return () => {
			isActive = false
		}
	}, [])

	const itemOptions = useMemo<SelectOption[]>(() => {
		const options: SelectOption[] = items.map(item => ({
			value: item.id,
			label: `${item.name} · ${formatQuantity(item.current_quantity, locale)} ${item.unit}`.trim(),
		}))

		if (sale?.item && !items.some(item => item.id === sale.item)) {
			options.unshift({ value: sale.item, label: sale.item_name || sale.item })
		}

		return [{ value: '', label: t('warehouse.form.selectItem') }, ...options]
	}, [items, locale, sale, t])

	const clientOptions = useMemo<SelectOption[]>(() => {
		const options: SelectOption[] = clients.map(client => ({
			value: client.id,
			label: [client.fullName || client.id, client.phone].filter(Boolean).join(' · '),
		}))

		if (sale?.client && !clients.some(client => client.id === sale.client)) {
			options.unshift({
				value: sale.client,
				label: [sale.client_name || sale.client, sale.client_phone]
					.filter(Boolean)
					.join(' · '),
			})
		}

		return [{ value: '', label: t('warehouse.saleForm.noClient') }, ...options]
	}, [clients, sale, t])

	const currencyOptions = useMemo(
		() =>
			WAREHOUSE_CURRENCIES.map(currency => ({
				value: currency,
				label: getCurrencyLabel(currency),
			})),
		[],
	)

	const paymentTypeOptions = useMemo<SelectOption[]>(() => {
		const known: string[] = [...WAREHOUSE_PAYMENT_TYPES]
		// Keep a backend value we don't know about selectable instead of silently swapping it.
		const values = known.includes(form.payment_type)
			? known
			: [form.payment_type, ...known]

		return values.map(value => ({
			value,
			label: value
				? t(`warehouse.paymentTypes.${value}`, { defaultValue: value })
				: '-',
		}))
	}, [form.payment_type, t])

	const selectedItem = items.find(item => item.id === form.item) ?? null

	function clearFieldError(key: string) {
		setFieldErrors(current => {
			if (!current[key]) {
				return current
			}

			const next = { ...current }
			delete next[key]
			return next
		})
	}

	function updateField<Key extends keyof SaleFormState>(
		key: Key,
		value: SaleFormState[Key],
	) {
		setForm(current => ({ ...current, [key]: value }))
		clearFieldError(key)
	}

	function handleItemChange(itemId: string) {
		const nextItem = items.find(item => item.id === itemId)

		setForm(current => {
			// New sale convenience: start from the item's default price if none typed yet.
			if (isEdit || !nextItem || current.unit_price.trim()) {
				return { ...current, item: itemId }
			}

			return {
				...current,
				item: itemId,
				unit_price: nextItem.default_price,
				currency: nextItem.default_currency || current.currency,
			}
		})
		clearFieldError('item')
	}

	function handleClientChange(clientId: string) {
		const nextClient = clients.find(client => client.id === clientId)

		setForm(current => ({
			...current,
			client: clientId,
			client_name: nextClient?.fullName || current.client_name,
			client_phone: nextClient?.phone || current.client_phone,
		}))
		clearFieldError('client')
	}

	function validate(): boolean {
		const errors: Record<string, string> = {}

		if (!form.item) {
			errors.item = t('warehouse.form.requiredError')
		}

		const quantity = toNumber(normalizeDecimalInput(form.quantity))
		if (quantity === null || quantity <= 0) {
			errors.quantity = t('warehouse.form.positiveNumberError')
		}

		;(['unit_price', 'paid_amount'] as const).forEach(key => {
			const value = form[key]
			if (value.trim() && (!isDecimalString(value) || Number(normalizeDecimalInput(value)) < 0)) {
				errors[key] = t('warehouse.form.numberError')
			}
		})

		setFieldErrors(errors)
		return Object.keys(errors).length === 0
	}

	async function handleSubmit() {
		setErrorMessage(null)

		if (!validate()) {
			return
		}

		const nextInput = toInput(form)
		// Doc: edit sends the full sale field set. `client: null` only unlinks a previously linked client.
		const payload: WarehouseSaleInput = {
			...nextInput,
			client: nextInput.client || (isEdit && initialForm.client ? null : undefined),
		}

		if (isEdit && !hasChangedFields(toInput(initialForm), nextInput)) {
			onClose()
			return
		}

		setIsSubmitting(true)

		try {
			if (saleId) {
				await services.warehouse.patchSale(saleId, payload)
			} else {
				await services.warehouse.createSale(payload)
			}

			onSaved()
		} catch (error) {
			const parsed = parseWarehouseError(
				error,
				t('warehouse.form.saveError'),
				FORM_FIELD_KEYS,
			)
			setFieldErrors(parsed.fieldErrors)
			setErrorMessage(parsed.message)
		} finally {
			setIsSubmitting(false)
		}
	}

	const readOnly = !canManage

	return (
		<WarehouseFormPanel
			eyebrow={t('warehouse.saleForm.eyebrow')}
			title={
				isEdit ? t('warehouse.saleForm.editTitle') : t('warehouse.saleForm.createTitle')
			}
			subtitle={
				isEdit
					? t('warehouse.saleForm.editSubtitle')
					: t('warehouse.saleForm.createSubtitle')
			}
			isLoading={isLoading}
			loadError={loadError}
			isSubmitting={isSubmitting}
			canSubmit={Boolean(form.item)}
			readOnly={readOnly}
			submitLabel={isEdit ? t('warehouse.form.save') : t('warehouse.form.create')}
			submittingLabel={t('warehouse.form.saving')}
			errorMessage={errorMessage}
			onClose={onClose}
			onSubmit={() => {
				void handleSubmit()
			}}
		>
			<div className='grid gap-2.5 sm:grid-cols-2'>
				{isEdit && sale ? (
					<WarehouseReadonlyValue
						label={t('warehouse.fields.total_amount')}
						value={formatMoney(sale.total_amount, sale.currency, locale)}
						hint={t('warehouse.form.totalAfterSaveHint')}
					/>
				) : null}
				{selectedItem ? (
					<WarehouseReadonlyValue
						label={t('warehouse.fields.current_quantity')}
						value={`${formatQuantity(selectedItem.current_quantity, locale)} ${selectedItem.unit}`}
						hint={
							isEdit
								? t('warehouse.saleForm.stockEditHint')
								: t('warehouse.saleForm.stockHint')
						}
					/>
				) : null}
			</div>

			<WarehouseField label={t('warehouse.fields.item')} error={fieldErrors.item}>
				<FilterSelect
					value={form.item}
					options={itemOptions}
					onChange={handleItemChange}
					disabled={readOnly || isSubmitting}
					searchable
				/>
			</WarehouseField>

			<div className='grid gap-3 sm:grid-cols-2'>
				<WarehouseField
					label={t('warehouse.fields.quantity')}
					htmlFor='warehouse-sale-quantity'
					error={fieldErrors.quantity}
				>
					<input
						id='warehouse-sale-quantity'
						className={warehouseInputClassName}
						inputMode='decimal'
						value={form.quantity}
						onChange={event => updateField('quantity', event.target.value)}
					/>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.currency')}
					error={fieldErrors.currency}
				>
					<FilterSelect
						value={form.currency}
						options={currencyOptions}
						onChange={value => updateField('currency', value)}
						disabled={readOnly || isSubmitting}
					/>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.unit_price')}
					htmlFor='warehouse-sale-unit-price'
					error={fieldErrors.unit_price}
					hint={isEdit ? t('warehouse.saleForm.unitPriceHint') : undefined}
				>
					<input
						id='warehouse-sale-unit-price'
						className={warehouseInputClassName}
						inputMode='decimal'
						value={form.unit_price}
						onChange={event => updateField('unit_price', event.target.value)}
					/>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.paid_amount')}
					htmlFor='warehouse-sale-paid-amount'
					error={fieldErrors.paid_amount}
				>
					<input
						id='warehouse-sale-paid-amount'
						className={warehouseInputClassName}
						inputMode='decimal'
						value={form.paid_amount}
						onChange={event => updateField('paid_amount', event.target.value)}
					/>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.payment_type')}
					error={fieldErrors.payment_type}
				>
					<FilterSelect
						value={form.payment_type}
						options={paymentTypeOptions}
						onChange={value => updateField('payment_type', value)}
						disabled={readOnly || isSubmitting}
					/>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.sold_at')}
					htmlFor='warehouse-sale-sold-at'
					error={fieldErrors.sold_at}
				>
					<input
						id='warehouse-sale-sold-at'
						type='datetime-local'
						className={warehouseInputClassName}
						value={form.sold_at}
						onChange={event => updateField('sold_at', event.target.value)}
					/>
				</WarehouseField>
			</div>

			<WarehouseField
				label={t('warehouse.fields.client')}
				error={fieldErrors.client}
				hint={t('warehouse.saleForm.clientHint')}
			>
				<FilterSelect
					value={form.client}
					options={clientOptions}
					onChange={handleClientChange}
					disabled={readOnly || isSubmitting}
					searchable
				/>
			</WarehouseField>

			<div className='grid gap-3 sm:grid-cols-2'>
				<WarehouseField
					label={t('warehouse.fields.client_name')}
					htmlFor='warehouse-sale-client-name'
					error={fieldErrors.client_name}
				>
					<input
						id='warehouse-sale-client-name'
						className={warehouseInputClassName}
						value={form.client_name}
						onChange={event => updateField('client_name', event.target.value)}
					/>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.client_phone')}
					htmlFor='warehouse-sale-client-phone'
					error={fieldErrors.client_phone}
				>
					<input
						id='warehouse-sale-client-phone'
						type='tel'
						className={warehouseInputClassName}
						value={form.client_phone}
						placeholder='+998901234567'
						onChange={event => updateField('client_phone', event.target.value)}
					/>
				</WarehouseField>
			</div>

			<WarehouseField
				label={t('warehouse.fields.notes')}
				htmlFor='warehouse-sale-notes'
				error={fieldErrors.notes}
			>
				<textarea
					id='warehouse-sale-notes'
					className={`${warehouseInputClassName} min-h-[88px] resize-y`}
					value={form.notes}
					onChange={event => updateField('notes', event.target.value)}
				/>
			</WarehouseField>
		</WarehouseFormPanel>
	)
}

export default WarehouseSaleFormPanel
