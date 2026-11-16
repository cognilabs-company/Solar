import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
	FiActivity,
	FiCheckCircle,
	FiClock,
	FiCreditCard,
	FiEdit2,
	FiFileText,
	FiSend,
	FiShield,
	FiTrash2,
	FiTruck,
	FiXCircle,
} from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useDetail } from '../../../components/hooks'
import { EmptyState, LoadingState, PageCard } from '../../../components/shared/page'
import { StatusBadge } from '../../../components/shared/data'
import AppIcon from '../../../components/shared/icons/AppIcon'
import { formatLocalizedDate } from '../../../i18n/date-format'
import {
	getAttachmentFilename,
	getAttachmentIconName,
	getAttachmentTypeLabel,
	isImageAttachment,
} from '../../../lib/attachments'
import { routePaths } from '../../../config/routes'
import { services } from '../../../services'
import type { Contract } from '../../../services/contracts'
import {
	getContractStatusLabel as getStatusLabel,
	getContractStatusTone as getStatusTone,
} from '../statusLabels'

export interface ContractsDetailPanelProps {
	contractId: string
	refreshToken?: number
	isRecalculating?: boolean
	onClose?: () => void
	onEdit?: (contract: Contract) => void
	onRequestDelete?: (contract: Contract) => void
	onRecalculate?: (contract: Contract) => void
}

const labelClassName =
	'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'
const valueClassName =
	'text-sm font-semibold text-text-primary [overflow-wrap:anywhere]'

const CONTRACT_STAGE_IDS = ['draft', 'audit', 'moderation', 'payment', 'finish'] as const

type ContractStageId = (typeof CONTRACT_STAGE_IDS)[number]
type StageTone = 'todo' | 'pending' | 'success' | 'danger'

function getCurrentStageIndex(status: string): number {
	if (
		status === 'canceled' ||
		status === 'in_lot' ||
		status === 'on_the_way' ||
		status === 'completed'
	) {
		return 4
	}
	if (status === 'payment_pending' || status === 'paid') {
		return 3
	}
	if (status === 'moderation' || status === 'contract_ready') {
		return 2
	}
	if (status === 'audit_pending' || status === 'audit_paid') {
		return 1
	}
	return 0
}

function getStageTone(stageId: ContractStageId, status: string): StageTone {
	if (status === 'canceled') {
		return 'danger'
	}

	const currentIndex = getCurrentStageIndex(status)
	const stageIndex = CONTRACT_STAGE_IDS.indexOf(stageId)

	if (stageIndex > currentIndex) {
		return 'todo'
	}
	if (stageIndex < currentIndex) {
		return 'success'
	}

	switch (stageId) {
		case 'draft':
			return 'success'
		case 'audit':
			return status === 'audit_pending' ? 'pending' : 'success'
		case 'moderation':
			return status === 'moderation' ? 'pending' : 'success'
		case 'payment':
			return status === 'payment_pending' ? 'pending' : 'success'
		case 'finish':
			return status === 'in_lot' || status === 'on_the_way' ? 'pending' : 'success'
		default:
			return 'todo'
	}
}

function getStageStatusLabel(
	stageId: ContractStageId,
	status: string,
	isRu: boolean,
	tone: StageTone,
): string {
	if (stageId === 'draft') {
		return getStatusLabel('draft', isRu)
	}
	if (stageId === 'audit') {
		return getStatusLabel(tone === 'success' ? 'audit_paid' : 'audit_pending', isRu)
	}
	if (stageId === 'moderation') {
		return getStatusLabel(tone === 'success' ? 'contract_ready' : 'moderation', isRu)
	}
	if (stageId === 'payment') {
		return getStatusLabel(tone === 'success' ? 'paid' : 'payment_pending', isRu)
	}
	if (tone === 'danger' || status === 'canceled') {
		return getStatusLabel('canceled', isRu)
	}
	if (tone === 'todo') {
		return getStatusLabel('in_lot', isRu)
	}
	if (status === 'in_lot' || status === 'on_the_way' || status === 'completed') {
		return getStatusLabel(status, isRu)
	}
	return getStatusLabel('completed', isRu)
}

function getStageIcon(stageId: ContractStageId, tone: StageTone, status: string) {
	if (tone === 'danger') {
		return FiXCircle
	}
	if (tone === 'pending') {
		if (stageId === 'moderation') {
			return FiActivity
		}
		return FiClock
	}
	if (tone === 'todo') {
		switch (stageId) {
			case 'audit':
				return FiShield
			case 'payment':
				return FiCreditCard
			case 'finish':
				return FiTruck
			case 'moderation':
				return FiActivity
			default:
				return FiFileText
		}
	}

	if (stageId === 'audit') {
		return FiShield
	}
	if (stageId === 'payment') {
		return FiCreditCard
	}
	if (stageId === 'finish') {
		return FiCheckCircle
	}
	return FiCheckCircle
}

function getToneClass(tone: StageTone): string {
	if (tone === 'danger') {
		return 'bg-danger-bg text-danger ring-danger/30'
	}
	if (tone === 'success') {
		return 'bg-success/15 text-success ring-success/30'
	}
	if (tone === 'pending') {
		return 'bg-warning/15 text-warning ring-warning/30'
	}
	return 'bg-surface-card text-text-muted ring-border-soft/45'
}

function getToneTextClass(tone: StageTone): string {
	if (tone === 'danger') {
		return 'text-danger'
	}
	if (tone === 'success') {
		return 'text-success'
	}
	if (tone === 'pending') {
		return 'text-warning'
	}
	return 'text-text-muted'
}

function getToneHex(tone: StageTone): string {
	if (tone === 'danger') {
		return '#ef4444'
	}
	if (tone === 'success') {
		return '#22c55e'
	}
	if (tone === 'pending') {
		return '#f59e0b'
	}
	return '#cbd5e1'
}

function ContractStatusTimeline({
	status,
	isRu,
}: {
	status: string
	isRu: boolean
}) {
	const isCanceled = status === 'canceled'
	const title = isRu ? '\u0425\u043e\u0434 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430' : 'Shartnoma jarayoni'
	const currentStageLabel = isRu ? '\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u044d\u0442\u0430\u043f' : 'Joriy bosqich'
	const currentStageIndex = getCurrentStageIndex(status)
	const currentTone = getStageTone(CONTRACT_STAGE_IDS[currentStageIndex], status)
	const currentLabel =
		currentTone === 'danger'
			? isRu
				? '\u041e\u0442\u043c\u0435\u043d\u0435\u043d'
				: 'Bekor'
			: currentTone === 'success'
				? isRu
					? '\u0423\u0441\u043f\u0435\u0448\u043d\u043e'
					: 'Muvaffaqiyatli'
				: isRu
					? '\u041e\u0436\u0438\u0434\u0430\u043d\u0438\u0435'
					: 'Kutilmoqda'
	const currentClass = getToneClass(currentTone)
	const CurrentIcon =
		currentTone === 'danger'
			? FiXCircle
			: currentTone === 'success'
				? FiCheckCircle
				: FiClock
	const stages = CONTRACT_STAGE_IDS.map(stageId => {
		const tone = getStageTone(stageId, status)
		return {
			id: stageId,
			tone,
			statusLabel: getStageStatusLabel(stageId, status, isRu, tone),
			icon: getStageIcon(stageId, tone, status),
		}
	})
	const canceledNote = isRu
		? '\u0414\u043e\u0433\u043e\u0432\u043e\u0440 \u043e\u0442\u043c\u0435\u043d\u0435\u043d. \u041f\u0440\u043e\u0446\u0435\u0441\u0441 \u043f\u043e \u0441\u0442\u0430\u0442\u0443\u0441\u0430\u043c \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d.'
		: "Shartnoma bekor qilingan. Statuslar bo'yicha jarayon to'xtatilgan."

	return (
		<div className='rounded-xl bg-gradient-to-br from-surface-subtle/85 via-surface-card to-surface-subtle/45 p-4 ring-1 ring-border-soft/45'>
			<div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
				<div className='min-w-0'>
					<p className={labelClassName}>{title}</p>
					<p className='mt-1 text-sm font-semibold text-text-secondary'>{currentStageLabel}</p>
				</div>
				<div
					className={[
						'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1',
						currentClass,
					].join(' ')}
				>
					<CurrentIcon className='h-4 w-4' />
					<span>{currentLabel}</span>
				</div>
			</div>
			<p className='mb-3 text-sm font-semibold text-text-primary'>{getStatusLabel(status, isRu)}</p>

			<div className='w-full pb-3 pt-1'>
				<div className='flex w-full items-start px-1'>
					{stages.map((stage, index) => {
						const Icon = stage.icon
						const circleClass = getToneClass(stage.tone)
						const textClass = getToneTextClass(stage.tone)
						const leftLineStyle =
							index > 0
								? {
										backgroundColor: getToneHex(stages[index - 1].tone),
									}
								: undefined
						const rightLineStyle =
							index < stages.length - 1
								? {
										backgroundColor: getToneHex(stage.tone),
									}
								: undefined
						return (
							<div key={stage.id} className='relative flex flex-1 flex-col items-center'>
								{index > 0 ? (
									<div
										className='absolute left-0 top-[20px] h-[2px] w-[calc(50%-20px)] opacity-90'
										style={leftLineStyle}
									/>
								) : null}
								{index < stages.length - 1 ? (
									<div
										className='absolute right-0 top-[20px] h-[2px] w-[calc(50%-20px)] opacity-90'
										style={rightLineStyle}
									/>
								) : null}
								<div
									className={[
										'relative z-[1] inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 transition duration-fast',
										circleClass,
									].join(' ')}
								>
									<Icon className='h-5 w-5' />
								</div>
								<p className={`mt-2 w-full px-1 text-center text-xs font-semibold leading-tight ${textClass}`}>
									{stage.statusLabel}
								</p>
							</div>
						)
					})}
				</div>
			</div>

			{isCanceled ? (
				<div className='mt-3 inline-flex items-center gap-2 rounded-lg bg-danger-bg px-3 py-2 text-xs font-semibold text-danger ring-1 ring-danger/25'>
					<FiXCircle className='h-4 w-4' />
					{canceledNote}
				</div>
			) : null}
		</div>
	)
}

function getDeliveryStatusLabel(
	status: string | null | undefined,
	isRu: boolean,
): string | null {
	if (!status) {
		return null
	}
	if (isRu) {
		const map: Record<string, string> = {
			pending: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044f",
			in_progress: "\u0412 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u0435",
			delivered: "\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d\u043e",
			canceled: "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u043e",
		}
		return map[status] ?? null
	}

	const map: Record<string, string> = {
		pending: 'Kutilmoqda',
		in_progress: 'Jarayonda',
		delivered: 'Yetkazilgan',
		canceled: 'Bekor qilingan',
	}
	return map[status] ?? null
}
function formatDetailsText(details: Contract['details']): string {
	if (!details) {
		return '-'
	}
	if (typeof details === 'string') {
		const trimmed = details.trim()
		return trimmed.length ? trimmed : '-'
	}
	try {
		// Details can contain nested objects (e.g. pricing breakdown). Render as readable JSON.
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

function readDetailsString(details: Record<string, unknown>, key: string): string {
	const value = details[key]
	if (value === null || value === undefined) {
		return ''
	}
	return String(value)
}

type PlainObject = Record<string, unknown>
const HIDDEN_CONTRACT_DETAIL_KEYS = new Set([
	'object_type',
	'customer_segment',
	'desired_power_kw',
	'requested_power_kw',
	'audit_power_kw',
	'audit_conclusion_kw',
	'eligible_subsidy_kw',
	'subsidy_reference_power_kw',
	'estimated_subsidy_amount',
	'monthly_bill',
	'solution_type',
])

function isPlainObject(value: unknown): value is PlainObject {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function humanizeKey(key: string): string {
	return key
		.replace(/_/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^\w/, match => match.toUpperCase())
}

function formatSmartValue(
	key: string,
	value: unknown,
	locale: string,
	currencyLabel: string,
): string {
	if (value === null || value === undefined) {
		return '-'
	}
	if (typeof value === 'boolean') {
		return value ? 'true' : 'false'
	}
	if (typeof value === 'number') {
		if (key.endsWith('_percent')) {
			return `${value}%`
		}
		if (key.endsWith('_kw') || key.includes('power')) {
			return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} kW`
		}
		if (key.endsWith('_amount') || key.endsWith('_price')) {
			return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} ${currencyLabel}`
		}
		return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
	}
	if (typeof value === 'string') {
		const trimmed = value.trim()
		if (!trimmed.length) {
			return '-'
		}
		const asNumber = Number(trimmed)
		if (Number.isFinite(asNumber)) {
			return formatSmartValue(key, asNumber, locale, currencyLabel)
		}
		return trimmed
	}
	if (Array.isArray(value)) {
		const parts = value
			.map(item => formatSmartValue(key, item, locale, currencyLabel))
			.filter(Boolean)
		return parts.length ? parts.join(', ') : '-'
	}
	if (isPlainObject(value)) {
		return '[object]'
	}
	return String(value)
}

function getDetailsLabel(key: string, isRu: boolean): string {
	const ru: Record<string, string> = {
		pricing_breakdown: '\u0420\u0430\u0441\u0447\u0435\u0442 \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u0438',
		base_price: '\u0411\u0430\u0437\u043e\u0432\u0430\u044f \u0446\u0435\u043d\u0430',
		subsidy_amount: '\u0421\u0443\u043c\u043c\u0430 \u0441\u0443\u0431\u0441\u0438\u0434\u0438\u0438',
		customer_amount: '\u0421\u0443\u043c\u043c\u0430 \u0434\u043b\u044f \u043a\u043b\u0438\u0435\u043d\u0442\u0430',
		subsidy_percent: '\u0421\u0443\u0431\u0441\u0438\u0434\u0438\u044f (%)',
		audit_power_kw: '\u0410\u0443\u0434\u0438\u0442 \u043c\u043e\u0449\u043d\u043e\u0441\u0442\u044c',
		panel_type: '\u0422\u0438\u043f \u043f\u0430\u043d\u0435\u043b\u0438',
		inverter_type: '\u0422\u0438\u043f \u0438\u043d\u0432\u0435\u0440\u0442\u043e\u0440\u0430',
	}

	const uz: Record<string, string> = {
		pricing_breakdown: 'Narx hisob-kitobi',
		base_price: 'Bazaviy narx',
		subsidy_amount: 'Subsidiya summasi',
		customer_amount: 'Mijoz summasi',
		subsidy_percent: 'Subsidiya (%)',
		audit_power_kw: 'Audit quvvati',
		panel_type: 'Panel turi',
		inverter_type: 'Invertor turi',
	}

	return (isRu ? ru[key] : uz[key]) ?? humanizeKey(key)
}

function DetailsGrid({
	data,
	isRu,
	locale,
}: {
	data: PlainObject
	isRu: boolean
	locale: string
}) {
	const currencyLabel = isRu ? '\u0441\u0443\u043c' : "so'm"
	const entries = Object.entries(data).filter(
		([key, value]) => value !== undefined && !HIDDEN_CONTRACT_DETAIL_KEYS.has(key),
	)

	if (!entries.length) {
		return <p className='mt-1 text-sm font-semibold text-text-secondary'>-</p>
	}

	return (
		<div className='mt-2 grid gap-2 sm:grid-cols-2'>
			{entries.map(([key, value]) => {
				const label = getDetailsLabel(key, isRu)
				const formatted = formatSmartValue(key, value, locale, currencyLabel)
				const isAmount = key.endsWith('_amount') || key.endsWith('_price')
				return (
					<div
						key={key}
						className='rounded-lg bg-surface-subtle/50 p-3 ring-1 ring-border-soft/25'
					>
						<p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>
							{label}
						</p>
						<p
							className={[
								'mt-1 font-semibold [overflow-wrap:anywhere]',
								isAmount ? 'text-base text-text-primary' : 'text-sm text-text-primary',
							].join(' ')}
						>
							{formatted}
						</p>
					</div>
				)
			})}
		</div>
	)
}

function ContractsDetailsView({
	details,
	isRu,
	locale,
}: {
	details: Contract['details']
	isRu: boolean
	locale: string
}) {
	if (!details) {
		return <p className='mt-1 text-sm font-semibold text-text-secondary'>-</p>
	}

	if (typeof details === 'string') {
		const trimmed = details.trim()
		return (
			<p className='mt-1 text-sm font-semibold text-text-primary [overflow-wrap:anywhere]'>
				{trimmed.length ? trimmed : '-'}
			</p>
		)
	}

	if (!isPlainObject(details)) {
		return (
			<pre className='mt-2 whitespace-pre-wrap break-words rounded-lg bg-surface-subtle/60 p-3 text-xs font-medium leading-relaxed text-text-primary ring-1 ring-border-soft/25'>
				{formatDetailsText(details)}
			</pre>
		)
	}

	const pricing = isPlainObject(details.pricing_breakdown)
		? (details.pricing_breakdown as PlainObject)
		: null

	const visibleDetails = Object.fromEntries(
		Object.entries(details).filter(([key]) => !HIDDEN_CONTRACT_DETAIL_KEYS.has(key)),
	)
	const hasExtra = Object.keys(visibleDetails).some(key => key !== 'pricing_breakdown')

	return (
		<div className='mt-2 grid gap-2'>
			{pricing ? (
				<div className='rounded-xl bg-surface-subtle/60 p-3 ring-1 ring-border-soft/30'>
					<p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-primary'>
						{getDetailsLabel('pricing_breakdown', isRu)}
					</p>
					<DetailsGrid data={pricing} isRu={isRu} locale={locale} />
				</div>
			) : null}

			{hasExtra ? (
				<div className='rounded-xl bg-surface-subtle/40 p-3 ring-1 ring-border-soft/25'>
					<p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted'>
						{isRu
							? '\u0414\u0440\u0443\u0433\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0435'
							: "Boshqa ma'lumotlar"}
					</p>
					<pre className='mt-2 whitespace-pre-wrap break-words rounded-lg bg-surface-card/70 p-3 text-xs font-medium leading-relaxed text-text-primary ring-1 ring-border-soft/25'>
						{formatDetailsText(visibleDetails)}
					</pre>
				</div>
			) : null}
		</div>
	)
}
export function ContractsDetailPanel({
	contractId,
	refreshToken = 0,
	isRecalculating = false,
	onClose,
	onEdit,
	onRequestDelete,
	onRecalculate,
}: ContractsDetailPanelProps) {
	const { i18n } = useTranslation()
	const isRu = i18n.language === 'ru'
	const locale = isRu ? 'ru-RU' : 'uz-UZ'
	const navigate = useNavigate()
	const tx = isRu
		? {
				title: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430',
				loadingTitle: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...',
				loadingDescription:
					'\u041f\u043e\u043b\u0443\u0447\u0430\u0435\u043c \u0434\u0430\u043d\u043d\u044b\u0435 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430.',
				errorTitle: '\u0414\u043e\u0433\u043e\u0432\u043e\u0440 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d',
				errorDescription:
					'\u0414\u043e\u0433\u043e\u0432\u043e\u0440 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0438\u043b\u0438 \u0431\u044b\u043b \u0443\u0434\u0430\u043b\u0435\u043d.',
				edit: '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
				delete: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
				fields: {
					client: '\u041a\u043b\u0438\u0435\u043d\u0442',
					status: '\u0421\u0442\u0430\u0442\u0443\u0441',
					fullName: '\u0424.\u0418.\u0428.',
					requestedPower:
						'\u0417\u0430\u043f\u0440\u043e\u0448\u0435\u043d\u043d\u0430\u044f \u043c\u043e\u0449\u043d\u043e\u0441\u0442\u044c',
					phone: '\u0422\u0435\u043b\u0435\u0444\u043e\u043d \u043a\u043b\u0438\u0435\u043d\u0442\u0430',
					note: '\u041f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435',
					oneIdCode: 'One ID \u043a\u043e\u0434',
					inverter: '\u0422\u0438\u043f \u0438\u043d\u0432\u0435\u0440\u0442\u043e\u0440\u0430',
					panel: '\u0422\u0438\u043f \u043f\u0430\u043d\u0435\u043b\u0438',
					agreedAmount:
						'\u0421\u043e\u0433\u043b\u0430\u0441\u043e\u0432\u0430\u043d\u043d\u0430\u044f \u0441\u0443\u043c\u043c\u0430',
					paidAmount: '\u0412\u044b\u0434\u0430\u043d\u043d\u0430\u044f \u0441\u0443\u043c\u043c\u0430',
					givenSubsidyAmount:
						'\u0412\u044b\u0434\u0430\u043d\u043d\u0430\u044f \u0441\u0443\u0431\u0441\u0438\u0434\u0438\u044f',
					address: '\u0410\u0434\u0440\u0435\u0441 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0438',
					auditorCompanyName:
						'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0430\u0443\u0434\u0438\u0442\u043e\u0440\u0441\u043a\u043e\u0439 \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0438',
					auditorPhone: '\u041d\u043e\u043c\u0435\u0440 \u0430\u0443\u0434\u0438\u0442\u043e\u0440\u0430',
					auditConclusionText:
						'\u0410\u0443\u0434\u0438\u0442\u043e\u0440\u0441\u043a\u043e\u0435 \u0437\u0430\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435',
					lotDeadlineAt: '\u0421\u0440\u043e\u043a \u043b\u043e\u0442\u0430',
					installerFeeAmount: '\u0421\u0443\u043c\u043c\u0430 \u0443\u0441\u0442\u0430',
					details: '\u0414\u0435\u0442\u0430\u043b\u0438',
					attachments: '\u0424\u0430\u0439\u043b\u044b \u0438 \u0444\u043e\u0442\u043e',
					auditContractFile:
						'\u0424\u0430\u0439\u043b \u0430\u0443\u0434\u0438\u0442 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430',
					cadastreFile:
						'\u0424\u0430\u0439\u043b \u043a\u0430\u0434\u0430\u0441\u0442\u0440\u0430 \u0434\u043e\u043c\u0430',
					companyContractFile:
						'\u0424\u0430\u0439\u043b \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430 \u0444\u0438\u0440\u043c\u044b',
					additionalFile:
						'\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0444\u0430\u0439\u043b',
					open: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c',
					created: '\u0421\u043e\u0437\u0434\u0430\u043d',
					updated: '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d',
					items: '\u041f\u043e\u0437\u0438\u0446\u0438\u0438 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430',
				},
			}
		: {
				title: 'Shartnoma profili',
				loadingTitle: 'Yuklanmoqda...',
				loadingDescription: "Shartnoma ma'lumotlari olinmoqda.",
				errorTitle: 'Shartnoma topilmadi',
				errorDescription: "Shartnoma mavjud emas yoki o'chirilgan.",
				edit: 'Tahrirlash',
				delete: "O'chirish",
				fields: {
					client: 'Mijoz',
					status: 'Holat',
					fullName: 'F.I.SH',
					requestedPower: "So'ralgan quvvat",
					phone: 'Mijoz telefon raqami',
					note: 'Izoh',
					oneIdCode: 'One ID kodi',
					inverter: 'Invertor turi',
					panel: 'Panel turi',
					agreedAmount: 'Kelishilgan summa',
					paidAmount: 'Berilgan summa',
					givenSubsidyAmount: 'Berilgan subsidiya miqdori',
					address: "O'rnatish manzili",
					auditorCompanyName: 'Auditor tashkilot nomi',
					auditorPhone: 'Auditor raqami',
					auditConclusionText: 'Audit bergan xulosa',
					lotDeadlineAt: "Lotga qo'yilgan muddat",
					installerFeeAmount: 'Obyekt usta haqi summasi',
					details: 'Tafsilotlar',
					attachments: 'Fayllar va rasmlar',
					auditContractFile: 'Audit shartnoma fayl',
					cadastreFile: 'Uy kadastr fayl',
					companyContractFile: 'Firma shartnomasi fayl',
					additionalFile: "Qo'shimcha fayl",
					open: "Ko'rish",
					created: 'Yaratilgan',
					updated: 'Yangilangan',
					items: 'Shartnoma pozitsiyalari',
				},
			}

	const fetchContract = useCallback(
		() => services.contracts.getContract(contractId),
		[contractId],
	)
	const [state, { fetch: fetchContractDetail }] = useDetail(fetchContract, {
		autoFetch: true,
	})

	useEffect(() => {
		if (refreshToken > 0) {
			void fetchContractDetail()
		}
	}, [fetchContractDetail, refreshToken])

	if (state.isLoading) {
		return <LoadingState title={tx.loadingTitle} description={tx.loadingDescription} />
	}
	if (state.error || !state.data) {
		return <EmptyState title={tx.errorTitle} description={tx.errorDescription} />
	}

	const contract = state.data
	const contractDetails = readDetailsObject(contract.details)
	const contractNote = contract.note || readDetailsString(contractDetails, 'note')
	const oneIdCode = contract.one_id_code || readDetailsString(contractDetails, 'one_id_code')
	const agreedAmount =
		(contract.agreed_amount != null ? String(contract.agreed_amount) : '') ||
		readDetailsString(contractDetails, 'agreed_amount') ||
		(contract.total_amount != null ? String(contract.total_amount) : '')
	const paidAmount =
		(contract.paid_amount != null ? String(contract.paid_amount) : '') ||
		readDetailsString(contractDetails, 'paid_amount') ||
		(contract.customer_amount != null ? String(contract.customer_amount) : '')
	const givenSubsidyAmount =
		readDetailsString(contractDetails, 'given_subsidy_amount') ||
		(contract.subsidy_amount != null ? String(contract.subsidy_amount) : '')
	const auditorCompanyName =
		contract.auditor_organization_name ||
		readDetailsString(contractDetails, 'auditor_company_name') ||
		readDetailsString(contractDetails, 'auditor_organization_name')
	const auditorPhone =
		contract.auditor_phone ||
		readDetailsString(contractDetails, 'auditor_phone')
	const auditConclusionText =
		contract.audit_conclusion ||
		readDetailsString(contractDetails, 'audit_conclusion_text') ||
		readDetailsString(contractDetails, 'audit_conclusion')
	const lotDeadlineAt =
		contract.lot_deadline ||
		readDetailsString(contractDetails, 'lot_deadline_at') ||
		readDetailsString(contractDetails, 'lot_deadline')
	const installerFeeAmount =
		(contract.installer_fee_amount != null ? String(contract.installer_fee_amount) : '') ||
		readDetailsString(contractDetails, 'installer_fee_amount')
	const additionalFileUrl =
		contract.additional_file_url ||
		readDetailsString(contractDetails, 'additional_file_url')
	const recalculateLabel = isRu ? "\u041f\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u0442\u044c" : 'Qayta hisoblash'
	const currencyLabel = isRu ? '\u0441\u0443\u043c' : "so'm"
	const contractFileUrl =
		contract.audit_contract_file_url ||
		contract.file_url ||
		(typeof contract.audit_contract_file === 'string' ? contract.audit_contract_file : '') ||
		(typeof contract.file === 'string' ? contract.file : '') ||
		''
	const cadastreFileUrl =
		contract.home_cadastre_file_url ||
		contract.cadastre_file_url ||
		(typeof contract.home_cadastre_file === 'string' ? contract.home_cadastre_file : '') ||
		(typeof contract.cadastre_file === 'string' ? contract.cadastre_file : '') ||
		''
	const houseImageUrl =
		contract.company_contract_file_url ||
		contract.house_image_url ||
		(typeof contract.company_contract_file === 'string' ? contract.company_contract_file : '') ||
		(typeof contract.house_image === 'string' ? contract.house_image : '') ||
		''
	const attachments = [
		{ key: 'contract', label: tx.fields.auditContractFile, url: contractFileUrl },
		{ key: 'cadastre', label: tx.fields.cadastreFile, url: cadastreFileUrl },
		{ key: 'house', label: tx.fields.companyContractFile, url: houseImageUrl },
		{ key: 'additional', label: tx.fields.additionalFile, url: additionalFileUrl },
	].filter(item => Boolean(item.url))
	return (
		<div className='grid gap-3'>
			<header className='mb-1 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40'>
				<div className='flex items-start justify-between gap-3'>
					<div className='min-w-0'>
						<p className='m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary'>
							{tx.title}
						</p>
						<h2 className='mt-1 font-display text-[1.45rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-text-primary [overflow-wrap:anywhere]'>
							{contract.title}
						</h2>
					</div>
					<button
						type='button'
						className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20'
						onClick={onClose}
						aria-label={tx.title}
					>
						<AppIcon name='close' className='h-4.5 w-4.5' aria-hidden='true' />
					</button>
				</div>
				<div className='mt-3'>
					<StatusBadge
						tone={getStatusTone(contract.status)}
						status={contract.status}
						label={getStatusLabel(contract.status, isRu)}
					/>
				</div>
			</header>

			<PageCard>
				<ContractStatusTimeline status={contract.status} isRu={isRu} />
			</PageCard>

			<PageCard>
				<div className='grid gap-2.5 sm:grid-cols-2'>
					{contract.client && contract.client_name ? (
						<div
							className='cursor-pointer rounded-lg bg-surface-subtle/80 p-3'
							role='button'
							tabIndex={0}
							onClick={() => {
								onClose?.()
								navigate(routePaths.clients, { state: { clientId: contract.client } })
							}}
							onKeyDown={event => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault()
									onClose?.()
									navigate(routePaths.clients, { state: { clientId: contract.client } })
								}
							}}
							aria-label={contract.client_name}
						>
							<p className={labelClassName}>{tx.fields.client}</p>
							<p className={`mt-1 ${valueClassName}`}>{contract.client_name}</p>
						</div>
					) : (
						<div className='rounded-lg bg-surface-subtle/80 p-3'>
							<p className={labelClassName}>{tx.fields.client}</p>
							<p className={`mt-1 ${valueClassName}`}>{contract.client_name || '-'}</p>
						</div>
					)}
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.status}</p>
						<p className={`mt-1 ${valueClassName}`}>
							{getStatusLabel(contract.status, isRu)}
						</p>
					</div>
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.fullName}</p>
						<p className={`mt-1 ${valueClassName}`}>{contract.title || '-'}</p>
					</div>
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.requestedPower}</p>
						<p className={`mt-1 ${valueClassName}`}>
							{formatSmartValue('requested_power_kw', contract.requested_power_kw, locale, currencyLabel)}
						</p>
					</div>
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.phone}</p>
						<p className={`mt-1 ${valueClassName}`}>{contract.customer_phone || '-'}</p>
					</div>
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.note}</p>
						<p className={`mt-1 ${valueClassName}`}>{contractNote || '-'}</p>
					</div>
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.oneIdCode}</p>
						<p className={`mt-1 ${valueClassName}`}>{oneIdCode || '-'}</p>
					</div>
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.inverter}</p>
						<p className={`mt-1 ${valueClassName}`}>
							{contract.inverter_type_label || contract.inverter_type || '-'}
						</p>
					</div>
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.panel}</p>
						<p className={`mt-1 ${valueClassName}`}>
							{contract.panel_type_label || contract.panel_type || '-'}
						</p>
					</div>
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.agreedAmount}</p>
						<p className={`mt-1 ${valueClassName}`}>
							{formatSmartValue('agreed_amount', agreedAmount, locale, currencyLabel)}
						</p>
					</div>
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.paidAmount}</p>
						<p className={`mt-1 ${valueClassName}`}>
							{formatSmartValue('paid_amount', paidAmount, locale, currencyLabel)}
						</p>
					</div>
					<div className='rounded-lg bg-surface-subtle/80 p-3'>
						<p className={labelClassName}>{tx.fields.givenSubsidyAmount}</p>
						<p className={`mt-1 ${valueClassName}`}>
							{formatSmartValue('given_subsidy_amount', givenSubsidyAmount, locale, currencyLabel)}
						</p>
					</div>
				<div className='rounded-lg bg-surface-subtle/80 p-3 sm:col-span-2'>
					<p className={labelClassName}>{tx.fields.address}</p>
					<p className={`mt-1 ${valueClassName}`}>{contract.installation_address || '-'}</p>
				</div>
				<div className='rounded-lg bg-surface-subtle/80 p-3'>
					<p className={labelClassName}>{tx.fields.auditorCompanyName}</p>
					<p className={`mt-1 ${valueClassName}`}>{auditorCompanyName || '-'}</p>
				</div>
				<div className='rounded-lg bg-surface-subtle/80 p-3'>
					<p className={labelClassName}>{tx.fields.auditorPhone}</p>
					<p className={`mt-1 ${valueClassName}`}>{auditorPhone || '-'}</p>
				</div>
				<div className='rounded-lg bg-surface-subtle/80 p-3'>
					<p className={labelClassName}>{tx.fields.auditConclusionText}</p>
					<p className={`mt-1 ${valueClassName}`}>{auditConclusionText || '-'}</p>
				</div>
				<div className='rounded-lg bg-surface-subtle/80 p-3'>
					<p className={labelClassName}>{tx.fields.lotDeadlineAt}</p>
					<p className={`mt-1 ${valueClassName}`}>{lotDeadlineAt || '-'}</p>
				</div>
				<div className='rounded-lg bg-surface-subtle/80 p-3'>
					<p className={labelClassName}>{tx.fields.installerFeeAmount}</p>
					<p className={`mt-1 ${valueClassName}`}>
						{formatSmartValue('installer_fee_amount', installerFeeAmount, locale, currencyLabel)}
					</p>
				</div>
			</div>
		</PageCard>

		<PageCard>
			<div className='flex items-start justify-between gap-3'>
				<div>
					<p className={labelClassName}>{tx.fields.attachments}</p>
					<p className='mt-1 text-sm font-semibold text-text-secondary'>
						{attachments.length ? `${attachments.length}` : '-'}
					</p>
				</div>
			</div>

			{attachments.length ? (
				<div className='mt-2 grid gap-2 sm:grid-cols-2'>
					{attachments.map(item => {
						const previewable = isImageAttachment(item.url)
						return (
							<div
								key={item.key}
								className='rounded-xl bg-surface-subtle/60 p-3 ring-1 ring-border-soft/25'
							>
								<div className='flex items-start justify-between gap-3'>
									<div className='min-w-0'>
										<p className={labelClassName}>{item.label}</p>
										<div className='mt-1 flex min-w-0 items-center gap-2'>
											<AppIcon
												name={getAttachmentIconName(item.url)}
												className='h-4 w-4 shrink-0 text-text-muted'
												aria-hidden='true'
											/>
											<span className='inline-flex h-5 shrink-0 items-center rounded-sm bg-surface-muted px-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-text-primary ring-1 ring-border-soft/40'>
												{getAttachmentTypeLabel(item.url)}
											</span>
											<p className={`min-w-0 truncate ${valueClassName}`}>
												{getAttachmentFilename(item.url)}
											</p>
										</div>
									</div>
									<a
										className='inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-surface-card px-3 text-sm font-semibold text-text-primary shadow-sm ring-1 ring-border-soft/35 transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20'
										href={item.url}
										target='_blank'
										rel='noreferrer'
									>
										<AppIcon
											name={previewable ? 'search' : 'download'}
											className='h-4 w-4'
											aria-hidden='true'
										/>
										{tx.fields.open}
									</a>
								</div>

								{previewable ? (
									<a
										href={item.url}
										target='_blank'
										rel='noreferrer'
										className='mt-3 block overflow-hidden rounded-lg ring-1 ring-border-soft/35'
									>
										<img
											src={item.url}
											alt={item.label}
											loading='lazy'
											className='h-44 w-full bg-surface-card object-cover'
										/>
									</a>
								) : null}
							</div>
						)
					})}
				</div>
			) : (
				<div className='mt-2 rounded-lg bg-surface-subtle/70 p-3 text-sm font-semibold text-text-secondary'>
					-
				</div>
			)}
		</PageCard>

		<PageCard>
			<p className={labelClassName}>{tx.fields.items}</p>
			<div className='mt-2 grid gap-2'>
				{contract.items?.length ? (
					contract.items.map((item, index) => (
						<div
							key={item.id ?? `${item.product}-${index}`}
							className='rounded-lg bg-surface-subtle/70 p-3 text-sm text-text-primary'
						>
							{item.product_name || item.product} x {item.quantity} - {String(item.unit_price)}
						</div>
					))
				) : (
					<div className='rounded-lg bg-surface-subtle/70 p-3 text-sm text-text-secondary'>-</div>
				)}
			</div>
		</PageCard>

		<PageCard>
			<div className='grid gap-2.5 sm:grid-cols-2'>
				<div className='rounded-lg bg-surface-subtle/35 p-3 ring-1 ring-border-soft/20'>
					<p className={labelClassName}>{tx.fields.created}</p>
					<p className={`mt-1 ${valueClassName}`}>
						{formatLocalizedDate(contract.created_at, locale, {
							locale,
							withYear: true,
							withTime: true,
							shortMonth: true,
							fallback: '-',
						})}
					</p>
				</div>
				<div className='rounded-lg bg-surface-subtle/35 p-3 ring-1 ring-border-soft/20'>
					<p className={labelClassName}>{tx.fields.updated}</p>
					<p className={`mt-1 ${valueClassName}`}>
						{formatLocalizedDate(contract.updated_at, locale, {
							locale,
							withYear: true,
							withTime: true,
							shortMonth: true,
							fallback: '-',
						})}
					</p>
				</div>
			</div>
		</PageCard>

		<div className='mt-1 flex flex-wrap items-center gap-2'>
			<button
				type='button'
				className='inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-info-bg px-4 text-sm font-semibold text-info shadow-sm ring-1 ring-info/25 transition duration-fast hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/30 disabled:cursor-not-allowed disabled:opacity-60'
				onClick={() => onRecalculate?.(contract)}
				disabled={isRecalculating}
			>
				<AppIcon name='activity' className='h-4 w-4' />
				{recalculateLabel}
			</button>
			<button
				type='button'
				className='inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35'
				onClick={() => onEdit?.(contract)}
			>
				<FiEdit2 className='h-4 w-4' />
				{tx.edit}
			</button>
			<button
				type='button'
				className='inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-surface-card px-4 text-sm font-semibold text-danger shadow-sm ring-1 ring-danger/25 transition duration-fast hover:bg-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/25'
				onClick={() => onRequestDelete?.(contract)}
			>
				<FiTrash2 className='h-4 w-4' />
				{tx.delete}
			</button>
		</div>

		</div>
	)
}


