// @ts-nocheck

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from '../../../components/shared/icons/AppIcon'
import ConfirmDialog from '../../../components/shared/dialogs/ConfirmDialog'
import { StatusBadge } from '../../../components/shared/data'
import {
	EmptyState,
	LoadingState,
	PageCard,
} from '../../../components/shared/page'
import { extractApiErrorMessage } from '../../../lib/api-error'
import { services } from '../../../services'
import type { AppNotification, EntityId } from '../../../types/domain'
import {
	formatNotificationDateTime,
	formatNotificationMessage,
	formatNotificationTitle,
	getFormattedNotificationMetadata,
	getNotificationChannelClassName,
	getNotificationChannelLabel,
	getNotificationReadLabel,
	getNotificationUserLabel,
} from '../utils/notification-format'

interface NotificationDetailPanelProps {
	notificationId: EntityId
	onClose: () => void
	onNotificationRead: (notification: AppNotification) => void
	onNotificationDeleted: (notificationId: EntityId) => void
}

const labelClassName =
	'text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'

const valueClassName =
	'text-sm font-semibold text-text-primary [overflow-wrap:anywhere]'

function NotificationDetailPanel({
	notificationId,
	onClose,
	onNotificationRead,
	onNotificationDeleted,
}: NotificationDetailPanelProps) {
	const { t, i18n } = useTranslation()
	const [notification, setNotification] = useState<AppNotification | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [hasError, setHasError] = useState(false)
	const [deleteError, setDeleteError] = useState<string | null>(null)
	const [isDeleting, setIsDeleting] = useState(false)
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

	const metadataEntries = notification
		? getFormattedNotificationMetadata(notification.metadata, notification.user, i18n.language)
		: []

	useEffect(() => {
		let isActive = true

		async function loadNotification() {
			setIsLoading(true)
			setHasError(false)

			try {
				let resolvedNotification =
					await services.notifications.getNotification(notificationId)
				if (!isActive) {
					return
				}

				if (resolvedNotification && !resolvedNotification.is_read) {
					try {
						const updatedNotification = await services.notifications.markAsRead(
							resolvedNotification.id,
						)

						if (!isActive) {
							return
						}

						if (updatedNotification) {
							resolvedNotification = updatedNotification
							onNotificationRead(updatedNotification)
							window.dispatchEvent(new CustomEvent('notifications:changed'))
						}
					} catch {
						// Keep detail available even if marking read fails.
					}
				}

				setNotification(resolvedNotification)
			} catch {
				if (!isActive) {
					return
				}

				setHasError(true)
				setNotification(null)
			} finally {
				if (isActive) {
					setIsLoading(false)
				}
			}
		}

		void loadNotification()

		return () => {
			isActive = false
		}
	}, [notificationId, onNotificationRead])

	useEffect(() => {
		function handleEscape(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onClose()
			}
		}

		window.addEventListener('keydown', handleEscape)
		return () => {
			window.removeEventListener('keydown', handleEscape)
		}
	}, [onClose])

	async function handleDeleteNotification() {
		if (!notification) {
			return
		}

		setIsDeleting(true)
		setDeleteError(null)
		try {
			await services.notifications.delete(notification.id)
			onNotificationDeleted(notification.id)
			window.dispatchEvent(new CustomEvent('notifications:changed'))
			setIsDeleteDialogOpen(false)
			onClose()
		} catch (error) {
			// Used to close the dialog in `finally` even on failure, which looked
			// like a successful delete. Keep it open and show the reason instead.
			setDeleteError(extractApiErrorMessage(error, t('notifications.deleteError')))
		} finally {
			setIsDeleting(false)
		}
	}

	return (
		<div
			className='fixed inset-0 z-40 flex justify-end bg-background-overlay/72 backdrop-blur-[3px]'
			onClick={onClose}
			role='presentation'
		>
			<aside
				className='h-full w-full overflow-y-auto bg-background-subtle p-4 shadow-xl ring-1 ring-border-soft/50 min-[641px]:max-w-[560px] min-[641px]:p-5'
				onClick={event => event.stopPropagation()}
				aria-label={t('notifications.detailPanelAria')}
			>
				<header className='mb-4 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-border-soft/40 transition duration-base hover:shadow-md hover:ring-border-soft/60'>
					<div className='flex items-start justify-between gap-3'>
						<div className='min-w-0'>
							<p className='m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary'>
								{t('notifications.itemEyebrow')}
							</p>
							<h2 className='mt-1 font-display text-[1.35rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-text-primary [overflow-wrap:anywhere]'>
								{notification
									? formatNotificationTitle(notification.title, i18n.language)
									: t('notifications.detailPanelTitle')}
							</h2>
						</div>

						<button
							type='button'
							className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-primary shadow-sm transition duration-fast hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20'
							onClick={onClose}
							aria-label={t('notifications.detailPanelClose')}
						>
							<AppIcon
								name='close'
								className='h-4.5 w-4.5'
								aria-hidden='true'
							/>
						</button>
					</div>

					{!isLoading && notification ? (
						<div className='mt-3 flex flex-wrap items-center gap-2'>
							<span
								className={[
									'inline-flex min-h-7 items-center rounded-pill px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
									getNotificationChannelClassName(notification.channel),
								].join(' ')}
							>
								{getNotificationChannelLabel(notification.channel, i18n.language)}
							</span>
							<StatusBadge
								status={notification.is_read ? 'read' : 'unread'}
								label={getNotificationReadLabel(notification.is_read, i18n.language)}
							/>
						</div>
					) : null}
				</header>

				<div className='grid gap-3'>
					{isLoading ? (
						<LoadingState
							title={t('notifications.loadingTitle')}
							description={t('notifications.loadingDetailDescription')}
						/>
					) : null}

					{!isLoading && (hasError || !notification) ? (
						<EmptyState
							title={t('notifications.detailErrorTitle')}
							description={t('notifications.detailErrorDescription')}
						/>
					) : null}

					{!isLoading && notification ? (
						<>
							<PageCard>
								<div className='grid gap-4'>
									<div className='grid gap-1'>
										<h3 className='m-0 text-[1rem] font-semibold text-text-primary'>
											{t('notifications.detailMessageTitle')}
										</h3>
										<p className='m-0 text-sm text-text-secondary'>
											{t('notifications.detailMessageDescription')}
										</p>
									</div>

									<div className='rounded-lg bg-surface-subtle/80 p-3'>
										<p className='m-0 whitespace-pre-wrap text-sm leading-6 text-text-primary'>
											{formatNotificationMessage(notification.message, i18n.language)}
										</p>
									</div>
								</div>
							</PageCard>

							<PageCard>
								<div className='grid gap-4'>
									<h3 className='m-0 text-[1rem] font-semibold text-text-primary'>
										{t('notifications.detailInfoTitle')}
									</h3>

									<div className='grid gap-2.5 sm:grid-cols-2'>
										<div className='rounded-lg bg-surface-subtle/80 p-3'>
											<p className={labelClassName}>{t('notifications.filters.channel')}</p>
											<p className={`mt-1 ${valueClassName}`}>
												{getNotificationChannelLabel(notification.channel, i18n.language)}
											</p>
										</div>
										<div className='rounded-lg bg-surface-subtle/80 p-3'>
											<p className={labelClassName}>{t('notifications.filters.status')}</p>
											<p className={`mt-1 ${valueClassName}`}>
												{getNotificationReadLabel(notification.is_read, i18n.language)}
											</p>
										</div>
										<div className='rounded-lg bg-surface-subtle/80 p-3'>
											<p className={labelClassName}>{t('notifications.createdAt')}</p>
											<p className={`mt-1 ${valueClassName}`}>
												{formatNotificationDateTime(
													notification.created_at,
													i18n.language,
													true,
												)}
											</p>
										</div>
										<div className='rounded-lg bg-surface-subtle/80 p-3'>
											<p className={labelClassName}>{t('notifications.updatedAt')}</p>
											<p className={`mt-1 ${valueClassName}`}>
												{formatNotificationDateTime(
													notification.updated_at,
													i18n.language,
													true,
												)}
											</p>
										</div>
										<div className='rounded-lg bg-surface-subtle/80 p-3 sm:col-span-2'>
											<p className={labelClassName}>{t('notifications.user')}</p>
											<p className={`mt-1 ${valueClassName}`}>
												{getNotificationUserLabel(
													notification.user,
													notification.metadata,
													i18n.language,
												)}
											</p>
										</div>

										{metadataEntries.length > 0 ? (
											<div className='rounded-lg bg-surface-subtle/80 p-3 sm:col-span-2'>
												<p className={labelClassName}>{t('notifications.additionalInfo')}</p>
												<ul className='mt-2 grid list-none gap-1.5 p-0'>
													{metadataEntries.map(entry => (
														<li
															key={entry.key}
															className='text-sm text-text-secondary'
														>
															<span className='font-semibold text-text-primary'>
																{entry.label}:
															</span>{' '}
															{entry.value}
														</li>
													))}
												</ul>
											</div>
										) : null}
									</div>
								</div>
							</PageCard>

							<PageCard>
								<div className='flex flex-wrap items-center gap-2'>
									<button
										type='button'
										className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-danger-bg px-4 text-sm font-semibold text-danger transition duration-fast hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30 disabled:cursor-not-allowed disabled:opacity-60'
										onClick={() => {
											setIsDeleteDialogOpen(true)
										}}
										disabled={isDeleting}
									>
										<AppIcon name='trash' className='h-4 w-4' aria-hidden='true' />
										{isDeleting
											? t('notifications.bulk.deletingOne')
											: t('notifications.bulk.deleteOne')}
									</button>
								</div>
							</PageCard>
						</>
					) : null}
				</div>
			</aside>

			{isDeleteDialogOpen ? (
				<ConfirmDialog
					eyebrow={t('notifications.bulk.deleteOne')}
					title={t('notifications.bulk.deleteOne')}
					description={t('notifications.bulk.deleteOneConfirm')}
					cancelLabel={t('common.cancel')}
					confirmLabel={isDeleting ? t('notifications.bulk.deletingOne') : t('notifications.bulk.deleteOne')}
					isBusy={isDeleting}
					errorMessage={deleteError}
					confirmTone='danger'
					onCancel={() => {
						if (!isDeleting) {
							setIsDeleteDialogOpen(false)
							setDeleteError(null)
						}
					}}
					onConfirm={() => {
						void handleDeleteNotification()
					}}
					ariaLabel={t('notifications.bulk.deleteOne')}
				/>
			) : null}
		</div>
	)
}

export default NotificationDetailPanel
