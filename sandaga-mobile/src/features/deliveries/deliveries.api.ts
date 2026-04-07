import { http } from '@/core/api/http'

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
  acceptedAt?: string | null
  pickedUpAt?: string | null
  deliveredAt?: string | null
  canceledAt?: string | null
  cancelReason?: string | null
  pickupCodeVerifiedAt?: string | null
  deliveryCodeVerifiedAt?: string | null
  pickupAddress: string | null
  dropoffAddress: string | null
  dropoffNotes: string | null
  pickupLat?: number | null
  pickupLng?: number | null
  dropoffLat?: number | null
  dropoffLng?: number | null
  buyer: { id: string; firstName: string; lastName: string }
  seller: { id: string; firstName: string; lastName: string }
  courier?: { id: string; firstName: string; lastName: string } | null
  listing: { id: string; title: string; price?: string | null }
}

export const deliveriesApi = {
  getById: (id: string) => http.get<Delivery>(`/deliveries/${id}`),
  mine: () => http.get<Delivery[]>('/deliveries/mine'),
  available: () => http.get<Delivery[]>('/deliveries/available'),
  getForListing: (listingId: string) => http.get<Delivery | null>(`/deliveries/listing/${listingId}`),
  initEscrow: (payload: {
    listingId: string
    dropoffAddress?: string
    dropoffNotes?: string
    dropoffLat?: number
    dropoffLng?: number
    price?: number
    currency?: string
    preferredCourierId?: string
    handoverMode?: 'delivery' | 'pickup'
    paymentMethod?: 'mobile_money' | 'card' | 'wallet'
    paymentMode?: 'inline' | 'redirect'
    paymentOperator?: 'mtn' | 'orange'
    paymentPhone?: string
  }) =>
    http.post<{ paymentId: string; orderId: string; paymentUrl?: string; reference?: string }>('/deliveries/escrow/init', payload),
  accept: (id: string) => http.post<Delivery>(`/deliveries/${id}/accept`),
  requestEscrow: (id: string) => http.post<{ paymentId: string; paymentUrl: string }>(`/deliveries/${id}/escrow`),
  releaseEscrow: (id: string) => http.post<Delivery>(`/deliveries/${id}/escrow/release`),
  pickupCode: (id: string) => http.get<{ code: string }>(`/deliveries/${id}/pickup/code`),
  confirmPickupCode: (id: string, code: string) => http.post<Delivery>(`/deliveries/${id}/pickup/confirm`, { code }),
  sendDeliveryCode: (id: string) => http.get<{ sent: boolean }>(`/deliveries/${id}/delivery/code`),
  confirmDeliveryCode: (id: string, code: string) => http.post<Delivery>(`/deliveries/${id}/delivery/confirm`, { code }),
  cancel: (id: string, reason?: string) => http.post<Delivery>(`/deliveries/${id}/cancel`, { reason })
}
