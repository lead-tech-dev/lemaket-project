import type { Listing } from './listing'

export type ConversationParticipant = {
  id: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  isPro?: boolean
}

export type ConversationSummary = {
  id: string
  listing: Listing
  buyer: ConversationParticipant
  seller: ConversationParticipant
  courier?: ConversationParticipant | null
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  unreadCountBuyer: number
  unreadCountSeller: number
  unreadCountCourier?: number
}

export type ConversationDetail = ConversationSummary

export type MessageAttachment = {
  id: string
  url: string
  fileName: string
  mimeType?: string | null
  size?: number | null
}

export type ConversationMessage = {
  id: string
  content: string
  created_at: string
  readAt?: string | null
  deliveredAt?: string | null
  deliveryStatus: 'sent' | 'delivered' | 'read'
  sender: ConversationParticipant
  attachments: MessageAttachment[]
}
