import { routePaths } from '../config/routes'
import type { AppRouteId } from '../config/routes'
import type { AppRole } from '../types/architecture'
import type { AuthenticatedUser, PermissionCode } from './types'

// Solar CRM - Route to Permission Mapping
const ROUTE_REQUIRED_PERMISSIONS: Partial<Record<AppRouteId, PermissionCode>> =
	{
		dashboard: 'can_view_dashboard',
		clients: 'can_view_clients',
		'webapp-clients': 'can_view_clients',
		products: 'can_view_products',
		contracts: 'can_view_contracts',
		chats: 'can_access_chats',
		notifications: 'can_view_notifications',
		users: 'can_manage_users',
		'operator-kpi': 'can_view_dashboard',
		integrations: 'can_manage_integrations',
		'ai-settings': 'can_manage_ai_settings',
		logs: 'can_view_logs',
	}

const IMPLIED_PERMISSIONS: Partial<Record<PermissionCode, PermissionCode[]>> = {
	can_view_clients: ['can_manage_clients'],
	can_view_products: ['can_manage_products'],
	can_view_contracts: ['can_manage_contracts'],
}

const PUBLIC_ROUTE_IDS = new Set<AppRouteId>([
	'home',
	'login',
	'access-denied',
	'not-found',
])

const MODULE_PATH_BY_ROUTE_ID: Record<string, string> = {
	dashboard: routePaths.dashboard,
	clients: routePaths.clients,
	'webapp-clients': routePaths['webapp-clients'],
	products: routePaths.products,
	contracts: routePaths.contracts,
	chats: routePaths.chats,
	notifications: routePaths.notifications,
	users: routePaths.users,
	'operator-kpi': routePaths['operator-kpi'],
	integrations: routePaths.integrations,
	'ai-settings': routePaths['ai-settings'],
	logs: routePaths.logs,
}

export function hasRole(
	user: AuthenticatedUser | null,
	role: AppRole | readonly AppRole[],
): boolean {
	if (!user) {
		return false
	}

	if (Array.isArray(role)) {
		return role.includes(user.role)
	}

	return user.role === role
}

export function hasPermission(
	user: AuthenticatedUser | null,
	permission: PermissionCode,
): boolean {
	if (!user) {
		return false
	}

	if (user.role === 'developer') {
		return true
	}

	const hasDirectPermission = user.permissionKeys.includes(permission)
	if (hasDirectPermission) {
		return true
	}

	const impliedBy = IMPLIED_PERMISSIONS[permission] ?? []
	return impliedBy.some(candidate => user.permissionKeys.includes(candidate))
}

export function canAccessRouteForUser(
	user: AuthenticatedUser | null,
	routeId: AppRouteId,
): boolean {
	if (PUBLIC_ROUTE_IDS.has(routeId)) {
		return true
	}

	if (!user) {
		return false
	}

	if (user.role === 'developer') {
		return true
	}

	if (routeId === 'profile') {
		return true
	}

	// Business rule: Integrations module is developer-only.
	if (routeId === 'integrations') {
		return false
	}

	const requiredPermission = ROUTE_REQUIRED_PERMISSIONS[routeId]
	if (!requiredPermission) {
		return false
	}

	return hasPermission(user, requiredPermission)
}

export function resolveDefaultLandingPathForUser(
	user: AuthenticatedUser | null,
): string {
	if (!user) {
		return routePaths.login
	}

	// All roles start at dashboard
	if (hasPermission(user, 'can_view_dashboard')) {
		return routePaths.dashboard
	}

	if (hasPermission(user, 'can_view_clients')) {
		return routePaths.clients
	}

	const fallbackRouteOrder: AppRouteId[] = [
		'clients',
		'products',
		'chats',
	]

	const firstAllowed = fallbackRouteOrder.find(routeId =>
		canAccessRouteForUser(user, routeId),
	)

	if (!firstAllowed) {
		return routePaths.accessDenied
	}

	return MODULE_PATH_BY_ROUTE_ID[firstAllowed] ?? routePaths.accessDenied
}
