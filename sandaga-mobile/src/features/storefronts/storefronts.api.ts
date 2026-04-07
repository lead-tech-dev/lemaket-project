import { http } from '@/core/api/http'
import type { ListingItem } from '@/features/listings/listings.api'

export type StorefrontCategory = {
  id: string
  name: string
  slug: string
  count: number
}

export type StorefrontStats = {
  listingCount: number
  averageRating: number
  totalReviews: number
}

export type Storefront = {
  id: string
  slug: string
  name: string
  tagline?: string | null
  description?: string | null
  heroUrl?: string | null
  theme?: string | null
  avatarUrl?: string | null
  location?: string | null
  website?: string | null
  phoneNumber?: string | null
  isPro: boolean
  isVerified: boolean
  isCompanyVerified: boolean
  storefrontShowReviews: boolean
  followersCount: number
  isFollowed?: boolean
  stats: StorefrontStats
  categories: StorefrontCategory[]
}

type StorefrontListingsResponse = {
  data: ListingItem[]
  total?: number
  page?: number
  limit?: number
}

export const storefrontsApi = {
  bySlug: (slug: string) => http.get<Storefront>(`/storefronts/${encodeURIComponent(slug)}`),
  listings: (slug: string, params?: URLSearchParams) =>
    http.get<StorefrontListingsResponse>(
      `/storefronts/${encodeURIComponent(slug)}/listings${params ? `?${params.toString()}` : ''}`
    )
}
