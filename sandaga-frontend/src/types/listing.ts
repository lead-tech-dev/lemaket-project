import type { ListingStatus } from './listing-status'

export type ListingImage = {
  id: string
  url: string
  position: number
  isCover: boolean
  listingId: string
}

export type ListingCategory = {
  id: string
  name: string
  slug: string
  description?: string | null
  icon?: string | null
  color?: string | null
  gradient?: string | null
}

export type ListingOwner = {
  id: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  storefrontSlug?: string | null
  isPro: boolean
  isCompanyVerified?: boolean
  listingCount?: number
}

export type Listing = {
  id: string
  title: string
  description: string
  price: string
  currency: string
  city?: string | null
  location:
    | string
    | { address?: string; city?: string; zipcode?: string; lat?: number; lng?: number; hideExact?: boolean }
    | null
  tag?: string | null
  surface?: string | null
  rooms?: number | null
  status: ListingStatus
  highlights?: string[]
  equipments?: string[]
  details?: Record<string, unknown>
  attributes?: Record<string, unknown>
  isFeatured: boolean
  isBoosted: boolean
  views: number
  messagesCount: number
  publishedAt?: string | null
  expiresAt?: string | null
  created_at: string
  updatedAt: string
  category: ListingCategory
  owner: ListingOwner
  images?: ListingImage[]
  flow?: string | null
}
