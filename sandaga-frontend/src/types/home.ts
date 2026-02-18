export type HomeHeroStat = {
  label: string
  value: string
  detail?: string
}

export type HomeHero = {
  eyebrow: string
  title: string
  subtitle: string
  tags: string[]
  stats: HomeHeroStat[]
}

import type { CategoryExtraField } from './category'

export type HomeCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  gradient: string | null
  parentId: string | null
  extraFields: CategoryExtraField[]
  listingCount: number
  children: Array<{
    id: string
    name: string
    slug: string
    description: string | null
    icon: string | null
    color: string | null
    gradient: string | null
    parentId: string | null
  }>
}

export type HomeListing = {
  id: string
  title: string
  price: string
  currency: string
  city?: string | null
  location: string | { address?: string; city?: string; zipcode?: string; lat?: number; lng?: number } | null
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
    storefrontSlug?: string | null
    isPro: boolean
    isCompanyVerified?: boolean
  } | null
  publishedAt: string | null
  isFeatured: boolean
  isBoosted: boolean
}

export type HomeService = {
  title: string
  description: string
  actionLabel: string
  actionUrl: string
}

export type HomeSellerSplit = {
  proListings: number
  individualListings: number
  proShare: number
  individualShare: number
}

export type HomeTestimonial = {
  id: string
  quote: string
  author: string
  location?: string | null
  avatarUrl?: string | null
}

export type HomeTrendingSearch = {
  id: string
  label: string
  query: string
  resultCount: number
}

export type HomeStorefront = {
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

export type HomeResponse = {
  hero: HomeHero
  categories: HomeCategory[]
  featuredListings: HomeListing[]
  latestListings: HomeListing[]
  services: HomeService[]
  sellerSplit: HomeSellerSplit
  testimonials?: HomeTestimonial[]
  trendingSearches?: HomeTrendingSearch[]
  generatedAt: string
}
