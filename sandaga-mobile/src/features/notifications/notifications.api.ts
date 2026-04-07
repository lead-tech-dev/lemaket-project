import { http } from '@/core/api/http'

export type NotificationCategory = 'system' | 'saved_search' | 'moderation'

export type NotificationItem = {
  id: string
  created_at: string
  category: NotificationCategory
  title: string
  body?: string | null
  isRead: boolean
  metadata?: Record<string, unknown>
}

export type NotificationsResponse = {
  items: NotificationItem[]
  summary: {
    categories: Record<NotificationCategory, { unread: number; total: number }>
    totalUnread: number
  }
}

export const notificationsApi = {
  list: (limit = 30) => http.get<NotificationsResponse>(`/notifications?limit=${limit}`),
  markRead: (id: string) => http.patch<NotificationItem>(`/notifications/${id}/read`),
  markAllRead: () => http.patch<{ success?: boolean }>('/notifications/read-all')
}
