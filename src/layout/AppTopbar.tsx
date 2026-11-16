import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AppIcon from '../components/shared/icons/AppIcon'
import { useAuth } from '../auth'
import { services } from '../services'
import { routePaths } from '../config/routes'
import LanguageDropdown from './LanguageDropdown'

interface AppTopbarProps {
	title: string
	subtitle: string
	onMenuToggle: () => void
	onRefreshCurrentPage: () => void
	showRouteMeta?: boolean
}

const THEME_STORAGE_KEY = 'solar-theme'

function getInitialIsDarkTheme() {
	if (typeof window === 'undefined') {
		return false
	}

	const rootTheme = document.documentElement.dataset.theme

	if (rootTheme === 'dark') {
		return true
	}

	if (rootTheme === 'light') {
		return false
	}

	try {
		return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
	} catch {
		return false
	}
}

const THEME_WAVE_DURATION_MS = 720

function prefersReducedMotion() {
	return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

const menuToggleClassName = [
	'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card text-text-primary transition',
	'duration-fast hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0',
	'min-[960px]:hidden',
].join(' ')

function AppTopbar({
	title,
	subtitle,
	onMenuToggle,
	onRefreshCurrentPage,
	showRouteMeta = false,
}: AppTopbarProps) {
	const location = useLocation()
	const { t } = useTranslation()
	const [isDarkTheme, setIsDarkTheme] = useState(getInitialIsDarkTheme)
	const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
	const [chatSessionCount, setChatSessionCount] = useState<number | null>(null)
	const profileMenuRef = useRef<HTMLDivElement | null>(null)
	const { currentUser, logout } = useAuth()

	useEffect(() => {
		const nextTheme = isDarkTheme ? 'dark' : 'light'

		document.documentElement.dataset.theme = nextTheme

		try {
			window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
		} catch {
			// Ignore storage failures and keep the in-memory toggle working.
		}
	}, [isDarkTheme])

	useEffect(() => {
		function handlePointerDown(event: MouseEvent) {
			if (!profileMenuRef.current?.contains(event.target as Node)) {
				setIsProfileMenuOpen(false)
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setIsProfileMenuOpen(false)
			}
		}

		window.addEventListener('mousedown', handlePointerDown)
		window.addEventListener('keydown', handleKeyDown)

		return () => {
			window.removeEventListener('mousedown', handlePointerDown)
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [])

	useEffect(() => {
		setIsProfileMenuOpen(false)
	}, [location.pathname])

	useEffect(() => {
		let isMounted = true
		const isChatRoute = location.pathname === routePaths.chats

		if (!showRouteMeta || !isChatRoute) {
			setChatSessionCount(null)
			return () => {
				isMounted = false
			}
		}

		async function loadChatSessionCount() {
			try {
				const response = await services.chat.listSessions({
					page: 1,
					page_size: 1,
					ordering: '-last_message_at',
				})

				if (!isMounted) {
					return
				}

				setChatSessionCount(response.meta?.totalItems ?? response.total ?? 0)
			} catch {
				if (!isMounted) {
					return
				}

				setChatSessionCount(null)
			}
		}

		void loadChatSessionCount()

		return () => {
			isMounted = false
		}
	}, [location.pathname, showRouteMeta])

	function handleThemeToggle(event: ReactMouseEvent<HTMLButtonElement>) {
		const nextIsDark = !isDarkTheme
		const root = document.documentElement

		const applyTheme = () => {
			root.dataset.theme = nextIsDark ? 'dark' : 'light'
			flushSync(() => setIsDarkTheme(nextIsDark))
		}

		if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
			applyTheme()
			return
		}

		// The wave starts from the centre of the toggle icon (keyboard clicks have no pointer coords).
		const rect = event.currentTarget.getBoundingClientRect()
		const x = rect.left + rect.width / 2
		const y = rect.top + rect.height / 2
		const radius = Math.hypot(
			Math.max(x, window.innerWidth - x),
			Math.max(y, window.innerHeight - y),
		)

		root.classList.add('theme-wave')
		const transition = document.startViewTransition(applyTheme)

		transition.ready
			.then(() => {
				root.animate(
					{
						clipPath: [
							`circle(0px at ${x}px ${y}px)`,
							`circle(${radius}px at ${x}px ${y}px)`,
						],
					},
					{
						duration: THEME_WAVE_DURATION_MS,
						easing: 'cubic-bezier(0.22, 0.75, 0.2, 1)',
						pseudoElement: '::view-transition-new(root)',
					},
				)
			})
			.catch(() => undefined)

		transition.finished.finally(() => root.classList.remove('theme-wave'))
	}

	function handleLogout() {
		setIsProfileMenuOpen(false)
		logout()
	}

	return (
		<header className='sticky top-0 z-30 flex min-h-topbar items-center justify-between gap-3 border-b border-border-soft/55 bg-background-default px-5 py-3 backdrop-blur-shell supports-[backdrop-filter]:bg-background-default/78 max-[640px]:flex-wrap min-[960px]:px-7'>
			<div className='flex min-w-0 flex-1 items-center gap-3'>
				<button
					type='button'
					className={menuToggleClassName}
					onClick={onMenuToggle}
					aria-label={t('topbar.menuOpen')}
				>
					<AppIcon
						name='menu'
						className='h-[18px] w-[18px]'
						aria-hidden='true'
					/>
				</button>

				{showRouteMeta ? (
					<div className='min-w-0 max-[959px]:hidden'>
						<h1 className='m-0 truncate text-[1.02rem] font-semibold leading-tight text-text-primary'>
							{title}
						</h1>
						{subtitle ? (
							<p className='m-0 truncate text-[12px] text-text-secondary'>
								{subtitle}
							</p>
						) : null}
					</div>
				) : null}
			</div>

			<div className='flex shrink-0 items-center gap-2 text-text-muted max-[640px]:ml-auto'>
				{showRouteMeta && chatSessionCount !== null ? (
					<span className='hidden min-h-8 items-center gap-2 rounded-pill bg-primary/12 px-3 text-[12px] font-semibold text-text-accent min-[960px]:inline-flex'>
						<AppIcon name='chat' className='h-3.5 w-3.5' aria-hidden='true' />
						{chatSessionCount} ta sessiya
					</span>
				) : null}

				<button
					type='button'
					className='inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-card text-text-secondary transition duration-fast hover:bg-primary/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25'
					onClick={handleThemeToggle}
					aria-pressed={isDarkTheme}
					aria-label={t('topbar.themeToggle')}
				>
					<AppIcon
						key={isDarkTheme ? 'moon' : 'sun'}
						name={isDarkTheme ? 'moon' : 'sun'}
						className='theme-toggle-icon h-5 w-5'
						aria-hidden='true'
					/>
				</button>

				<button
					type='button'
					className='inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-card text-text-secondary transition duration-fast hover:bg-primary/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25'
					onClick={onRefreshCurrentPage}
					aria-label={t('topbar.refresh')}
				>
					<AppIcon name='refresh-cw' className='h-5 w-5' aria-hidden='true' />
				</button>

				<LanguageDropdown />

				<div
					ref={profileMenuRef}
					className={['relative', isProfileMenuOpen ? 'z-[120]' : 'z-20'].join(
						' ',
					)}
				>
					<button
						type='button'
						className='inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent px-0 text-text-secondary transition duration-fast hover:bg-primary/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 min-[960px]:h-11 min-[960px]:w-auto min-[960px]:justify-start min-[960px]:gap-3 min-[960px]:rounded-pill min-[960px]:bg-surface-card min-[960px]:px-3.5 min-[960px]:shadow-sm min-[960px]:ring-1 min-[960px]:ring-border-soft/40'
						aria-haspopup='menu'
						aria-expanded={isProfileMenuOpen}
						aria-label={t('topbar.profileMenu')}
						onClick={() => setIsProfileMenuOpen(current => !current)}
					>
						<span className='hidden min-[960px]:grid text-right text-[11px] leading-[1.25]'>
							<span className='font-semibold text-text-primary'>
								{currentUser?.fullName ?? t('common.notAvailable')}
							</span>
							<span className='text-text-muted'>
								{currentUser?.role ?? t('topbar.noRole')}
							</span>
						</span>
						<span className='inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary'>
							<AppIcon name='user' className='h-4.5 w-4.5' aria-hidden='true' />
						</span>
						<AppIcon
							name='chevron-down'
							className={[
								'hidden h-4 w-4 text-text-muted transition duration-fast min-[960px]:inline-flex',
								isProfileMenuOpen ? 'rotate-180 text-text-secondary' : '',
							].join(' ')}
							aria-hidden='true'
						/>
					</button>

					{isProfileMenuOpen ? (
						<div
							className='absolute right-0 top-[calc(100%+10px)] w-[220px] overflow-hidden rounded-xl bg-surface-card p-1.5 shadow-[0_22px_44px_-30px_rgba(25,28,30,0.38)] ring-1 ring-border-soft/40'
							role='menu'
							aria-label={t('topbar.profileMenu')}
						>
							<div className='rounded-lg bg-surface-subtle/70 px-3 py-2.5'>
								<p className='m-0 text-sm font-semibold text-text-primary'>
									{currentUser?.fullName ?? t('common.notAvailable')}
								</p>
								<p className='m-0 mt-0.5 text-[12px] text-text-muted'>
									{currentUser?.role ?? t('topbar.noRole')}
								</p>
							</div>

							<div className='mt-1 grid gap-1'>
								<button
									type='button'
									className='inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-danger transition duration-fast hover:bg-danger-bg'
									role='menuitem'
									onClick={handleLogout}
								>
									<AppIcon
										name='log-out'
										className='h-4 w-4'
										aria-hidden='true'
									/>
									{t('topbar.logout')}
								</button>
							</div>
						</div>
					) : null}
				</div>
			</div>
		</header>
	)
}

export default AppTopbar

