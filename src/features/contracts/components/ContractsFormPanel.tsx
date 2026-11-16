import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from '../../../components/shared/icons/AppIcon'
import { FilterSelect, Switch } from '../../../components/shared/data'
import {
	formatFileSize,
	getAttachmentFilename,
	getAttachmentIconName,
	getAttachmentTypeLabel,
	isImageAttachment,
} from '../../../lib/attachments'
import { services } from '../../../services'
import type {
	Contract,
	CreateClientInput,
	CreateContractInput,
	UpdateContractInput,
} from '../../../services/contracts'

export interface ContractsFormPanelProps {
	contract?: Contract
	onClose?: () => void
	onSuccess?: (contract: Contract) => void
}

type ContractFormState = {
	client: string
	title: string
	status: Contract['status']
	note: string
	panel_type: Contract['panel_type']
	inverter_type: Contract['inverter_type']
	requested_power_kw: number | ''
	subsidy_percent: string
	customer_phone: string
	one_id_code: string
	agreed_amount: string
	paid_amount: string
	given_subsidy_amount: string
	installation_address: string
	auditor_company_name: string
	auditor_phone: string
	audit_conclusion_text: string
	lot_deadline_at: string
	installer_fee_amount: string
	details: string
	items: Array<{ product: string; quantity: number | ''; unit_price: string }>
	file: File | null
	cadastre_file: File | null
	house_image: File | null
	additional_file: File | null
}

const inputClassName = [
	'w-full rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 text-sm font-medium text-text-primary',
	'placeholder:text-text-muted outline-none transition duration-fast',
	'focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
	'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ')

const labelClassName =
	'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'

const typeBadgeClassName =
	'inline-flex h-5 shrink-0 items-center rounded-sm px-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-text-primary ring-1 ring-border-soft/40 bg-surface-muted'

function AttachmentTypeBadge({
	source,
	mimeType,
}: {
	source: string
	mimeType?: string
}) {
	return (
		<span className='inline-flex items-center gap-1.5'>
			<AppIcon
				name={getAttachmentIconName(source, mimeType)}
				className='h-4 w-4 shrink-0 text-text-muted'
				aria-hidden='true'
			/>
			<span className={typeBadgeClassName}>
				{getAttachmentTypeLabel(source, mimeType)}
			</span>
		</span>
	)
}

function useObjectUrl(file: File | null): string {
	const [url, setUrl] = useState('')

	useEffect(() => {
		if (!file || !isImageAttachment(file.name, file.type)) {
			setUrl('')
			return
		}

		const objectUrl = URL.createObjectURL(file)
		setUrl(objectUrl)

		return () => {
			URL.revokeObjectURL(objectUrl)
		}
	}, [file])

	return url
}

interface FilePickerFieldProps {
	id: string
	label: string
	value: File | null
	chooseLabel: string
	emptyLabel: string
	accept?: string
	disabled?: boolean
	onChange: (file: File | null) => void
}

function FilePickerField({
	id,
	label,
	value,
	chooseLabel,
	emptyLabel,
	accept,
	disabled,
	onChange,
}: FilePickerFieldProps) {
	const previewUrl = useObjectUrl(value)

	return (
		<div className='grid gap-1.5'>
			<label className={labelClassName} htmlFor={id}>
				{label}
			</label>
			<label
				htmlFor={id}
				className={[
					'flex min-h-[46px] items-center justify-between gap-3 rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5',
					disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
				].join(' ')}
				onClick={event => {
					if (disabled) {
						event.preventDefault()
					}
				}}
			>
				{value ? (
					<span className='flex min-w-0 items-center gap-2'>
						<AttachmentTypeBadge source={value.name} mimeType={value.type} />
						<span className='min-w-0 truncate text-sm font-medium text-text-primary'>
							{value.name}
						</span>
						<span className='shrink-0 text-xs font-semibold text-text-muted'>
							{formatFileSize(value.size)}
						</span>
					</span>
				) : (
					<span className='min-w-0 truncate text-sm font-medium text-text-secondary'>
						{emptyLabel}
					</span>
				)}
				<span className='inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-surface-subtle px-3 text-xs font-semibold text-text-primary transition duration-fast hover:bg-surface-muted'>
					{chooseLabel}
				</span>
				<input
					id={id}
					type='file'
					accept={accept}
					className='sr-only'
					onChange={event => onChange(event.target.files?.[0] ?? null)}
					disabled={disabled}
				/>
			</label>

			{previewUrl ? (
				<div className='overflow-hidden rounded-lg ring-1 ring-border-soft/35'>
					<img
						src={previewUrl}
						alt={value?.name ?? label}
						className='h-40 w-full bg-surface-card object-cover'
					/>
				</div>
			) : null}
		</div>
	)
}

function ExistingAttachment({
	label,
	url,
	openLabel,
}: {
	label: string
	url: string
	openLabel: string
}) {
	const previewable = isImageAttachment(url)

	return (
		<div className='mt-2 rounded-xl bg-surface-subtle/60 p-3 ring-1 ring-border-soft/25'>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<p className={labelClassName}>{label}</p>
					<div className='mt-1 flex min-w-0 items-center gap-2'>
						<AttachmentTypeBadge source={url} />
						<p className='min-w-0 truncate text-sm font-semibold text-text-primary'>
							{getAttachmentFilename(url)}
						</p>
					</div>
				</div>
				<a
					className='inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-surface-card px-3 text-sm font-semibold text-text-primary shadow-sm ring-1 ring-border-soft/35 transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20'
					href={url}
					target='_blank'
					rel='noreferrer'
				>
					<AppIcon
						name={previewable ? 'search' : 'download'}
						className='h-4 w-4'
						aria-hidden='true'
					/>
					{openLabel}
				</a>
			</div>

			{previewable ? (
				<a
					href={url}
					target='_blank'
					rel='noreferrer'
					className='mt-3 block overflow-hidden rounded-lg ring-1 ring-border-soft/35'
				>
					<img
						src={url}
						alt={label}
						loading='lazy'
						className='h-44 w-full bg-surface-card object-cover'
					/>
				</a>
			) : null}
		</div>
	)
}

function extractDetails(details: Contract['details']): string {
	if (!details) {
		return ''
	}
	if (typeof details === 'string') {
		return details
	}
	try {
		return JSON.stringify(details, null, 2)
	} catch {
		return String(details)
	}
}

function readDetailsObject(details: Contract['details']): Record<string, unknown> {
	if (!details) {
		return {}
	}
	if (typeof details === 'string') {
		const text = details.trim()
		if (!text.length) {
			return {}
		}
		try {
			const parsed = JSON.parse(text) as unknown
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: {}
		} catch {
			return {}
		}
	}
	return details && typeof details === 'object' && !Array.isArray(details)
		? (details as Record<string, unknown>)
		: {}
}

function readStringField(source: Record<string, unknown>, key: string): string {
	const value = source[key]
	if (value === null || value === undefined) {
		return ''
	}
	return String(value)
}

function extractClientIdFromResponse(response: unknown): string | null {
	if (!response || typeof response !== 'object') {
		return null
	}

	const record = response as Record<string, unknown>
	const directId = record.id
	if (typeof directId === 'string' && directId.trim()) {
		return directId
	}

	const nestedClient = record.client
	if (nestedClient && typeof nestedClient === 'object') {
		const nestedClientId = (nestedClient as Record<string, unknown>).id
		if (typeof nestedClientId === 'string' && nestedClientId.trim()) {
			return nestedClientId
		}
	}

	const nestedData = record.data
	if (nestedData && typeof nestedData === 'object') {
		const nestedDataId = (nestedData as Record<string, unknown>).id
		if (typeof nestedDataId === 'string' && nestedDataId.trim()) {
			return nestedDataId
		}
	}

	return null
}

function formatLotDeadlineForInput(value: string | null | undefined): string {
	const text = (value ?? '').trim()
	if (!text) {
		return ''
	}
	const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
	if (!isoMatch) {
		return text
	}
	const [, year, month, day, hour, minute] = isoMatch
	return `${day}.${month}.${year} ${hour}:${minute}`
}

function toApiDateTime(value: string): string | null {
	const text = value.trim()
	if (!text) {
		return null
	}
	const localMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2})$/)
	if (!localMatch) {
		return text
	}
	const [, day, month, year, hour, minute] = localMatch
	return `${year}-${month}-${day}T${hour}:${minute}:00`
}

function toInitialState(contract?: Contract): ContractFormState {
	const details = readDetailsObject(contract?.details)

	return {
		client: contract?.client ?? '',
		title: contract?.title ?? '',
		status: contract?.status ?? 'draft',
		note: contract?.note ?? readStringField(details, 'note'),
		panel_type: contract?.panel_type ?? '',
		inverter_type: contract?.inverter_type ?? '',
		requested_power_kw:
			typeof contract?.requested_power_kw === 'number'
				? contract.requested_power_kw
				: '',
		subsidy_percent: String(contract?.subsidy_percent ?? ''),
		customer_phone: contract?.customer_phone ?? '',
		one_id_code:
			contract?.one_id_code ??
			readStringField(details, 'one_id_code'),
		agreed_amount:
			String(contract?.agreed_amount ?? '') ||
			readStringField(details, 'agreed_amount') ||
			String(contract?.total_amount ?? ''),
		paid_amount:
			String(contract?.paid_amount ?? '') ||
			readStringField(details, 'paid_amount') ||
			String(contract?.customer_amount ?? ''),
		given_subsidy_amount:
			readStringField(details, 'given_subsidy_amount') ||
			String(contract?.subsidy_amount ?? ''),
		installation_address: contract?.installation_address ?? '',
		auditor_company_name:
			contract?.auditor_organization_name ||
			readStringField(details, 'auditor_company_name') ||
			readStringField(details, 'auditor_organization_name'),
		auditor_phone:
			contract?.auditor_phone ||
			readStringField(details, 'auditor_phone'),
		audit_conclusion_text:
			contract?.audit_conclusion ||
			readStringField(details, 'audit_conclusion_text') ||
			readStringField(details, 'audit_conclusion'),
		lot_deadline_at: formatLotDeadlineForInput(
			contract?.lot_deadline ||
				readStringField(details, 'lot_deadline_at') ||
				readStringField(details, 'lot_deadline'),
		),
		installer_fee_amount:
			String(contract?.installer_fee_amount ?? '') ||
			readStringField(details, 'installer_fee_amount'),
		details: extractDetails(contract?.details),
		items:
			contract?.items?.length
				? contract.items.map(item => ({
						product: item.product,
						quantity: item.quantity,
						unit_price: String(item.unit_price ?? ''),
					}))
				: [{ product: '', quantity: 1, unit_price: '' }],
		file: null,
		cadastre_file: null,
		house_image: null,
		additional_file: null,
	}
}

export function ContractsFormPanel({
	contract,
	onClose,
	onSuccess,
}: ContractsFormPanelProps) {
	const { t, i18n } = useTranslation()
	const isRu = i18n.language === 'ru'
	const isEditing = Boolean(contract)

	const tx = isRu
		? {
				form: '\u0424\u043e\u0440\u043c\u0430 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430',
				createTitle: '\u041d\u043e\u0432\u044b\u0439 \u0434\u043e\u0433\u043e\u0432\u043e\u0440',
				editTitle: '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430',
				requiredError:
					'\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u043e\u043b\u044f: \u043a\u043b\u0438\u0435\u043d\u0442 \u0438 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435.',
				detailsJsonError:
					'\u041f\u043e\u043b\u0435 "\u0414\u0435\u0442\u0430\u043b\u0438" \u0434\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u0432\u0430\u043b\u0438\u0434\u043d\u044b\u043c JSON \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u043c.',
				saveError:
					'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0434\u043e\u0433\u043e\u0432\u043e\u0440.',
				saving: '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...',
				createSubmit:
					'\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0434\u043e\u0433\u043e\u0432\u043e\u0440',
				editSubmit:
					'\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f',
				cancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
				close: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
				chooseFile: '\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0444\u0430\u0439\u043b',
				noFile: '\u0424\u0430\u0439\u043b \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d',
				currentFile: '\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u0444\u0430\u0439\u043b',
				open: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c',
				addItem:
					'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u043e\u0437\u0438\u0446\u0438\u044e',
				removeItem: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
				searchClientPlaceholder: '\u041f\u043e\u0438\u0441\u043a \u043a\u043b\u0438\u0435\u043d\u0442\u0430',
				labels: {
					client: '\u041a\u043b\u0438\u0435\u043d\u0442',
					title: '\u0424.\u0418.\u0428.',
					status: '\u0421\u0442\u0430\u0442\u0443\u0441',
					note: '\u041f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435',
					requestedPower:
						'\u0417\u0430\u043f\u0440\u043e\u0448\u0435\u043d\u043d\u0430\u044f \u043c\u043e\u0449\u043d\u043e\u0441\u0442\u044c (kW)',
					customerPhone:
						'\u0422\u0435\u043b\u0435\u0444\u043e\u043d \u043a\u043b\u0438\u0435\u043d\u0442\u0430',
					oneIdCode: 'One ID \u043a\u043e\u0434',
					inverterType:
						'\u0422\u0438\u043f \u0438\u043d\u0432\u0435\u0440\u0442\u043e\u0440\u0430',
					panelType: '\u0422\u0438\u043f \u043f\u0430\u043d\u0435\u043b\u0438',
					agreedAmount:
						'\u0421\u043e\u0433\u043b\u0430\u0441\u043e\u0432\u0430\u043d\u043d\u0430\u044f \u0441\u0443\u043c\u043c\u0430',
					paidAmount:
						'\u0412\u044b\u0434\u0430\u043d\u043d\u0430\u044f \u0441\u0443\u043c\u043c\u0430',
					givenSubsidyAmount:
						'\u0412\u044b\u0434\u0430\u043d\u043d\u0430\u044f \u0441\u0443\u0431\u0441\u0438\u0434\u0438\u044f',
					address: '\u0410\u0434\u0440\u0435\u0441 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0438',
					auditorCompanyName:
						'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0430\u0443\u0434\u0438\u0442\u043e\u0440\u0441\u043a\u043e\u0439 \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0438',
					auditorPhone: '\u041d\u043e\u043c\u0435\u0440 \u0430\u0443\u0434\u0438\u0442\u043e\u0440\u0430',
					auditConclusionText:
						'\u0410\u0443\u0434\u0438\u0442\u043e\u0440\u0441\u043a\u043e\u0435 \u0437\u0430\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435',
					lotDeadlineAt: '\u0421\u0440\u043e\u043a \u043b\u043e\u0442\u0430 (dd.MM.yyyy HH:mm)',
					installerFeeAmount:
						'\u0421\u0443\u043c\u043c\u0430 \u043e\u043f\u043b\u0430\u0442\u044b \u0443\u0441\u0442\u0430',
					auditContractFile:
						'\u0424\u0430\u0439\u043b \u0430\u0443\u0434\u0438\u0442 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430',
					homeCadastreFile:
						'\u0424\u0430\u0439\u043b \u043a\u0430\u0434\u0430\u0441\u0442\u0440\u0430 \u0434\u043e\u043c\u0430',
					companyContractFile:
						'\u0424\u0430\u0439\u043b \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430 \u0444\u0438\u0440\u043c\u044b',
					additionalFile:
						'\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0444\u0430\u0439\u043b',
					subsidyPercent: '\u0421\u0443\u0431\u0441\u0438\u0434\u0438\u044f (%)',
					items: '\u041f\u043e\u0437\u0438\u0446\u0438\u0438 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430',
					quantity: '\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e',
					unitPrice: '\u0426\u0435\u043d\u0430',
				},
			}
		: {
				form: 'Shartnoma formasi',
				createTitle: 'Yangi shartnoma',
				editTitle: 'Shartnomani tahrirlash',
				requiredError: "Majburiy maydonlarni to'ldiring: mijoz va nom.",
				detailsJsonError:
					"\"Tafsilotlar\" maydoni yaroqli JSON obyekt bo'lishi kerak.",
				saveError: "Shartnomani saqlab bo'lmadi.",
				saving: 'Saqlanmoqda...',
				createSubmit: 'Shartnoma yaratish',
				editSubmit: "O'zgarishlarni saqlash",
				cancel: 'Bekor qilish',
				close: 'Yopish',
				chooseFile: 'Fayl tanlash',
				noFile: 'Fayl tanlanmagan',
				currentFile: 'Hozirgi fayl',
				open: "Ko'rish",
				addItem: "Pozitsiya qo'shish",
				removeItem: 'Olib tashlash',
				searchClientPlaceholder: 'Mijozni qidiring',
				labels: {
					client: 'Mijoz',
					title: 'F.I.SH',
					status: 'Holat',
					note: 'Izoh',
					requestedPower: "So'ralgan quvvat (kW)",
					customerPhone: 'Mijoz telefoni',
					oneIdCode: 'One ID kodi',
					inverterType: 'Invertor turi',
					panelType: 'Panel turi',
					agreedAmount: 'Kelishilgan summa',
					paidAmount: 'Berilgan summa',
					givenSubsidyAmount: 'Berilgan subsidiya miqdori',
					address: "O'rnatish manzili",
					auditorCompanyName: 'Auditor tashkilot nomi',
					auditorPhone: 'Auditor raqami',
					auditConclusionText: 'Audit bergan xulosa',
					lotDeadlineAt: "Lotga qo'yilgan muddat (dd.MM.yyyy HH:mm)",
					installerFeeAmount: 'Obyekt usta haqi summasi',
					auditContractFile: 'Audit shartnoma fayl',
					homeCadastreFile: 'Uy kadastr fayl',
					companyContractFile: 'Firma shartnomasi fayl',
					additionalFile: "Qo'shimcha fayl",
					subsidyPercent: 'Subsidiya (%)',
					items: 'Shartnoma pozitsiyalari',
					quantity: 'Soni',
					unitPrice: 'Narx',
				},
			}

	const [form, setForm] = useState<ContractFormState>(() => toInitialState(contract))
	const [isNewClient, setIsNewClient] = useState(false)
	const [newClientPhone, setNewClientPhone] = useState('')
	const existingContractFileUrl =
		contract?.audit_contract_file_url ||
		contract?.file_url || (typeof contract?.file === 'string' ? contract.file : '') || ''
	const existingCadastreFileUrl =
		contract?.home_cadastre_file_url ||
		contract?.cadastre_file_url ||
		(typeof contract?.cadastre_file === 'string' ? contract.cadastre_file : '') ||
		''
	const existingHouseImageUrl =
		contract?.company_contract_file_url ||
		contract?.house_image_url ||
		(typeof contract?.house_image === 'string' ? contract.house_image : '') ||
		''
	const existingAdditionalFileUrl =
		contract?.additional_file_url ||
		(typeof contract?.additional_file === 'string' ? contract.additional_file : '') ||
		''
	const [clients, setClients] = useState<Array<{ id: string; full_name: string; phone?: string }>>(
		[],
	)
	const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
	const [isLoadingReferences, setIsLoadingReferences] = useState(true)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const selectedClientNameForSubmit =
		clients.find(client => client.id === form.client)?.full_name?.trim() ?? ''
	const resolvedTitleForSubmit = isNewClient
		? form.title.trim()
		: form.title.trim() || selectedClientNameForSubmit || contract?.title?.trim() || ''
	const canSubmit = isEditing
		? Boolean(form.client && resolvedTitleForSubmit)
		: isNewClient
			? Boolean(resolvedTitleForSubmit)
			: Boolean(form.client && resolvedTitleForSubmit)

	useEffect(() => {
		if (isEditing) {
			setIsNewClient(false)
		}
	}, [isEditing])

	useEffect(() => {
		let isActive = true
		void (async () => {
			try {
				const [clientsResponse, productsResponse] = await Promise.all([
					services.clients.listClients({ page: 1, page_size: 150, ordering: 'full_name' }),
					services.products.listProducts({ page: 1, page_size: 150, ordering: 'name' }),
				])
				if (!isActive) {
					return
				}
				setClients(
					clientsResponse.items.map((client: { id: string; full_name: string; phone?: string }) => ({
						id: client.id,
						full_name: client.full_name,
						phone: client.phone,
					})),
				)
				setProducts(
					productsResponse.items.map((product: { id: string; name: string }) => ({
						id: product.id,
						name: product.name,
					})),
				)
			} finally {
				if (isActive) {
					setIsLoadingReferences(false)
				}
			}
		})()

		return () => {
			isActive = false
		}
	}, [])

	const statusOptions = useMemo(
		() => [
			{ value: 'draft', label: isRu ? 'Черновик' : 'Qoralama' },
			{ value: 'audit_pending', label: isRu ? 'Audit kutilmoqda' : 'Audit kutilmoqda' },
			{ value: 'audit_paid', label: isRu ? 'Audit to\'langan' : 'Audit to\'langan' },
			{ value: 'moderation', label: isRu ? 'Модерация' : 'Moderatsiya' },
			{ value: 'contract_ready', label: isRu ? 'Договор готов' : 'Shartnoma tayyor' },
			{ value: 'payment_pending', label: isRu ? 'To\'lov kutilmoqda' : 'To\'lov kutilmoqda' },
			{ value: 'paid', label: isRu ? 'Оплачен' : 'To\'langan' },
			{ value: 'in_lot', label: isRu ? 'Выставлен в лот' : "Lotga qo'yilgan" },
			{ value: 'completed', label: isRu ? 'Завершен' : 'Yakunlandi' },
			{ value: 'canceled', label: isRu ? 'Отменен' : 'Bekor qilingan' },
		],
		[isRu],
	)
	const lotDeadlinePlaceholder = isRu
		? 'Например: 15.05.2026 14:20'
		: 'Masalan: 15.05.2026 14:20'

	function updateField<Key extends keyof ContractFormState>(
		key: Key,
		value: ContractFormState[Key],
	) {
		setForm(current => ({ ...current, [key]: value }))
	}

	function updateItemField(
		index: number,
		key: 'product' | 'quantity' | 'unit_price',
		value: string | number,
	) {
		setForm(current => ({
			...current,
			items: current.items.map((item, itemIndex) =>
				itemIndex === index ? { ...item, [key]: value } : item,
			),
		}))
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setErrorMessage(null)

		const title = form.title.trim()
		const selectedClientName = isNewClient
			? ''
			: clients.find(client => client.id === form.client)?.full_name?.trim() ?? ''
		const resolvedTitle = isNewClient ? title : title || selectedClientName || contract?.title?.trim() || ''
		const subsidyPercent = form.subsidy_percent.trim() || '0'

		if (!isEditing && isNewClient) {
			if (!title) {
				setErrorMessage(tx.requiredError)
				return
			}
		} else if (!form.client) {
			setErrorMessage(tx.requiredError)
			return
		}
		if (!resolvedTitle) {
			setErrorMessage(tx.requiredError)
			return
		}

		const baseDetails = readDetailsObject(form.details)
		const givenSubsidyAmount = form.given_subsidy_amount.trim()
		const resolvedSubsidyAmount = givenSubsidyAmount || '0'
		const lotDeadline = toApiDateTime(form.lot_deadline_at)
		const detailsPayload: Record<string, unknown> = {
			...baseDetails,
			note: form.note.trim() || null,
			one_id_code: form.one_id_code.trim() || null,
			agreed_amount: form.agreed_amount.trim() || null,
			paid_amount: form.paid_amount.trim() || null,
			given_subsidy_amount: resolvedSubsidyAmount,
			auditor_company_name: form.auditor_company_name.trim() || null,
			auditor_organization_name: form.auditor_company_name.trim() || null,
			auditor_phone: form.auditor_phone.trim() || null,
			audit_conclusion_text: form.audit_conclusion_text.trim() || null,
			audit_conclusion: form.audit_conclusion_text.trim() || null,
			lot_deadline_at: form.lot_deadline_at.trim() || null,
			lot_deadline: lotDeadline || null,
			installer_fee_amount: form.installer_fee_amount.trim() || null,
		}

		setIsSubmitting(true)
		try {
			let clientId = form.client
			let resolvedCustomerPhone = form.customer_phone || ''

			if (!isEditing && isNewClient) {
				const newClientPayload: CreateClientInput = {
					full_name: resolvedTitle,
					phone: newClientPhone.trim() || undefined,
				}
				const createdClientResponse = await services.clients.createClient(newClientPayload)
				clientId = extractClientIdFromResponse(createdClientResponse) ?? ''

				if (!clientId || typeof clientId !== 'string') {
					throw new Error('Failed to create client.')
				}
				resolvedCustomerPhone = newClientPhone.trim()
			}

			const resolvedRequestedPowerKw =
				form.requested_power_kw === '' ? null : Number(form.requested_power_kw)

			const payload: CreateContractInput | UpdateContractInput = {
				client: clientId,
				title: resolvedTitle,
				status: form.status,
				note: form.note.trim() || undefined,
				panel_type: form.panel_type,
				inverter_type: form.inverter_type,
				requested_power_kw: resolvedRequestedPowerKw,
				subsidy_percent: subsidyPercent,
				one_id_code: form.one_id_code.trim() || undefined,
				customer_phone: resolvedCustomerPhone,
				agreed_amount: form.agreed_amount.trim() || null,
				paid_amount: form.paid_amount.trim() || null,
				subsidy_amount: resolvedSubsidyAmount,
				auditor_organization_name: form.auditor_company_name.trim() || undefined,
				auditor_phone: form.auditor_phone.trim() || undefined,
				audit_conclusion: form.audit_conclusion_text.trim() || undefined,
				lot_deadline: lotDeadline || undefined,
				installer_fee_amount: form.installer_fee_amount.trim() || null,
				installation_address: form.installation_address || '',
				details: detailsPayload,
				items: form.items
					.filter(item => item.product && Number(item.quantity) > 0)
					.map(item => ({
						product: item.product,
						quantity: Number(item.quantity),
						unit_price: item.unit_price || '0',
					})),
				file: form.file, // legacy backend field
				cadastre_file: form.cadastre_file, // legacy backend field
				house_image: form.house_image, // legacy backend field
				audit_contract_file: form.file,
				home_cadastre_file: form.cadastre_file,
				company_contract_file: form.house_image,
				additional_file: form.additional_file,
			}

			const saved = isEditing
				? await services.contracts.updateContract(
						contract!.id,
						payload as UpdateContractInput,
					)
				: await services.contracts.createContract(payload as CreateContractInput)
			onSuccess?.(saved)
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : tx.saveError)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<div className='grid gap-3'>
			<header className='mb-1 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40'>
				<div className='flex items-start justify-between gap-3'>
					<div className='min-w-0'>
						<p className='m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary'>
							{tx.form}
						</p>
						<h2 className='mt-1 font-display text-[1.45rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-text-primary'>
							{isEditing ? tx.editTitle : tx.createTitle}
						</h2>
					</div>

					<div className='flex shrink-0 items-center gap-3'>
						{!isEditing ? (
							<div className='flex items-center gap-2'>
								<span className='text-[12px] font-semibold text-text-secondary'>
									{t('contractsPage.form.newClient')}
								</span>
								<Switch
									checked={isNewClient}
									onChange={nextValue => {
										setIsNewClient(nextValue)
										if (nextValue) {
											updateField('client', '')
										}
									}}
									disabled={isSubmitting}
									ariaLabel={t('contractsPage.form.newClient')}
								/>
							</div>
						) : null}

						<button
							type='button'
							className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60'
							onClick={onClose}
							disabled={isSubmitting}
							aria-label={tx.close}
						>
							<AppIcon
								name='close'
								className='h-4.5 w-4.5'
								aria-hidden='true'
							/>
						</button>
					</div>
				</div>
			</header>

			<form className='grid gap-3' onSubmit={handleSubmit} noValidate>
				<div className='grid items-start gap-3 sm:grid-cols-2'>					{!isNewClient ? (
						<div className='grid gap-1.5'>
							<label className={labelClassName}>{tx.labels.client}</label>
							<FilterSelect
								value={form.client}
								options={[
									{ value: '', label: t('shared.filterSelect.select'), disabled: true },
									...clients.map(client => ({
										value: client.id,
										label: client.full_name,
									})),
								]}
								onChange={value => {
									updateField('client', value)
									const selected = clients.find(item => item.id === value)
									updateField('customer_phone', selected?.phone || '')
									if (!form.title.trim()) {
										if (selected?.full_name) {
											updateField('title', selected.full_name)
										}
									}
								}}
								disabled={isSubmitting || isLoadingReferences}
								searchable
								searchPlaceholder={tx.searchClientPlaceholder}
							/>
						</div>
					) : null}
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.status}</label>
						<FilterSelect
							value={form.status}
							options={statusOptions}
							onChange={value => updateField('status', value as Contract['status'])}
							disabled={isSubmitting}
						/>
					</div>
					{isNewClient ? (
						<div className='grid gap-1.5'>
							<label className={labelClassName}>{tx.labels.title}</label>
							<input
								className={inputClassName}
								value={form.title}
								onChange={event => updateField('title', event.target.value)}
								disabled={isSubmitting}
							/>
						</div>
					) : null}
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.requestedPower}</label>
						<input
							type='number'
							min={0}
							className={inputClassName}
							value={form.requested_power_kw}
							onChange={event =>
								updateField(
									'requested_power_kw',
									event.target.value === '' ? '' : Number(event.target.value),
								)
							}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.customerPhone}</label>
						<input
							className={inputClassName}
							value={!isEditing && isNewClient ? newClientPhone : form.customer_phone}
							onChange={event =>
								!isEditing && isNewClient
									? setNewClientPhone(event.target.value)
									: updateField('customer_phone', event.target.value)
							}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.oneIdCode}</label>
						<input
							className={inputClassName}
							value={form.one_id_code}
							onChange={event => updateField('one_id_code', event.target.value)}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.inverterType}</label>
						<FilterSelect
							value={form.inverter_type}
							options={[
								{
									value: '',
									label: isRu ? 'Не указано' : 'Ko\'rsatilmagan',
								},
								{ value: 'deye', label: 'DEYE' },
								{ value: 'solax', label: 'SOLAX' },
							]}
							onChange={value =>
								updateField('inverter_type', value as Contract['inverter_type'])
							}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.panelType}</label>
						<FilterSelect
							value={form.panel_type}
							options={[
								{
									value: '',
									label: isRu ? 'Не указано' : 'Ko\'rsatilmagan',
								},
								{ value: 'jinko_ja', label: 'Jinko / JA Solar' },
								{ value: 'longi_hi_mo_x10', label: 'Longi HI MO X10' },
							]}
							onChange={value => updateField('panel_type', value as Contract['panel_type'])}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.agreedAmount}</label>
						<input
							type='number'
							min={0}
							className={inputClassName}
							value={form.agreed_amount}
							onChange={event => updateField('agreed_amount', event.target.value)}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.paidAmount}</label>
						<input
							type='number'
							min={0}
							className={inputClassName}
							value={form.paid_amount}
							onChange={event => updateField('paid_amount', event.target.value)}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.givenSubsidyAmount}</label>
						<input
							type='number'
							min={0}
							className={inputClassName}
							value={form.given_subsidy_amount}
							onChange={event =>
								updateField('given_subsidy_amount', event.target.value)
							}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5 sm:col-span-2'>
						<label className={labelClassName}>{tx.labels.address}</label>
						<input
							className={inputClassName}
							value={form.installation_address}
							onChange={event =>
								updateField('installation_address', event.target.value)
							}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.auditorCompanyName}</label>
						<input
							className={inputClassName}
							value={form.auditor_company_name}
							onChange={event =>
								updateField('auditor_company_name', event.target.value)
							}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.auditorPhone}</label>
						<input
							className={inputClassName}
							value={form.auditor_phone}
							onChange={event => updateField('auditor_phone', event.target.value)}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.auditConclusionText}</label>
						<input
							className={inputClassName}
							value={form.audit_conclusion_text}
							onChange={event =>
								updateField('audit_conclusion_text', event.target.value)
							}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.lotDeadlineAt}</label>
						<input
							className={inputClassName}
							value={form.lot_deadline_at}
							placeholder={lotDeadlinePlaceholder}
							pattern='^\\d{2}\\.\\d{2}\\.\\d{4}\\s\\d{2}:\\d{2}$'
							onChange={event => updateField('lot_deadline_at', event.target.value)}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.installerFeeAmount}</label>
						<input
							type='number'
							min={0}
							className={inputClassName}
							value={form.installer_fee_amount}
							onChange={event =>
								updateField('installer_fee_amount', event.target.value)
							}
							disabled={isSubmitting}
						/>
					</div>
					<div className='grid gap-1.5'>
						<label className={labelClassName}>{tx.labels.note}</label>
						<input
							className={inputClassName}
							value={form.note}
							onChange={event => updateField('note', event.target.value)}
							disabled={isSubmitting}
						/>
					</div>

					<div className='sm:col-span-2'>
						<FilePickerField
							id='contract-file'
							label={tx.labels.auditContractFile}
							value={form.file}
							chooseLabel={tx.chooseFile}
							emptyLabel={tx.noFile}
							disabled={isSubmitting}
							onChange={file => updateField('file', file)}
						/>
						{isEditing && existingContractFileUrl ? (
							<ExistingAttachment
								label={`${tx.currentFile}: ${tx.labels.auditContractFile}`}
								url={existingContractFileUrl}
								openLabel={tx.open}
							/>
						) : null}
					</div>
					<div className='sm:col-span-2'>
						<FilePickerField
							id='contract-cadastre-file'
							label={tx.labels.homeCadastreFile}
							value={form.cadastre_file}
							chooseLabel={tx.chooseFile}
							emptyLabel={tx.noFile}
							disabled={isSubmitting}
							onChange={file => updateField('cadastre_file', file)}
						/>
						{isEditing && existingCadastreFileUrl ? (
							<ExistingAttachment
								label={`${tx.currentFile}: ${tx.labels.homeCadastreFile}`}
								url={existingCadastreFileUrl}
								openLabel={tx.open}
							/>
						) : null}
					</div>
					<div className='sm:col-span-2'>
						<FilePickerField
							id='contract-house-image'
							label={tx.labels.companyContractFile}
							value={form.house_image}
							chooseLabel={tx.chooseFile}
							emptyLabel={tx.noFile}
							disabled={isSubmitting}
							onChange={file => updateField('house_image', file)}
						/>
						{isEditing && existingHouseImageUrl ? (
							<ExistingAttachment
								label={`${tx.currentFile}: ${tx.labels.companyContractFile}`}
								url={existingHouseImageUrl}
								openLabel={tx.open}
							/>
						) : null}
					</div>
					<div className='sm:col-span-2'>
						<FilePickerField
							id='contract-additional-file'
							label={tx.labels.additionalFile}
							value={form.additional_file}
							chooseLabel={tx.chooseFile}
							emptyLabel={tx.noFile}
							disabled={isSubmitting}
							onChange={file => updateField('additional_file', file)}
						/>
						{isEditing && existingAdditionalFileUrl ? (
							<ExistingAttachment
								label={`${tx.currentFile}: ${tx.labels.additionalFile}`}
								url={existingAdditionalFileUrl}
								openLabel={tx.open}
							/>
						) : null}
					</div>
				</div>

				<div className='rounded-xl bg-surface-card p-3 ring-1 ring-border-soft/45'>
					<div className='mb-2 flex items-center justify-between gap-2'>
						<p className={labelClassName}>{tx.labels.items}</p>
						<button
							type='button'
							className='inline-flex min-h-8 items-center justify-center rounded-lg bg-surface-subtle px-3 text-xs font-semibold text-text-secondary transition duration-fast hover:bg-surface-muted'
							onClick={() =>
								setForm(current => ({
									...current,
									items: [
										...current.items,
										{ product: '', quantity: 1, unit_price: '' },
									],
								}))
							}
							disabled={isSubmitting}
						>
							{tx.addItem}
						</button>
					</div>
					<div className='grid gap-2'>
						{form.items.map((item, index) => (
							<div
								key={`item-${index}`}
								className='grid min-w-0 gap-2 rounded-lg bg-surface-subtle/60 p-2 sm:grid-cols-[minmax(0,1.8fr)_96px_130px_auto]'
							>
								<div className='grid min-w-0 gap-1'>
									<FilterSelect
										value={item.product}
										options={products.map(product => ({
											value: product.id,
											label: product.name,
										}))}
										onChange={value => updateItemField(index, 'product', value)}
										disabled={isSubmitting || isLoadingReferences}
									/>
								</div>
								<input
									type='number'
									min={1}
									className={inputClassName}
									placeholder={tx.labels.quantity}
									value={item.quantity}
									onChange={event =>
										updateItemField(
											index,
											'quantity',
											event.target.value === '' ? '' : Number(event.target.value),
										)
									}
									disabled={isSubmitting}
								/>
								<input
									type='number'
									min={0}
									step='0.01'
									className={inputClassName}
									placeholder={tx.labels.unitPrice}
									value={item.unit_price}
									onChange={event =>
										updateItemField(index, 'unit_price', event.target.value)
									}
									disabled={isSubmitting}
								/>
								<button
									type='button'
									className='inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg bg-danger/10 px-2.5 text-xs font-semibold text-danger transition duration-fast hover:bg-danger/20 disabled:opacity-60'
									onClick={() =>
										setForm(current => ({
											...current,
											items:
												current.items.length > 1
													? current.items.filter((_, i) => i !== index)
													: current.items,
										}))
									}
									disabled={isSubmitting || form.items.length <= 1}
								>
									{tx.removeItem}
								</button>
							</div>
						))}
					</div>
				</div>

				{errorMessage ? (
					<p className='m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger'>
						{errorMessage}
					</p>
				) : null}

				<div className='mt-1 flex flex-wrap items-center gap-2'>
					<button
						type='button'
						className='inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-card px-4 text-sm font-semibold text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60'
						onClick={onClose}
						disabled={isSubmitting}
					>
						{tx.cancel}
					</button>
					<button
						type='submit'
						className='ml-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60'
						disabled={isSubmitting || !canSubmit}
					>
						{isSubmitting ? tx.saving : isEditing ? tx.editSubmit : tx.createSubmit}
					</button>
				</div>
			</form>
		</div>
	)
}



