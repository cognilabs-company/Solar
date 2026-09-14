import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../../../components/shared/data'
import { services } from '../../../services'
import type { SelectOption } from '../../../types/common'
import type {
	WarehouseItem,
	WarehouseStockEntry,
	WarehouseStockEntryInput,
} from '../../../types/warehouse'
import { parseWarehouseError } from '../utils/warehouse-errors'
import {
	WAREHOUSE_CURRENCIES,
	formatMoney,
	formatQuantity,
	fromDateTimeInputValue,
	getCurrencyLabel,
	isDecimalString,
	normalizeDecimalInput,
	pickChangedFields,
	toDateTimeInputValue,
	toNumber,
} from '../utils/warehouse-format'
import WarehouseFormPanel, {
	WarehouseField,
	WarehouseReadonlyValue,
	warehouseInputClassName,
} from './WarehouseFormPanel'

interface WarehouseStockEntryFormPanelProps {
	/** `null` opens the create form. */
	entryId: string | null
	canManage: boolean
	items: WarehouseItem[]
	onClose: () => void
	onSaved: () => void
}

interface StockEntryFormState {
	item: string
	quantity: string
	currency: string
	unit_cost: string
	supplier_name: string
	received_at: string
	notes: string
}

const FORM_FIELD_KEYS = [
	'item',
	'quantity',
	'currency',
	'unit_cost',
	'supplier_name',
	'received_at',
	'notes',
] as const

function createEmptyForm(): StockEntryFormState {
	return {
		item: '',
		quantity: '',
		currency: 'uzs',
		unit_cost: '',
		supplier_name: '',
		received_at: toDateTimeInputValue(new Date().toISOString()),
		notes: '',
	}
}

function toFormState(entry: WarehouseStockEntry): StockEntryFormState {
	return {
		item: entry.item,
		quantity: entry.quantity,
		currency: entry.currency || 'uzs',
		unit_cost: entry.unit_cost,
		supplier_name: entry.supplier_name,
		received_at: toDateTimeInputValue(entry.received_at),
		notes: entry.notes,
	}
}

function toInput(form: StockEntryFormState): WarehouseStockEntryInput {
	return {
		item: form.item,
		quantity: normalizeDecimalInput(form.quantity),
		currency: form.currency,
		unit_cost: normalizeDecimalInput(form.unit_cost),
		supplier_name: form.supplier_name.trim(),
		received_at: fromDateTimeInputValue(form.received_at),
		notes: form.notes.trim(),
	}
}

function WarehouseStockEntryFormPanel({
	entryId,
	canManage,
	items,
	onClose,
	onSaved,
}: WarehouseStockEntryFormPanelProps) {
	const { t, i18n } = useTranslation()
	const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ'
	const isEdit = entryId !== null

	const [entry, setEntry] = useState<WarehouseStockEntry | null>(null)
	const [initialForm, setInitialForm] = useState<StockEntryFormState>(createEmptyForm)
	const [form, setForm] = useState<StockEntryFormState>(createEmptyForm)
	const [isLoading, setIsLoading] = useState(isEdit)
	const [loadError, setLoadError] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useEffect(() => {
		if (!entryId) {
			return
		}

		let isActive = true

		// Doc flow: open the edit form only after loading the entry detail.
		async function loadEntry(id: string) {
			setIsLoading(true)
			setLoadError(false)

			try {
				const detail = await services.warehouse.getStockEntry(id)
				if (!isActive) {
					return
				}

				const nextForm = toFormState(detail)
				setEntry(detail)
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

		void loadEntry(entryId)

		return () => {
			isActive = false
		}
	}, [entryId])

	const itemOptions = useMemo<SelectOption[]>(() => {
		const options: SelectOption[] = items.map(item => ({
			value: item.id,
			label: `${item.name} · ${formatQuantity(item.current_quantity, locale)} ${item.unit}`.trim(),
		}))

		if (entry?.item && !items.some(item => item.id === entry.item)) {
			options.unshift({ value: entry.item, label: entry.item_name || entry.item })
		}

		return [{ value: '', label: t('warehouse.form.selectItem') }, ...options]
	}, [entry, items, locale, t])

	const currencyOptions = useMemo(
		() =>
			WAREHOUSE_CURRENCIES.map(currency => ({
				value: currency,
				label: getCurrencyLabel(currency),
			})),
		[],
	)

	const selectedItem = items.find(item => item.id === form.item) ?? null

	function updateField<Key extends keyof StockEntryFormState>(
		key: Key,
		value: StockEntryFormState[Key],
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

	function validate(): boolean {
		const errors: Record<string, string> = {}

		if (!form.item) {
			errors.item = t('warehouse.form.requiredError')
		}

		const quantity = toNumber(normalizeDecimalInput(form.quantity))
		if (quantity === null || quantity <= 0) {
			errors.quantity = t('warehouse.form.positiveNumberError')
		}

		if (!isDecimalString(form.unit_cost) || Number(normalizeDecimalInput(form.unit_cost)) < 0) {
			errors.unit_cost = t('warehouse.form.numberError')
		}

		setFieldErrors(errors)
		return Object.keys(errors).length === 0
	}

	async function handleSubmit() {
		setErrorMessage(null)

		if (!validate()) {
			return
		}

		const payload = isEdit
			? pickChangedFields(toInput(initialForm), toInput(form))
			: toInput(form)

		if (isEdit && Object.keys(payload).length === 0) {
			onClose()
			return
		}

		setIsSubmitting(true)

		try {
			if (entryId) {
				await services.warehouse.patchStockEntry(entryId, payload)
			} else {
				await services.warehouse.createStockEntry(payload)
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
			eyebrow={t('warehouse.stockEntryForm.eyebrow')}
			title={
				isEdit
					? t('warehouse.stockEntryForm.editTitle')
					: t('warehouse.stockEntryForm.createTitle')
			}
			subtitle={
				isEdit
					? t('warehouse.stockEntryForm.editSubtitle')
					: t('warehouse.stockEntryForm.createSubtitle')
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
				{isEdit && entry ? (
					<WarehouseReadonlyValue
						label={t('warehouse.fields.total_cost')}
						value={formatMoney(entry.total_cost, entry.currency, locale)}
						hint={t('warehouse.form.totalAfterSaveHint')}
					/>
				) : null}
				{selectedItem ? (
					<WarehouseReadonlyValue
						label={t('warehouse.fields.current_quantity')}
						value={`${formatQuantity(selectedItem.current_quantity, locale)} ${selectedItem.unit}`}
						hint={t('warehouse.stockEntryForm.stockHint')}
					/>
				) : null}
			</div>

			<WarehouseField label={t('warehouse.fields.item')} error={fieldErrors.item}>
				<FilterSelect
					value={form.item}
					options={itemOptions}
					onChange={value => updateField('item', value)}
					disabled={readOnly || isSubmitting}
					searchable
				/>
			</WarehouseField>

			<div className='grid gap-3 sm:grid-cols-2'>
				<WarehouseField
					label={t('warehouse.fields.quantity')}
					htmlFor='warehouse-entry-quantity'
					error={fieldErrors.quantity}
				>
					<input
						id='warehouse-entry-quantity'
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
					label={t('warehouse.fields.unit_cost')}
					htmlFor='warehouse-entry-unit-cost'
					error={fieldErrors.unit_cost}
				>
					<input
						id='warehouse-entry-unit-cost'
						className={warehouseInputClassName}
						inputMode='decimal'
						value={form.unit_cost}
						onChange={event => updateField('unit_cost', event.target.value)}
					/>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.received_at')}
					htmlFor='warehouse-entry-received-at'
					error={fieldErrors.received_at}
				>
					<input
						id='warehouse-entry-received-at'
						type='datetime-local'
						className={warehouseInputClassName}
						value={form.received_at}
						onChange={event => updateField('received_at', event.target.value)}
					/>
				</WarehouseField>
			</div>

			<WarehouseField
				label={t('warehouse.fields.supplier_name')}
				htmlFor='warehouse-entry-supplier'
				error={fieldErrors.supplier_name}
			>
				<input
					id='warehouse-entry-supplier'
					className={warehouseInputClassName}
					value={form.supplier_name}
					onChange={event => updateField('supplier_name', event.target.value)}
				/>
			</WarehouseField>

			<WarehouseField
				label={t('warehouse.fields.notes')}
				htmlFor='warehouse-entry-notes'
				error={fieldErrors.notes}
			>
				<textarea
					id='warehouse-entry-notes'
					className={`${warehouseInputClassName} min-h-[88px] resize-y`}
					value={form.notes}
					onChange={event => updateField('notes', event.target.value)}
				/>
			</WarehouseField>
		</WarehouseFormPanel>
	)
}

export default WarehouseStockEntryFormPanel
