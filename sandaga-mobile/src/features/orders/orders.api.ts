import { http } from '@/core/api/http'

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'paid_waiting_delivery'
  | 'courier_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled'

export type OrderItem = {
  id: string
  listingId: string
  title: string
  unitPrice: string
  quantity: number
  currency: string
}

export type Order = {
  id: string
  created_at: string
  status: OrderStatus
  handoverMode: 'delivery' | 'pickup'
  listingAmount: string
  deliveryAmount: string
  platformFee?: string
  totalAmount: string
  currency: string
  paidAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  listing?: { id: string; title: string }
  buyer?: { id: string; firstName: string; lastName: string }
  seller?: { id: string; firstName: string; lastName: string }
  delivery?: {
    id: string
    status: string
    handoverMode?: 'delivery' | 'pickup'
    pickupAddress?: string | null
    dropoffAddress?: string | null
    dropoffNotes?: string | null
    distanceKm?: number
    pickupLat?: number | null
    pickupLng?: number | null
    dropoffLat?: number | null
    dropoffLng?: number | null
    acceptedAt?: string | null
    pickedUpAt?: string | null
    deliveredAt?: string | null
  } | null
  items?: OrderItem[]
}

export const ordersApi = {
  mine: () => http.get<Order[]>('/orders/mine'),
  byId: (id: string) => http.get<Order>(`/orders/${id}`)
}
