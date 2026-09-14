import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect, Switch } from '../../../components/shared/data'
import { services } from '../../../services'
import type {
	WarehouseItem,
	WarehouseItemInput,
} from '../../../types/warehouse'
import { parseWarehouseError } from '../utils/warehouse-errors'
import {
	WAREHOUSE_CURRENCIES,
	formatQuantity,
	getCurrencyLabel,
	isDecimalString,
	normalizeDecimalInput,
	hasChangedFields,
	toNumber,
} from '../utils/warehouse-format'
import WarehouseFormPanel, {
	WarehouseField,
	WarehouseReadonlyValue,
	warehouseInputClassName,
} from './WarehouseFormPanel'

interface WarehouseItemFormPanelProps {
	/** `null` opens the create form. */
	itemId: string | null
	canManage: boolean
	categorySuggestions: string[]
	onClose: () => void
	onSaved: () => void
}

interface ItemFormState {
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
}

const FORM_FIELD_KEYS = [
	'name',
	'category',
	'description',
	'unit',
	'default_price',
	'default_currency',
	'is_panel',
	'panel_watt',
	'panel_count',
	'panel_price',
	'low_stock_threshold',
] as const

const DECIMAL_FIELD_KEYS = [
	'default_price',
	'panel_watt',
	'panel_count',
	'panel_price',
	'low_stock_threshold',
] as const

const EMPTY_FORM: ItemFormState = {
	name: '',
	category: '',
	description: '',
	unit: 'dona',
	default_price: '',
	default_currency: 'uzs',
	is_panel: false,
	panel_watt: '',
	panel_count: '',
	panel_price: '',
	low_stock_threshold: '',
}

function toFormState(item: WarehouseItem): ItemFormState {
	return {
		name: item.name,
		category: item.category,
		description: item.description,
		unit: item.unit,
		default_price: item.default_price,
		default_currency: item.default_currency || 'uzs',
		is_panel: item.is_panel,
		panel_watt: item.panel_watt,
		panel_count: item.panel_count,
		panel_price: item.panel_price,
		low_stock_threshold: item.low_stock_threshold,
	}
}

function optionalDecimal(value: string): string | undefined {
	const normalized = normalizeDecimalInput(value)
	return normalized.length ? normalized : undefined
}

function toInput(form: ItemFormState): WarehouseItemInput {
	return {
		name: form.name.trim(),
		category: form.category.trim(),
		description: form.description.trim(),
		unit: form.unit.trim(),
		default_price: optionalDecimal(form.default_price),
		default_currency: form.default_currency,
		is_panel: form.is_panel,
		// Panel fields only matter for panels; backend derives the panel totals.
		panel_watt: form.is_panel ? optionalDecimal(form.panel_watt) : undefined,
		panel_count: form.is_panel ? optionalDecimal(form.panel_count) : undefined,
		panel_price: form.is_panel ? optionalDecimal(form.panel_price) : undefined,
		low_stock_threshold: optionalDecimal(form.low_stock_threshold),
	}
}

function WarehouseItemFormPanel({
	itemId,
	canManage,
	categorySuggestions,
	onClose,
	onSaved,
}: WarehouseItemFormPanelProps) {
	const { t, i18n } = useTranslation()
	const locale = i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ'
	const isEdit = itemId !== null

	const [item, setItem] = useState<WarehouseItem | null>(null)
	const [initialForm, setInitialForm] = useState<ItemFormState>(EMPTY_FORM)
	const [form, setForm] = useState<ItemFormState>(EMPTY_FORM)
	const [isLoading, setIsLoading] = useState(isEdit)
	const [loadError, setLoadError] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useEffect(() => {
		if (!itemId) {
			return
		}

		let isActive = true

		async function loadItem(id: string) {
			setIsLoading(true)
			setLoadError(false)

			try {
				const detail = await services.warehouse.getItem(id)
				if (!isActive) {
					return
				}

				const nextForm = toFormState(detail)
				setItem(detail)
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

		void loadItem(itemId)

		return () => {
			isActive = false
		}
	}, [itemId])

	const currencyOptions = useMemo(
		() =>
			WAREHOUSE_CURRENCIES.map(currency => ({
				value: currency,
				label: getCurrencyLabel(currency),
			})),
		[],
	)

	function updateField<Key extends keyof ItemFormState>(
		key: Key,
		value: ItemFormState[Key],
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

		if (!form.name.trim()) {
			errors.name = t('warehouse.form.requiredError')
		}

		DECIMAL_FIELD_KEYS.forEach(key => {
			const isPanelField = key.startsWith('panel_')
			if (isPanelField && !form.is_panel) {
				return
			}

			if (form[key].trim() && !isDecimalString(form[key])) {
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

		const payload = toInput(form)

		if (isEdit && !hasChangedFields(toInput(initialForm), payload)) {
			onClose()
			return
		}

		setIsSubmitting(true)

		try {
			if (itemId) {
				await services.warehouse.patchItem(itemId, payload)
			} else {
				await services.warehouse.createItem(payload)
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
	const title = isEdit
		? item?.name || t('warehouse.itemForm.editTitle')
		: t('warehouse.itemForm.createTitle')

	return (
		<WarehouseFormPanel
			eyebrow={t('warehouse.itemForm.eyebrow')}
			title={title}
			subtitle={isEdit ? undefined : t('warehouse.itemForm.createSubtitle')}
			isLoading={isLoading}
			loadError={loadError}
			isSubmitting={isSubmitting}
			canSubmit={form.name.trim().length > 0}
			readOnly={readOnly}
			submitLabel={isEdit ? t('warehouse.form.save') : t('warehouse.form.create')}
			submittingLabel={t('warehouse.form.saving')}
			errorMessage={errorMessage}
			onClose={onClose}
			onSubmit={() => {
				void handleSubmit()
			}}
		>
			{isEdit && item ? (
				<div className='grid gap-2.5 sm:grid-cols-3'>
					<WarehouseReadonlyValue
						label={t('warehouse.fields.current_quantity')}
						value={`${formatQuantity(item.current_quantity, locale)} ${item.unit}`}
						hint={t('warehouse.form.backendValue')}
					/>
					{item.is_panel ? (
						<>
							<WarehouseReadonlyValue
								label={t('warehouse.fields.panel_total_watt')}
								value={
									toNumber(item.panel_total_watt) !== null
										? `${formatQuantity(item.panel_total_watt, locale)} W`
										: '-'
								}
								hint={t('warehouse.form.backendValue')}
							/>
							<WarehouseReadonlyValue
								label={t('warehouse.fields.panel_total_price')}
								value={formatQuantity(item.panel_total_price, locale)}
								hint={t('warehouse.form.backendValue')}
							/>
						</>
					) : null}
				</div>
			) : null}

			<WarehouseField
				label={t('warehouse.fields.name')}
				htmlFor='warehouse-item-name'
				error={fieldErrors.name}
			>
				<input
					id='warehouse-item-name'
					className={warehouseInputClassName}
					value={form.name}
					placeholder='Panel 620W'
					onChange={event => updateField('name', event.target.value)}
				/>
			</WarehouseField>

			<div className='grid gap-3 sm:grid-cols-2'>
				<WarehouseField
					label={t('warehouse.fields.category')}
					htmlFor='warehouse-item-category'
					error={fieldErrors.category}
				>
					<input
						id='warehouse-item-category'
						className={warehouseInputClassName}
						value={form.category}
						list='warehouse-item-category-suggestions'
						onChange={event => updateField('category', event.target.value)}
					/>
					<datalist id='warehouse-item-category-suggestions'>
						{categorySuggestions.map(category => (
							<option key={category} value={category} />
						))}
					</datalist>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.unit')}
					htmlFor='warehouse-item-unit'
					error={fieldErrors.unit}
				>
					<input
						id='warehouse-item-unit'
						className={warehouseInputClassName}
						value={form.unit}
						placeholder='dona'
						onChange={event => updateField('unit', event.target.value)}
					/>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.default_price')}
					htmlFor='warehouse-item-default-price'
					error={fieldErrors.default_price}
				>
					<input
						id='warehouse-item-default-price'
						className={warehouseInputClassName}
						inputMode='decimal'
						value={form.default_price}
						onChange={event => updateField('default_price', event.target.value)}
					/>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.default_currency')}
					error={fieldErrors.default_currency}
				>
					<FilterSelect
						value={form.default_currency}
						options={currencyOptions}
						onChange={value => updateField('default_currency', value)}
						disabled={readOnly || isSubmitting}
					/>
				</WarehouseField>

				<WarehouseField
					label={t('warehouse.fields.low_stock_threshold')}
					htmlFor='warehouse-item-low-stock'
					error={fieldErrors.low_stock_threshold}
					hint={t('warehouse.itemForm.lowStockHint')}
				>
					<input
						id='warehouse-item-low-stock'
						className={warehouseInputClassName}
						inputMode='decimal'
						value={form.low_stock_threshold}
						onChange={event =>
							updateField('low_stock_threshold', event.target.value)
						}
					/>
				</WarehouseField>
			</div>

			<WarehouseField
				label={t('warehouse.fields.description')}
				htmlFor='warehouse-item-description'
				error={fieldErrors.description}
			>
				<textarea
					id='warehouse-item-description'
					className={`${warehouseInputClassName} min-h-[88px] resize-y`}
					value={form.description}
					onChange={event => updateField('description', event.target.value)}
				/>
			</WarehouseField>

			<div className='flex items-center justify-between gap-4 rounded-xl bg-surface-card px-4 py-4 ring-1 ring-border-soft/35'>
				<div className='grid gap-0.5'>
					<p className='m-0 text-sm font-semibold text-text-primary'>
						{t('warehouse.fields.is_panel')}
					</p>
					<p className='m-0 text-[12px] text-text-secondary'>
						{t('warehouse.itemForm.isPanelHint')}
					</p>
				</div>
				<Switch
					checked={form.is_panel}
					onChange={value => updateField('is_panel', value)}
					disabled={readOnly || isSubmitting}
					ariaLabel={t('warehouse.fields.is_panel')}
				/>
			</div>

			{form.is_panel ? (
				<div className='grid gap-3 sm:grid-cols-3'>
					<WarehouseField
						label={t('warehouse.fields.panel_watt')}
						htmlFor='warehouse-item-panel-watt'
						error={fieldErrors.panel_watt}
					>
						<input
							id='warehouse-item-panel-watt'
							className={warehouseInputClassName}
							inputMode='decimal'
							value={form.panel_watt}
							placeholder='620'
							onChange={event => updateField('panel_watt', event.target.value)}
						/>
					</WarehouseField>

					<WarehouseField
						label={t('warehouse.fields.panel_count')}
						htmlFor='warehouse-item-panel-count'
						error={fieldErrors.panel_count}
					>
						<input
							id='warehouse-item-panel-count'
							className={warehouseInputClassName}
							inputMode='decimal'
							value={form.panel_count}
							placeholder='10'
							onChange={event => updateField('panel_count', event.target.value)}
						/>
					</WarehouseField>

					<WarehouseField
						label={t('warehouse.fields.panel_price')}
						htmlFor='warehouse-item-panel-price'
						error={fieldErrors.panel_price}
					>
						<input
							id='warehouse-item-panel-price'
							className={warehouseInputClassName}
							inputMode='decimal'
							value={form.panel_price}
							placeholder='1500'
							onChange={event => updateField('panel_price', event.target.value)}
						/>
					</WarehouseField>

					<p className='m-0 text-[12px] leading-5 text-text-muted sm:col-span-3'>
						{t('warehouse.itemForm.panelTotalsHint')}
					</p>
				</div>
			) : null}
		</WarehouseFormPanel>
	)
}

export default WarehouseItemFormPanel
