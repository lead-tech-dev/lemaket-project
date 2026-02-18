import { apiDelete, apiGet, apiPatch, apiPost, getApiUrl } from './api'
import { getAuthToken } from './auth-token'
import type {
  AdminPromotion,
  AuditEvent,
  ExportJob,
  ModerationListingsResponse,
  MessageNotificationLogsResponse,
  PromotionStatus,
  PromotionType
} from '../types/admin'
import type { ListingStatus } from '../types/listing-status'
import type { AdminUser } from '../types/user'

export type AdminSettingResponse = {
  key: string
  label: string
  description?: string
  group: string
  type: 'boolean' | 'number' | 'text'
  value: unknown
  min?: number
  max?: number
  step?: number
  placeholder?: string
}

export type PromotionPayload = {
  name: string
  type: PromotionType
  status: PromotionStatus
  startDate: string
  endDate: string
  budget: number
  description?: string
  listingId?: string | null
}

export type ModerationQuery = Partial<{
  categoryId: string
  status: ListingStatus
  flagType: string
  search: string
  limit: number
}>

export type BulkModerationPayload = {
  listingIds: string[]
  status: ListingStatus
  note?: string
}

export type MessageNotificationLogQuery = Partial<{
  status: string
  channel: string
  provider: string
  messageId: string
  conversationId: string
  recipientId: string
  search: string
  limit: number
  offset: number
}>

export type CompanyVerificationQuery = Partial<{
  status: 'unverified' | 'pending' | 'approved' | 'rejected'
  search: string
  limit: number
  offset: number
}>

export type CourierVerificationQuery = Partial<{
  status: 'unverified' | 'pending' | 'approved' | 'rejected'
  search: string
  limit: number
  offset: number
}>

export function fetchAdminPromotions() {
  return apiGet<AdminPromotion[]>('/admin/promotions')
}

export function fetchAdminPromotion(id: string) {
  return apiGet<AdminPromotion>(`/admin/promotions/${id}`)
}

export function createAdminPromotion(payload: PromotionPayload) {
  return apiPost<AdminPromotion>('/admin/promotions', payload)
}

export function updateAdminPromotion(id: string, payload: Partial<PromotionPayload>) {
  return apiPatch<AdminPromotion>(`/admin/promotions/${id}`, payload)
}

export function transitionAdminPromotionStatus(id: string, status: PromotionStatus) {
  return apiPatch<AdminPromotion>(`/admin/promotions/${id}/status`, { status })
}

export function deleteAdminPromotion(id: string) {
  return apiDelete<{ success: boolean }>(`/admin/promotions/${id}`)
}

export function fetchModerationListings(
  query: ModerationQuery = {}
) {
  const params = new URLSearchParams()
  if (query.categoryId) params.set('categoryId', query.categoryId)
  if (query.status) params.set('status', query.status)
  if (query.flagType) params.set('flagType', query.flagType)
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.limit) params.set('limit', String(query.limit))
  const qs = params.toString()
  const path = qs ? `/admin/moderation/listings?${qs}` : '/admin/moderation/listings'
  return apiGet<ModerationListingsResponse>(path)
}

export function bulkUpdateListingsStatus(payload: BulkModerationPayload) {
  return apiPatch<{ updated: number }>(
    '/admin/moderation/listings/status',
    payload
  )
}

export function fetchAuditTrail(scope: string, targetId?: string, limit?: number) {
  const params = new URLSearchParams()
  if (targetId) params.set('targetId', targetId)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  const path = qs ? `/admin/audit/${scope}?${qs}` : `/admin/audit/${scope}`
  return apiGet<AuditEvent[]>(path)
}

export function startExportJob(scope: string, format: 'csv' | 'xlsx') {
  return apiPost<ExportJob>(`/admin/export/${scope}`, { format })
}

export function fetchExportJob(jobId: string) {
  return apiGet<ExportJob>(`/admin/export/jobs/${jobId}`)
}

export async function downloadExportJob(
  jobId: string,
  buildErrorMessage?: (status: number) => string
) {
  const url = getApiUrl(`/admin/export/jobs/${jobId}/download`)
  const token = getAuthToken()
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  })

  if (!response.ok) {
    const fallback = `Unable to download export (${response.status}).`
    throw new Error(buildErrorMessage ? buildErrorMessage(response.status) : fallback)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition')
  let filename = 'export'
  if (disposition) {
    const match = disposition.match(/filename="(.+)"/)
    if (match?.[1]) {
      filename = match[1]
    }
  }

  return { blob, filename }
}

export function fetchAdminSettings() {
  return apiGet<AdminSettingResponse[]>('/admin/settings')
}

export function fetchMessageNotificationLogs(query: MessageNotificationLogQuery = {}) {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.channel) params.set('channel', query.channel)
  if (query.provider) params.set('provider', query.provider)
  if (query.messageId) params.set('messageId', query.messageId)
  if (query.conversationId) params.set('conversationId', query.conversationId)
  if (query.recipientId) params.set('recipientId', query.recipientId)
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.limit) params.set('limit', String(query.limit))
  if (query.offset) params.set('offset', String(query.offset))
  const qs = params.toString()
  const path = qs ? `/admin/message-notification-logs?${qs}` : '/admin/message-notification-logs'
  return apiGet<MessageNotificationLogsResponse>(path)
}

export function fetchCompanyVerifications(query: CompanyVerificationQuery = {}) {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.limit) params.set('limit', String(query.limit))
  if (query.offset) params.set('offset', String(query.offset))
  const qs = params.toString()
  const path = qs ? `/admin/company-verifications?${qs}` : '/admin/company-verifications'
  return apiGet<{ items: AdminUser[]; total: number }>(path)
}

export function fetchCourierVerifications(query: CourierVerificationQuery = {}) {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.limit) params.set('limit', String(query.limit))
  if (query.offset) params.set('offset', String(query.offset))
  const qs = params.toString()
  const path = qs ? `/admin/courier-verifications?${qs}` : '/admin/courier-verifications'
  return apiGet<{ items: AdminUser[]; total: number }>(path)
}

export function updateAdminSettingValue(key: string, value: unknown) {
  return apiPost(`/admin/settings/${key}`, { value })
}

export function updateAdminSettingsBatch(updates: Array<{ key: string; value: unknown }>) {
  return apiPost<Array<{ key: string; value: unknown }>>('/admin/settings', { updates })
}
