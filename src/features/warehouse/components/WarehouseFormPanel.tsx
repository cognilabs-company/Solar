import type { FormEvent, PropsWithChildren, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from '../../../components/shared/icons/AppIcon'
import { EmptyState, LoadingState } from '../../../components/shared/page'

export const warehouseInputClassName = [
	'w-full rounded-lg border border-border-soft/60 bg-surface-card px-3.5 py-2.5 text-sm font-medium text-text-primary',
	'placeholder:text-text-muted outline-none transition duration-fast',
	'focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
	'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ')

export const warehouseLabelClassName =
	'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'

interface WarehouseFieldProps extends PropsWithChildren {
	label: string
	htmlFor?: string
	error?: string
	hint?: string
	className?: string
}

export function WarehouseField({
	label,
	htmlFor,
	error,
	hint,
	className,
	children,
}: WarehouseFieldProps) {
	return (
		<div className={['grid content-start gap-1.5', className ?? ''].join(' ')}>
			<label className={warehouseLabelClassName} htmlFor={htmlFor}>
				{label}
			</label>
			{children}
			{hint ? (
				<p className='m-0 text-[12px] leading-5 text-text-muted'>{hint}</p>
			) : null}
			{error ? (
				<p className='m-0 text-[12px] font-semibold text-danger'>{error}</p>
			) : null}
		</div>
	)
}

interface WarehouseReadonlyValueProps {
	label: string
	value: ReactNode
	hint?: string
}

/** Backend-calculated value, shown as-is and never sent back. */
export function WarehouseReadonlyValue({
	label,
	value,
	hint,
}: WarehouseReadonlyValueProps) {
	return (
		<div className='rounded-lg bg-primary/8 p-3 ring-1 ring-primary/15'>
			<p className={warehouseLabelClassName}>{label}</p>
			<p className='mt-1 text-sm font-semibold text-text-primary [overflow-wrap:anywhere]'>
				{value}
			</p>
			{hint ? (
				<p className='mt-0.5 text-[11px] leading-4 text-text-muted'>{hint}</p>
			) : null}
		</div>
	)
}

interface WarehouseFormPanelProps extends PropsWithChildren {
	eyebrow: string
	title: string
	subtitle?: string
	isLoading?: boolean
	loadError?: boolean
	isSubmitting: boolean
	canSubmit: boolean
	readOnly: boolean
	submitLabel: string
	submittingLabel: string
	errorMessage?: string | null
	onClose: () => void
	onSubmit: () => void
}

function WarehouseFormPanel({
	eyebrow,
	title,
	subtitle,
	isLoading = false,
	loadError = false,
	isSubmitting,
	canSubmit,
	readOnly,
	submitLabel,
	submittingLabel,
	errorMessage,
	onClose,
	onSubmit,
	children,
}: WarehouseFormPanelProps) {
	const { t } = useTranslation()

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		if (readOnly || isSubmitting || !canSubmit) {
			return
		}

		onSubmit()
	}

	return (
		<div
			className='fixed inset-0 z-50 flex justify-end bg-background-overlay/72 backdrop-blur-[3px]'
			onClick={() => {
				if (!isSubmitting) {
					onClose()
				}
			}}
			role='presentation'
		>
			<aside
				className='h-full w-full overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:max-w-[560px] min-[641px]:p-5'
				onClick={event => event.stopPropagation()}
				aria-label={title}
			>
				<header className='mb-4 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40'>
					<div className='flex items-start justify-between gap-3'>
						<div className='min-w-0'>
							<p className='m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary'>
								{eyebrow}
							</p>
							<h2 className='mt-1 font-display text-[1.45rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-text-primary [overflow-wrap:anywhere]'>
								{title}
							</h2>
							{subtitle ? (
								<p className='mt-1.5 text-sm leading-6 text-text-secondary'>
									{subtitle}
								</p>
							) : null}
						</div>

						<button
							type='button'
							className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60'
							onClick={onClose}
							disabled={isSubmitting}
							aria-label={t('warehouse.form.close')}
						>
							<AppIcon name='close' className='h-4.5 w-4.5' aria-hidden='true' />
						</button>
					</div>
				</header>

				{isLoading ? (
					<LoadingState
						title={t('warehouse.form.loadingTitle')}
						description={t('warehouse.form.loadingDescription')}
					/>
				) : loadError ? (
					<EmptyState
						title={t('warehouse.form.loadErrorTitle')}
						description={t('warehouse.form.loadErrorDescription')}
					/>
				) : (
					<form className='grid gap-3' onSubmit={handleSubmit} noValidate>
						<fieldset
							className='m-0 grid min-w-0 gap-3 border-0 p-0'
							disabled={readOnly || isSubmitting}
						>
							{children}
						</fieldset>

						{errorMessage ? (
							<p className='m-0 rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger'>
								{errorMessage}
							</p>
						) : null}

						{readOnly ? (
							<p className='m-0 rounded-lg bg-surface-subtle px-3 py-2 text-[12px] font-medium text-text-secondary'>
								{t('warehouse.readOnlyHint')}
							</p>
						) : null}

						<div className='mt-1 flex flex-wrap items-center gap-2'>
							<button
								type='button'
								className='inline-flex min-h-10 items-center justify-center rounded-lg bg-surface-card px-4 text-sm font-semibold text-text-secondary shadow-sm ring-1 ring-border-soft/40 transition duration-fast hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60'
								onClick={onClose}
								disabled={isSubmitting}
							>
								{readOnly ? t('warehouse.form.close') : t('common.cancel')}
							</button>
							{!readOnly ? (
								<button
									type='submit'
									className='ml-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition duration-fast hover:bg-primary-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60'
									disabled={isSubmitting || !canSubmit}
								>
									{isSubmitting ? submittingLabel : submitLabel}
								</button>
							) : null}
						</div>
					</form>
				)}
			</aside>
		</div>
	)
}

export default WarehouseFormPanel
