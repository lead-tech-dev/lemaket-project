export type DeliveryStatus = 'requested' | 'accepted' | 'picked_up' | 'delivered' | 'canceled'

export type Delivery = {
  id: string
  created_at: string
  status: DeliveryStatus
  handoverMode?: 'delivery' | 'pickup'
  price: string | null
  currency: string
  distanceKm?: number
  escrowStatus?: 'none' | 'pending' | 'held' | 'released' | 'refunded'
  escrowAmount?: string | null
  escrowCurrency?: string
  sellerPayoutReady?: boolean
  pickupAddress: string | null
  dropoffAddress: string | null
  dropoffNotes: string | null
  buyer: { id: string; firstName: string; lastName: string }
  seller: { id: string; firstName: string; lastName: string }
  courier?: { id: string; firstName: string; lastName: string } | null
  listing: { id: string; title: string; price?: string | null }
}
