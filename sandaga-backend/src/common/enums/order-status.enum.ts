export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PAID_AWAITING_DELIVERY = 'paid_waiting_delivery',
  COURIER_ASSIGNED = 'courier_assigned',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}
