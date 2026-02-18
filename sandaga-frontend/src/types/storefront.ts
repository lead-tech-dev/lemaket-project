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
  companyId?: string | null
  phoneNumber?: string | null
  isPro: boolean
  isVerified: boolean
  isCompanyVerified: boolean
  identityStatus: string
  storefrontShowReviews: boolean
  followersCount?: number
  isFollowed?: boolean
  stats: StorefrontStats
  categories: StorefrontCategory[]
}
