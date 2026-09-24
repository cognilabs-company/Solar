/**
 * Services singleton - Convenient access to service registry
 * This provides a simple $variable for importing services across the app
 */

import { getServices } from './registry'
import { apiConversationService } from './api/conversation-service'
import { apiProductService } from './api/product-service'
import { apiDashboardService } from './api/dashboard-service'
import { apiIntegrationsService } from './api/integrations.service'
import { apiAISettingsService } from './api/ai-settings.service'
import { apiLogsService } from './api/common.service'
import { apiLeadService } from './api/lead-service'
import { apiClientService } from './api/client-service'
import { apiNotificationService } from './api/notification-service'
import {
	listOperatorStatistics,
	getOperatorStatisticsById,
} from './api/operator-statistics.service'

const coreServices = getServices()
const conversationApi = apiConversationService as any
const productApi = apiProductService as any
const dashboardApi = apiDashboardService as any
const integrationsApi = apiIntegrationsService as any
const aiSettingsApi = apiAISettingsService as any
const logsApi = apiLogsService as any
const leadApi = apiLeadService as any
const clientApi = apiClientService as any
const notificationApi = apiNotificationService as any

export const services = {
	...coreServices,
	dashboard: {
		getDashboardOverview: dashboardApi.getOverview.bind(dashboardApi),
	} as any,
	chat: {
		listSessions: conversationApi.listSessions.bind(conversationApi),
		getSessionById: conversationApi.getSessionById.bind(conversationApi),
		listMessages: conversationApi.listMessages.bind(conversationApi),
		sendMessage: conversationApi.sendMessage.bind(conversationApi),
		markSessionRead: conversationApi.markSessionRead.bind(conversationApi),
		pauseSessionAI: conversationApi.pauseSessionAI.bind(conversationApi),
		resumeSessionAI: conversationApi.resumeSessionAI.bind(conversationApi),
		deleteSession: conversationApi.deleteSession.bind(conversationApi),
		requestOperator: conversationApi.requestOperator.bind(conversationApi),
	} as any,
	notifications: {
		listNotifications: notificationApi.listNotifications.bind(notificationApi),
		getNotificationById: notificationApi.getNotificationById.bind(notificationApi),
		getNotification: notificationApi.getNotificationById.bind(notificationApi),
		markAsRead: notificationApi.markAsRead.bind(notificationApi),
		markNotificationRead: notificationApi.markNotificationRead.bind(notificationApi),
		markAllAsRead: notificationApi.markAllAsRead.bind(notificationApi),
		delete: notificationApi.delete.bind(notificationApi),
		deleteAll: notificationApi.deleteAll.bind(notificationApi),
	} as any,
	integrations: {
		listConfigs: integrationsApi.listIntegrationConfigs.bind(integrationsApi),
		getConfig: integrationsApi.getIntegrationConfigById.bind(integrationsApi),
		createConfig: integrationsApi.createIntegrationConfig.bind(integrationsApi),
		updateConfig: integrationsApi.updateIntegrationConfig.bind(integrationsApi),
		patchConfig: integrationsApi.patchIntegrationConfig.bind(integrationsApi),
		deleteConfig: integrationsApi.deleteIntegrationConfig.bind(integrationsApi),
	} as any,
	operatorStatistics: {
		listOperatorStatistics,
		getOperatorStatisticsById,
	} as any,
	aiSettings: {
		listSettings: aiSettingsApi.listAISettings.bind(aiSettingsApi),
		getSettingById: aiSettingsApi.getAISettingById.bind(aiSettingsApi),
		getSetting: aiSettingsApi.getAISettingById.bind(aiSettingsApi),
		getActiveSetting: aiSettingsApi.getActiveAISetting.bind(aiSettingsApi),
		createSetting: aiSettingsApi.createAISetting.bind(aiSettingsApi),
		updateSetting: aiSettingsApi.updateAISetting.bind(aiSettingsApi),
		patchSetting: aiSettingsApi.patchAISetting.bind(aiSettingsApi),
		deleteSetting: aiSettingsApi.deleteAISetting.bind(aiSettingsApi),
		setActiveSetting: aiSettingsApi.setActiveAISetting.bind(aiSettingsApi),
	} as any,
	logs: {
		...coreServices.logs,
		getHealth: logsApi.getHealth.bind(logsApi),
	} as any,
	common: {
		getHealth: logsApi.getHealth.bind(logsApi),
		getPublicCompanyInfo: logsApi.getPublicCompanyInfo.bind(logsApi),
		calculateSubsidy: logsApi.calculateSubsidy.bind(logsApi),
	} as any,
	leads: {
		listLeads: leadApi.listLeads.bind(leadApi),
		getLead: leadApi.getLeadById.bind(leadApi),
		getLeadById: leadApi.getLeadById.bind(leadApi),
		createLead: leadApi.createLead.bind(leadApi),
		updateLead: leadApi.updateLead.bind(leadApi),
		patchLead: leadApi.patchLead.bind(leadApi),
		deleteLead: leadApi.deleteLead.bind(leadApi),
	} as any,
	clients: {
		listClients: clientApi.listClients.bind(clientApi),
		getClient: clientApi.getClient.bind(clientApi),
		createClient: clientApi.createClient.bind(clientApi),
		bulkImportClient: clientApi.bulkImportClient.bind(clientApi),
		updateClient: clientApi.updateClient.bind(clientApi),
		patchClient: clientApi.patchClient.bind(clientApi),
		deleteClient: clientApi.deleteClient.bind(clientApi),
		exportClients: clientApi.exportClients.bind(clientApi),
	} as any,
	products: {
		...coreServices.products,
		...productApi,
	} as any,
}
