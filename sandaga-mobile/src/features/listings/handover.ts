import type { ListingItem } from '@/features/listings/listings.api'

export type ListingHandoverMode = 'pickup' | 'delivery'

const matchesDeliveryMode = (value: unknown): boolean =>
  String(value).toLowerCase().includes('delivery') || String(value).toLowerCase().includes('livraison')

const extractHandoverModes = (item: ListingItem): unknown[] => {
  const attributes = item.attributes as
    | {
        handoverModes?: unknown
        handover_modes?: unknown
      }
    | undefined
  const meta = item.meta as
    | {
        handoverModes?: unknown
        handover_modes?: unknown
      }
    | undefined

  const attributeModes = attributes?.handoverModes ?? attributes?.handover_modes
  if (Array.isArray(attributeModes)) {
    return attributeModes
  }

  const metaModes = meta?.handoverModes ?? meta?.handover_modes
  if (Array.isArray(metaModes)) {
    return metaModes
  }

  return []
}

export const getListingHandoverModes = (item: ListingItem): ListingHandoverMode[] =>
  Array.from(
    new Set(
      extractHandoverModes(item)
        .map(entry => String(entry).trim().toLowerCase())
        .filter((mode): mode is ListingHandoverMode => mode === 'pickup' || mode === 'delivery')
    )
  )

export const listingSupportsDelivery = (item: ListingItem): boolean =>
  getListingHandoverModes(item).some(matchesDeliveryMode)
