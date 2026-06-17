import type { ImageSourcePropType } from 'react-native'
import { API_BASE_URL } from '@/core/config/env'
import listingPlaceholder from '@/assets/listing-placeholder.png'

type ListingImageLike = string | { url?: string | null } | null | undefined
type ListingWithImages = {
  images?: ListingImageLike[] | null
} | null | undefined

export const LISTING_PLACEHOLDER_SOURCE: ImageSourcePropType = listingPlaceholder

export function resolveMediaUrl(raw?: string | null): string | null {
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw
  }
  return `${API_BASE_URL}${raw.startsWith('/') ? raw : `/${raw}`}`
}

export function resolveListingImageUrl(item: ListingWithImages): string | null {
  const first = item?.images?.[0]
  const raw = typeof first === 'string' ? first : first?.url
  return resolveMediaUrl(raw ?? null)
}

export function hasListingImage(item: ListingWithImages): boolean {
  return Boolean(resolveListingImageUrl(item))
}

export function getListingImageSource(item: ListingWithImages): ImageSourcePropType {
  const imageUrl = resolveListingImageUrl(item)
  return imageUrl ? { uri: imageUrl } : LISTING_PLACEHOLDER_SOURCE
}
