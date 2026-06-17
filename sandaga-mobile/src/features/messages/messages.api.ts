import { http } from '@/core/api/http'
import { getAccessToken } from '@/core/auth/token-storage'
import { API_BASE_URL } from '@/core/config/env'

export type ConversationParticipant = {
  id: string
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
  lastLoginAt?: string | null
  isOnline?: boolean
}

export type ConversationItem = {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  courierId?: string | null
  unreadCountBuyer?: number
  unreadCountSeller?: number
  unreadCountCourier?: number
  lastMessageAt?: string
  lastMessagePreview?: string
  listing?: {
    id: string
    title?: string
    price?: string | null
    currency?: string | null
    images?: (string | { url?: string | null })[]
  }
  buyer?: ConversationParticipant
  seller?: ConversationParticipant
  courier?: ConversationParticipant
}

export type ConversationListResponse = {
  data: ConversationItem[]
  nextCursor: string | null
  unreadTotal: number
}

export type MessageItem = {
  id: string
  conversationId: string
  senderId: string
  content: string
  created_at: string
  readAt?: string | null
  deliveredAt?: string | null
  deliveryStatus?: 'sent' | 'delivered' | 'read'
  attachments?: { id: string; url: string; fileName?: string | null; mimeType?: string | null; size?: number | null }[]
  sender?: ConversationParticipant
}

export type MessageListResponse = {
  data: MessageItem[]
  nextCursor: string | null
}

export type MessageAttachment = {
  id: string
  url: string
  fileName?: string | null
  mimeType?: string | null
  size?: number | null
  conversationId: string
  messageId?: string | null
}

export type QuickReplyItem = {
  id: string
  label: string
  content: string
  ownerId?: string | null
  isGlobal?: boolean
}

const buildUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export const messagesApi = {
  conversations: (cursor?: string, limit = 25) => {
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    if (cursor) params.set('cursor', cursor)
    return http.get<ConversationListResponse>(`/messages/conversations?${params.toString()}`)
  },
  conversation: (id: string) => http.get<ConversationItem>(`/messages/conversations/${id}`),
  messages: (conversationId: string, cursor?: string, limit = 50) => {
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    if (cursor) params.set('cursor', cursor)
    return http.get<MessageListResponse>(`/messages/conversations/${conversationId}/messages?${params.toString()}`)
  },
  sendMessage: (conversationId: string, content: string, attachmentIds?: string[]) =>
    http.post<MessageItem>(`/messages/conversations/${conversationId}/messages`, {
      content,
      attachmentIds: attachmentIds && attachmentIds.length > 0 ? attachmentIds : undefined
    }),
  startConversation: (listingId: string, content: string) =>
    http.post<ConversationItem>('/messages/conversations', { listingId, content }),
  markRead: (conversationId: string) =>
    http.post(`/messages/conversations/${conversationId}/read`),
  quickReplies: () => http.get<QuickReplyItem[]>('/messages/quick-replies'),
  createQuickReply: (payload: { label: string; content: string; isGlobal?: boolean }) =>
    http.post<QuickReplyItem>('/messages/quick-replies', payload),
  updateQuickReply: (id: string, payload: Partial<{ label: string; content: string; isGlobal?: boolean }>) =>
    http.patch<QuickReplyItem>(`/messages/quick-replies/${id}`, payload),
  deleteQuickReply: (id: string) => http.del<{ success?: boolean }>(`/messages/quick-replies/${id}`),
  aiReply: (conversationId: string) =>
    http.post<{ suggestion: string }>(`/messages/conversations/${conversationId}/ai-reply`),
  typing: (conversationId: string, isTyping: boolean) =>
    http.post<{ success: boolean }>(`/messages/conversations/${conversationId}/typing`, { isTyping }),
  uploadAttachment: async (
    conversationId: string,
    file: { uri: string; name: string; type: string }
  ): Promise<MessageAttachment> => {
    const token = getAccessToken()
    const formData = new FormData()
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type
    } as unknown as Blob)

    const response = await fetch(buildUrl(`/messages/conversations/${conversationId}/attachments`), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData
    })

    if (!response.ok) {
      const raw = await response.text().catch(() => '')
      throw new Error(raw || `HTTP ${response.status}`)
    }

    return response.json() as Promise<MessageAttachment>
  }
}
