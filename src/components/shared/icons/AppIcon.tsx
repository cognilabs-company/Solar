import type { SVGProps } from 'react'
import type { IconType } from 'react-icons'
import {
	FiArchive,
	FiBell,
	FiBox,
	FiCalendar,
	FiChevronDown,
	FiCheckCircle,
	FiCreditCard,
	FiDownload,
	FiFile,
	FiFileText,
	FiFilter,
	FiGrid,
	FiImage,
	FiLogOut,
	FiMenu,
	FiMessageSquare,
	FiMoon,
	FiPackage,
	FiPlus,
	FiRefreshCw,
	FiSearch,
	FiSettings,
	FiShoppingBag,
	FiSun,
	FiTruck,
	FiTrendingDown,
	FiTrendingUp,
	FiTrash2,
	FiUser,
	FiUsers,
	FiX,
	FiActivity,
	FiZap,
} from 'react-icons/fi'
import { BsCheck2All } from 'react-icons/bs'

export type AppIconName =
	| 'dashboard'
	| 'profile'
	| 'users'
	| 'integrations'
	| 'leads'
	| 'clients'
	| 'customers'
	| 'products'
	| 'contracts'
	| 'orders'
	| 'couriers'
	| 'agents'
	| 'payments'
	| 'chat'
	| 'chats'
	| 'notifications'
	| 'ai-settings'
	| 'logs'
	| 'menu'
	| 'sun'
	| 'moon'
	| 'search'
	| 'sparkles'
	| 'bell'
	| 'user'
	| 'chevron-down'
	| 'close'
	| 'calendar'
	| 'filter'
	| 'download'
	| 'log-out'
	| 'plus'
	| 'trending-up'
	| 'trending-down'
	| 'activity'
	| 'settings'
	| 'refresh-cw'
	| 'trash'
	| 'check-circle'
	| 'mark-read-all'
	| 'image'
	| 'file'
	| 'archive'
	| 'table'

interface AppIconProps extends SVGProps<SVGSVGElement> {
	name: AppIconName
}

const ICON_MAP: Record<AppIconName, IconType> = {
	dashboard: FiGrid,
	profile: FiUser,
	users: FiUsers,
	integrations: FiSettings,
	leads: FiFileText,
	clients: FiUsers,
	customers: FiUsers,
	products: FiBox,
	contracts: FiFileText,
	orders: FiShoppingBag,
	couriers: FiTruck,
	agents: FiUsers,
	payments: FiCreditCard,
	chat: FiMessageSquare,
	chats: FiMessageSquare,
	notifications: FiBell,
	'ai-settings': FiZap,
	logs: FiPackage,
	menu: FiMenu,
	sun: FiSun,
	moon: FiMoon,
	search: FiSearch,
	sparkles: FiZap,
	bell: FiBell,
	user: FiUser,
	'chevron-down': FiChevronDown,
	close: FiX,
	calendar: FiCalendar,
	filter: FiFilter,
	download: FiDownload,
	'log-out': FiLogOut,
	plus: FiPlus,
	'trending-up': FiTrendingUp,
	'trending-down': FiTrendingDown,
	activity: FiActivity,
	settings: FiSettings,
	'refresh-cw': FiRefreshCw,
	trash: FiTrash2,
	'check-circle': FiCheckCircle,
	'mark-read-all': BsCheck2All,
	image: FiImage,
	file: FiFile,
	archive: FiArchive,
	table: FiGrid,
}

function AppIcon({ name, className, ...props }: AppIconProps) {
	const IconComponent = ICON_MAP[name]

	if (!IconComponent) {
		return null
	}

	return <IconComponent className={className} {...props} />
}

export default AppIcon
