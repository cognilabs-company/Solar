import type { ComponentType, JSX } from 'react'
import {
	Navigate,
	Outlet,
	createBrowserRouter,
	useLocation,
} from 'react-router-dom'
import type { AppRouteConfig, AppRouteId } from '../../config/routes'
import {
	fallbackRoutes,
	moduleRoutes,
	publicRoutes,
	routePaths,
} from '../../config/routes'
import RouteGate from './RouteGate'
import { useAuth } from '../../auth'
import { getAccessToken } from '../../lib/auth-storage'
import AppShell from '../../layout/AppShell'
import RouteErrorBoundary from './RouteErrorBoundary'
import AccessDeniedPage from '../pages/public/AccessDeniedPage'
import AiSettingsPage from '../pages/protected/AiSettingsPage'
import ChatsPage from '../pages/protected/ChatsPage'
import ClientsPage from '../pages/protected/ClientsPage'
import WebappClientsPage from '../pages/protected/WebappClientsPage'
import ContractsPage from '../pages/protected/ContractsPage'
import DashboardPage from '../pages/protected/DashboardPage'
import IntegrationsPage from '../pages/protected/IntegrationsPage'
import LoginPage from '../pages/public/LoginPage'
import LogsPage from '../pages/protected/LogsPage'
import NotFoundPage from '../pages/public/NotFoundPage'
import NotificationsPage from '../pages/protected/NotificationsPage'
import ProductsPage from '../pages/protected/ProductsPage'
import OperatorKpiPage from '../pages/protected/OperatorKpiPage'
import UsersPage from '../pages/protected/UsersPage'

type RoutedPageId = Exclude<AppRouteId, 'home'>

const pageRegistry: Record<RoutedPageId, ComponentType> = {
	'access-denied': AccessDeniedPage,
	'ai-settings': AiSettingsPage,
	chats: ChatsPage,
	clients: ClientsPage,
	'webapp-clients': WebappClientsPage,
	contracts: ContractsPage,
	dashboard: DashboardPage,
	integrations: IntegrationsPage,
	login: LoginPage,
	logs: LogsPage,
	'not-found': NotFoundPage,
	notifications: NotificationsPage,
	products: ProductsPage,
	'operator-kpi': OperatorKpiPage,
	users: UsersPage,
}

function renderRouteElement(route: AppRouteConfig): JSX.Element {
	if (route.id === 'home') {
		return <Navigate replace to={routePaths.dashboard} />
	}

	const PageComponent = pageRegistry[route.id]

	return (
		<RouteGate route={route}>
			<PageComponent />
		</RouteGate>
	)
}

function toProtectedChildPath(path: string): string {
	return path.startsWith('/') ? path.slice(1) : path
}

function ProtectedShellRoute(): JSX.Element {
	const location = useLocation()
	const { isAuthenticated, isBootstrapping } = useAuth()
	const hasAccessToken = Boolean(getAccessToken())

	if (isBootstrapping) {
		return (
			<main className='grid min-h-screen place-items-center bg-background-default p-6'>
				<p className='text-sm font-semibold text-text-secondary'>
					Loading session...
				</p>
			</main>
		)
	}

	if (!hasAccessToken || !isAuthenticated) {
		return (
			<Navigate
				replace
				to={routePaths.login}
				state={{ from: location.pathname }}
			/>
		)
	}

	return <Outlet />
}

export const appRouter = createBrowserRouter([
	{
		path: routePaths.root,
		element: <Navigate replace to={routePaths.dashboard} />,
		errorElement: <RouteErrorBoundary />,
	},
	...publicRoutes
		.filter(route => route.id !== 'home')
		.map(route => ({
			path: route.path,
			element: renderRouteElement(route),
			errorElement: <RouteErrorBoundary />,
		})),
	{
		element: <ProtectedShellRoute />,
		errorElement: <RouteErrorBoundary />,
		children: [
			{
				element: <AppShell />,
				errorElement: <RouteErrorBoundary />,
				children: moduleRoutes.map(route => ({
					path: toProtectedChildPath(route.path),
					element: renderRouteElement(route),
					errorElement: <RouteErrorBoundary />,
				})),
			},
		],
	},
	...fallbackRoutes.map(route => ({
		path: route.path,
		element: renderRouteElement(route),
		errorElement: <RouteErrorBoundary />,
	})),
])
