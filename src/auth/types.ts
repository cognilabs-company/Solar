import type { AppRole } from '../types/architecture'
import type { AppUser } from '../types/domain'

export const PERMISSION_CODES = [
	'can_access_chats',
	'can_manage_clients',
	'can_manage_contracts',
	'can_manage_integrations',
	'can_manage_ai_settings',
	'can_manage_leads',
	'can_manage_products',
	'can_manage_users',
	'can_view_clients',
	'can_view_contracts',
	'can_view_dashboard',
	'can_view_leads',
	'can_view_logs',
	'can_view_notifications',
	'can_view_products',
] as const

export type PermissionCode = (typeof PERMISSION_CODES)[number]

export interface AuthenticatedUser extends Omit<
	AppUser,
	'permissionKeys' | 'role'
> {
	role: AppRole
	permissionKeys: PermissionCode[]
}

export interface AuthSession {
	accessToken: string
	refreshToken: string
	issuedAt: string
	expiresAt: string
	user: AuthenticatedUser
}

export interface LoginInput {
	username: string
	password: string
}
