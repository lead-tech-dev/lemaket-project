export type DashboardStat = {
  label: string
  value: string
  trend: string
}

export type DashboardReminder = {
  title: string
  due: string
  action: string
}

export type DashboardMessageDigest = {
  from: string
  excerpt: string
  time: string
}

export type SellerInsights = {
  proListings: number
  individualListings: number
  proShare: number
  individualShare: number
}

export type DashboardNotificationCategory = 'system' | 'saved_search' | 'moderation'

export type DashboardNotificationSummary = {
  totalUnread: number
  categories: Array<{
    category: DashboardNotificationCategory
    unread: number
    total: number
    latest: {
      id: string
      title: string
      created_at: string
      isRead: boolean
    } | null
  }>
  recent: Array<{
    id: string
    category: DashboardNotificationCategory
    title: string
    body: string
    created_at: string
    isRead: boolean
    metadata: Record<string, unknown>
  }>
}

export type OnboardingChecklistTask = {
  key: 'complete_profile' | 'publish_listing' | 'enable_two_factor'
  title: string
  description: string
  actionUrl: string
  completed: boolean
}

export type OnboardingChecklist = {
  dismissed: boolean
  tasks: OnboardingChecklistTask[]
}

export type DashboardOverviewResponse = {
  stats: DashboardStat[]
  reminders: DashboardReminder[]
  messages: DashboardMessageDigest[]
  sellerInsights?: SellerInsights
  notificationSummary?: DashboardNotificationSummary
  onboardingChecklist?: OnboardingChecklist
}
