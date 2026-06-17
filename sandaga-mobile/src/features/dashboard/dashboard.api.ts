import { http } from '@/core/api/http'
import type { ListingItem } from '@/features/listings/listings.api'

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
  categories: {
    category: DashboardNotificationCategory
    unread: number
    total: number
    latest: {
      id: string
      title: string
      created_at: string
      isRead: boolean
    } | null
  }[]
  recent: {
    id: string
    category: DashboardNotificationCategory
    title: string
    body: string
    created_at: string
    isRead: boolean
    metadata: Record<string, unknown>
  }[]
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

export type FavoriteItem = {
  id: string
  listing: ListingItem
}

export type FollowedSeller = {
  id: string
  name: string
  storefrontSlug?: string | null
  avatarUrl?: string | null
  location?: string | null
  listingCount: number
  followersCount: number
}

export type AlertItem = {
  id: string
  term?: string | null
  location?: string | null
  categorySlug?: string | null
  sellerType?: string | null
  priceBand?: string | null
  radiusKm?: number | null
  isActive: boolean
  created_at: string
}

export type AlertPayload = {
  term?: string
  location?: string
  categorySlug?: string
  sellerType?: 'pro' | 'individual' | 'all'
  priceBand?: string
  radius?: number
}

export const dashboardApi = {
  overview: () => http.get<DashboardOverviewResponse>('/dashboard/overview'),
  favorites: () => http.get<FavoriteItem[]>('/favorites'),
  removeFavorite: (listingId: string) => http.del<{ success?: boolean }>(`/favorites/${listingId}`),
  follows: () => http.get<FollowedSeller[]>('/users/me/follows/list'),
  unfollowSeller: (sellerId: string) => http.del<{ success?: boolean }>(`/users/${sellerId}/follow`),
  alerts: () => http.get<AlertItem[]>('/alerts'),
  createAlert: (payload: AlertPayload) => http.post<AlertItem>('/alerts', payload),
  updateAlert: (id: string, payload: Partial<AlertPayload> & { isActive?: boolean }) =>
    http.patch<AlertItem>(`/alerts/${id}`, payload),
  removeAlert: (id: string) => http.del<{ success?: boolean }>(`/alerts/${id}`)
}
