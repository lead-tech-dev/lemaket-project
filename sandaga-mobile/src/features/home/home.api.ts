import { http } from '@/core/api/http'

export type HomeListingCard = {
  id: string
  title: string
  price: string
  currency: string
  city: string
  location: string
  tag: string | null
  ribbon: string
  category: {
    id: string
    name: string
    slug: string
  } | null
  coverImage: string | null
  owner: {
    id: string
    name: string
    avatarUrl: string | null
    isPro: boolean
    isCompanyVerified: boolean
  } | null
  publishedAt: string | null
  isFeatured: boolean
  isBoosted: boolean
  isPremium?: boolean
}

export type HomeTrendingSearch = {
  id: string
  label: string
  query: string
  resultCount: number
}

export type HomeStorefrontCard = {
  id: string
  slug: string
  name: string
  tagline?: string | null
  location?: string | null
  avatarUrl?: string | null
  heroUrl?: string | null
  listingCount: number
  averageRating: number
  totalReviews: number
  isVerified: boolean
  isCompanyVerified: boolean
}

export const homeApi = {
  featuredListings: (limit = 8) => http.get<HomeListingCard[]>(`/home/listings/featured?limit=${limit}`),
  trendingSearches: () => http.get<HomeTrendingSearch[]>('/home/trending-searches'),
  storefronts: (limit = 8) => http.get<HomeStorefrontCard[]>(`/home/storefronts?limit=${limit}`)
}
