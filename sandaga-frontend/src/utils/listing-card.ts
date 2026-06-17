import type { ListingCardItem } from '../components/ds'
import type { HomeListing } from '../types/home'
import type { Listing } from '../types/listing'
import { formatListingLocation } from './location'
import { resolveMediaUrl } from './media'

/**
 * Adapte un `HomeListing` (modèle API) vers le `ListingCardItem` attendu par
 * la carte du design system. Le prix est formaté SANS devise (la carte ajoute
 * "FCFA" elle-même).
 */
export const toCardItem = (listing: HomeListing, numberLocale = 'fr-FR'): ListingCardItem => {
  const numericPrice = Number(listing.price)
  const price = Number.isFinite(numericPrice)
    ? new Intl.NumberFormat(numberLocale).format(numericPrice)
    : listing.price

  const city =
    formatListingLocation(listing.location as never, listing.city ?? '') || (listing.city ?? '')

  return {
    id: listing.id,
    title: listing.title,
    price,
    unit: '',
    cat: listing.category?.name ?? listing.tag ?? '',
    city,
    verified: Boolean(listing.owner?.isCompanyVerified),
    boosted: Boolean(listing.ribbon),
    pro: Boolean(listing.owner?.isPro),
    imageUrl: listing.coverImage ? resolveMediaUrl(listing.coverImage) : null,
  }
}

/**
 * Variante pour le modèle `Listing` complet (favoris, page catégorie, etc.).
 */
export const listingToCardItem = (
  listing: Listing,
  numberLocale = 'fr-FR',
  fallbackCity = ''
): ListingCardItem => {
  const numericPrice = Number(listing.price)
  const price = Number.isFinite(numericPrice)
    ? new Intl.NumberFormat(numberLocale).format(numericPrice)
    : String(listing.price)
  const cover = listing.images?.find((img) => img.isCover) ?? listing.images?.[0]
  return {
    id: listing.id,
    title: listing.title,
    price,
    unit: '',
    cat: listing.category?.name ?? '',
    city: formatListingLocation(listing.location as never, listing.city || fallbackCity),
    verified: Boolean(listing.owner?.isCompanyVerified),
    boosted: Boolean(listing.isFeatured),
    pro: Boolean(listing.owner?.isPro),
    imageUrl: cover ? resolveMediaUrl(cover.url) : null,
  }
}
