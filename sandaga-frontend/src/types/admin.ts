export type AdminMetric = {
  label: string
  value: string | number
  accent?: string
}

export type AdminActivity = {
  id: string
  label: string
  detail?: string
  time: string
}

export type AdminLogEntry = {
  id: string
  action: string
  details?: string | null
  actorName?: string | null
  actorRole?: string | null
  ipAddress?: string | null
  created_at: string
}

export type MessageNotificationLogEntry = {
  id: string
  messageId?: string | null
  conversationId?: string | null
  recipientId?: string | null
  channel: string
  provider?: string | null
  destination?: string | null
  status: string
  error?: string | null
  created_at: string
}

export type MessageNotificationLogsResponse = {
  items: MessageNotificationLogEntry[]
  total: number
}

export type AdminSettingType = 'boolean' | 'text' | 'number' | 'json'

export type AdminSettingSchema<TValue = unknown> = {
  key: string
  label: string
  description?: string
  type: AdminSettingType
  group: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
  transform?(value: unknown): TValue
  serialize?(value: TValue): unknown
}

export type AdminSettingValue<TValue = unknown> = {
  key: string
  value: TValue
}

export type AdminSettingEntry<TValue = unknown> = {
  schema: AdminSettingSchema<TValue>
  value: AdminSettingValue<TValue>
}

export type PromotionStatus =
  | 'draft'
  | 'active'
  | 'scheduled'
  | 'completed'
  | 'cancelled'

export type PromotionType = 'featured' | 'boost' | 'premium' | 'highlight'

export type AdminPromotion = {
  id: string
  name: string
  type: PromotionType
  status: PromotionStatus
  startDate: string
  endDate: string
  budget: number
  description?: string | null
  listingId?: string | null
  listing?: {
    id: string
    title: string
    ownerId?: string
  } | null
  created_at: string
  updatedAt: string
}

export type ModerationReporter = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

export type ModerationReport = {
  id: string
  reason: string
  details?: string | null
  status: string
  created_at: string
  reporter?: ModerationReporter | null
}

export type ModerationListing = {
  id: string
  title: string
  status: string
  price: string
  currency: string
  created_at: string
  updatedAt: string
  category: {
    id: string
    name: string
  }
  owner: {
    id: string
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    isPro?: boolean
  }
  images?: Array<{
    id: string
    url: string
    isCover?: boolean
  }>
  reports: ModerationReport[]
  reportsCount: number
  latestReportAt?: string | null
}

export type ModerationFilterOptions = {
  categories: Array<{ id: string; name: string }>
  statuses: string[]
  flagReasons: string[]
}

export type ModerationListingsResponse = {
  items: ModerationListing[]
  total: number
  filters: ModerationFilterOptions
}

export type AuditEvent = {
  id: string
  action: string
  details?: string | null
  actorName?: string | null
  actorRole?: string | null
  ipAddress?: string | null
  created_at: string
}

export type ExportJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export type ExportJob = {
  id: string
  scope: string
  format: 'csv' | 'xlsx'
  status: ExportJobStatus
  total: number
  processed: number
  progress: number
  created_at: string
  updatedAt: string
  filename?: string
  error?: string
}
