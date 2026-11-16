import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { navigationConfig } from '../config/navigation'
import AppIcon from '../components/shared/icons/AppIcon'
import { useAuth } from '../auth'
import { services } from '../services'
import SidebarSolarBadge from './SidebarSolarBadge'

interface AppSidebarProps {
	isOpen: boolean
	onClose: () => void
}

const closeButtonClassName = [
	'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-surface-card/80 text-text-secondary transition',
	'duration-fast hover:bg-primary/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0',
	'min-[960px]:hidden',
].join(' ')

const groupLabelClassName =
	'mb-2 mt-1 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted/90'

const navLinkBaseClassName = [
	'group relative z-[1] block rounded-xl px-3 py-2.5 text-text-secondary no-underline transition duration-fast',
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0',
].join(' ')

const navLinkInactiveClassName = [
	'hover:bg-surface-card/85 hover:text-text-primary',
].join(' ')

// The active background is painted by the sliding indicator behind the links;
// the right padding leaves room for the 3D solar tracker riding on it.
const navLinkActiveClassName = ['pr-14 text-text-accent'].join(' ')

interface IndicatorRect {
	top: number
	height: number
	visible: boolean
}

function resolveTranslationId(id: string): string {
	if (id === 'chats') {
		return 'chat'
	}

	return id
}

function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
	const { t, i18n } = useTranslation()
	const isRu = i18n.language === 'ru'
	const { canAccessRoute } = useAuth()
	const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)
	const canViewNotifications = canAccessRoute('notifications')
	const location = useLocation()
	const navScrollRef = useRef<HTMLDivElement | null>(null)
	const [indicator, setIndicator] = useState<IndicatorRect>({
		top: 0,
		height: 0,
		visible: false,
	})
	const [isActiveHovered, setIsActiveHovered] = useState(false)

	useEffect(() => {
		let isActive = true

		if (!canViewNotifications) {
			setUnreadNotificationsCount(0)
			return () => {
				isActive = false
			}
		}

		async function loadUnreadNotifications() {
			try {
				const result = await services.notifications.listNotifications({
					page: 1,
					pageSize: 1,
					is_read: false,
					ordering: '-created_at',
				})

				if (!isActive) {
					return
				}

				setUnreadNotificationsCount(Math.max(0, result.meta?.totalItems ?? 0))
			} catch {
				if (!isActive) {
					return
				}

				setUnreadNotificationsCount(0)
			}
		}

		void loadUnreadNotifications()

		const pollInterval = window.setInterval(() => {
			void loadUnreadNotifications()
		}, 20000)

		function handleWindowFocus() {
			void loadUnreadNotifications()
		}

		function handleNotificationsChanged() {
			void loadUnreadNotifications()
		}

		window.addEventListener('focus', handleWindowFocus)
		window.addEventListener('notifications:changed', handleNotificationsChanged)

		return () => {
			isActive = false
			window.clearInterval(pollInterval)
			window.removeEventListener('focus', handleWindowFocus)
			window.removeEventListener(
				'notifications:changed',
				handleNotificationsChanged,
			)
		}
	}, [canViewNotifications])

	const visibleNavigationGroups = useMemo(
		() =>
			navigationConfig
				.map(group => ({
					...group,
					items: group.items.filter(item => canAccessRoute(item.id)),
				}))
				.filter(group => group.items.length > 0),
		[canAccessRoute],
	)

	useLayoutEffect(() => {
		const container = navScrollRef.current
		if (!container) {
			return
		}

		function measure() {
			if (!container) {
				return
			}
			const active = container.querySelector<HTMLElement>('a[aria-current="page"]')
			if (!active) {
				setIndicator(current => ({ ...current, visible: false }))
				return
			}
			const containerRect = container.getBoundingClientRect()
			const activeRect = active.getBoundingClientRect()
			setIndicator({
				top: activeRect.top - containerRect.top + container.scrollTop,
				height: activeRect.height,
				visible: true,
			})
		}

		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(container)
		return () => observer.disconnect()
	}, [location.pathname, visibleNavigationGroups])

	return (
		<aside
			className={[
				'fixed inset-y-0 left-0 z-50 flex w-[84vw] max-w-sidebar flex-col overflow-hidden',
				'bg-background-subtle/95 px-3 pb-4 pt-4 text-text-primary shadow-[18px_0_42px_-30px_rgba(25,28,30,0.22)] backdrop-blur-shell transition-transform duration-base',
				isOpen ? 'translate-x-0' : '-translate-x-full',
				'min-[960px]:sticky min-[960px]:top-0 min-[960px]:self-start min-[960px]:h-[100dvh] min-[960px]:w-sidebar min-[960px]:max-w-none min-[960px]:shrink-0 min-[960px]:translate-x-0',
			].join(' ')}
		>
			<div className='flex min-h-topbar items-center justify-between gap-3 py-3'>
				<div className='flex items-center gap-2.5'>
					<span
						className='inline-flex h-10 w-10 items-center justify-center rounded-lg'
						style={{
							background: 'linear-gradient(140deg, #ffe07a 0%, #ffb627 55%, #f08c00 100%)',
							boxShadow:
								'0 12px 22px -12px rgba(240, 140, 0, 0.85), inset 0 1px 0 rgba(255,255,255,0.6)',
						}}
						aria-hidden='true'
					>
						<svg viewBox='0 0 32 32' className='app-sun-spin h-6 w-6'>
							<circle cx='16' cy='16' r='6' fill='#ffffff' />
							{Array.from({ length: 8 }, (_, index) => (
								<rect
									key={index}
									x='15'
									y='2.5'
									width='2'
									height='5'
									rx='1'
									fill='#ffffff'
									transform={`rotate(${index * 45} 16 16)`}
								/>
							))}
						</svg>
					</span>
					<div>
						<h1 className='m-0 font-display text-[1.36rem] font-extrabold leading-none tracking-[-0.03em]'>
							{t('common.appName')}
						</h1>
						<p className='mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted'>
							CRM
						</p>
					</div>
				</div>
				<button
					type='button'
					className={closeButtonClassName}
					onClick={onClose}
					aria-label={isRu ? 'Навигацияни ёпиш' : 'Navigatsiyani yopish'}
				>
					<AppIcon name='close' className='h-4.5 w-4.5' aria-hidden='true' />
				</button>
			</div>

			<div ref={navScrollRef} className='relative flex-1 overflow-y-auto pr-1 pt-4'>
				<span
					aria-hidden='true'
					className='sidebar-indicator pointer-events-none absolute left-0 right-1 top-0 rounded-xl bg-gradient-to-r from-primary/14 via-primary/8 to-sun/10 shadow-sm ring-1 ring-primary/20'
					style={{
						transform: `translateY(${indicator.top}px)`,
						height: indicator.height,
						opacity: indicator.visible ? 1 : 0,
					}}
				>
					<span className='absolute left-0 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-primary to-sun' />
					<SidebarSolarBadge
						top={indicator.visible ? indicator.top : -1}
						hovered={isActiveHovered}
					/>
				</span>
				{visibleNavigationGroups.map(group => (
					<section key={group.id} className='mt-0 first:mt-0 [&+&]:mt-5'>
						<p className={groupLabelClassName}>
							{t(`navigation.groups.${group.id}`, {
								defaultValue: group.label,
							})}
						</p>
						<nav
							aria-label={t(`navigation.groups.${group.id}`, {
								defaultValue: group.label,
							})}
							className='grid gap-1.5'
						>
							{group.items.map(item => {
								const showUnreadBadge =
									item.id === 'notifications' && unreadNotificationsCount > 0
								const translationId = resolveTranslationId(item.id)

								return (
									<NavLink
										key={item.id}
										to={item.path}
										end
										onMouseEnter={event =>
											setIsActiveHovered(
												event.currentTarget.getAttribute('aria-current') === 'page',
											)
										}
										onMouseLeave={() => setIsActiveHovered(false)}
										className={({ isActive }) =>
											[
												navLinkBaseClassName,
												isActive
													? navLinkActiveClassName
													: navLinkInactiveClassName,
											].join(' ')
										}
									>
										{({ isActive }) => (
											<span className='flex items-center gap-3'>
												<span
													aria-hidden='true'
													className={[
														'relative inline-flex h-9 min-w-9 items-center justify-center rounded-lg transition duration-fast',
														isActive
															? 'bg-primary/20 text-text-accent'
															: 'bg-background-elevated/90 text-text-secondary group-hover:bg-primary/10 group-hover:text-text-primary',
													].join(' ')}
												>
													<AppIcon
														name={item.iconKey}
														className='h-[17px] w-[17px]'
													/>
													{showUnreadBadge ? (
														<span className='absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-2 ring-background-subtle'>
															{unreadNotificationsCount > 99
																? '99+'
																: unreadNotificationsCount}
														</span>
													) : null}
												</span>
												<span className='grid min-w-0 gap-[3px]'>
													<span className='font-semibold [overflow-wrap:anywhere]'>
														{t(`routes.${translationId}.title`, {
															defaultValue: item.label,
														})}
													</span>
													<small className='text-[11px] tracking-[0.02em] text-text-muted [overflow-wrap:anywhere]'>
														{t(`navigation.captions.${translationId}`, {
															defaultValue: item.label,
														})}
													</small>
												</span>
											</span>
										)}
									</NavLink>
								)
							})}
						</nav>
					</section>
				))}
			</div>
		</aside>
	)
}

export default AppSidebar

