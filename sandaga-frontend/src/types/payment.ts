export type PaymentMethodType = 'card' | 'wallet' | 'transfer' | 'cash'

export type PaymentMethodVerificationStatus = 'not_required' | 'pending' | 'verified' | 'failed'

export type PaymentMethod = {
  id: string
  type: PaymentMethodType
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  holderName?: string
  label?: string
  provider?: string
  isDefault: boolean
  verificationStatus: PaymentMethodVerificationStatus
  verifiedAt?: string | null
  mandateReference?: string | null
}

export type PaymentRecord = {
  id: string
  amount: number | string
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  description: string | null
  created_at: string
  invoiceNumber?: string | null
  invoiceUrl?: string | null
  paymentMethod?: PaymentMethod | null
}

export type PaymentPromotionOption = {
  id: string
  title: string
  description: string
  price: number
  currency: string
  categories: string[]
  isIncluded?: boolean
}

export type PaymentSubscription = {
  id: string
  planName: string
  amount: string
  currency: string
  status: 'active' | 'paused' | 'canceled' | 'expired'
  autoRenew: boolean
  nextRenewalAt?: string | null
  description?: string | null
  paymentMethod?: PaymentMethod | null
  created_at: string
}

export type CheckoutRequest = {
  listingId: string
  optionId: string
  paymentMethodId?: string
}

export type CheckoutResult = {
  redirectUrl?: string | null
  sessionId?: string
  paymentId?: string
  subscriptionId?: string
  nextRenewalAt?: string | null
}

export type CheckoutSessionStatus = {
  sessionId: string
  mode: 'payment' | 'subscription' | 'setup'
  paymentStatus?: 'paid' | 'unpaid' | 'no_payment_required' | null
  paymentId?: string | null
  subscriptionId?: string | null
  subscriptionStatus?: PaymentSubscription['status'] | null
}

export type PaymentInvoice = {
  invoice: PaymentRecord
  downloadUrl?: string | null
}
