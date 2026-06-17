import { http } from '@/core/api/http'

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
  externalId?: string
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
  provider?: string | null
  reference?: string | null
  checkoutSessionId?: string | null
  metadata?: {
    listingId?: string
    promotionOptionId?: string
    promotionId?: string
    promotionType?: string
    promotionApplied?: boolean
    promotionEndsAt?: string
    [key: string]: unknown
  } | null
  paymentMethod?: PaymentMethod | null
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

export type WalletSummary = {
  balance: number
  currency: string
}

export type WalletTransaction = {
  id: string
  type: string
  amount: string
  currency: string
  status: 'completed' | 'pending' | 'failed'
  created_at: string
}

export type WalletTransactionsResponse = {
  items: WalletTransaction[]
  total: number
}

export type CheckoutResult = {
  redirectUrl?: string | null
  sessionId?: string
  paymentId?: string
  subscriptionId?: string
  nextRenewalAt?: string | null
}

export type PaymentPromotionOption = {
  id: string
  title: string
  description: string
  price: number
  currency: string
  categories: string[]
  isIncluded?: boolean
  monthlyLimit?: number
}

export type CheckoutRequest = {
  listingId: string
  optionId: string
  paymentMethodId?: string
}

export type CheckoutSessionStatus = {
  sessionId: string
  mode: 'payment' | 'subscription' | 'setup'
  paymentStatus?: 'paid' | 'unpaid' | 'no_payment_required' | null
  paymentId?: string | null
  subscriptionId?: string | null
  subscriptionStatus?: PaymentSubscription['status'] | null
}

export const paymentsApi = {
  options: (category?: string) =>
    http.get<PaymentPromotionOption[]>(`/payments/options${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  methods: () => http.get<PaymentMethod[]>('/payments/methods'),
  invoices: () => http.get<PaymentRecord[]>('/payments/invoices'),
  invoice: (id: string) => http.get<PaymentRecord>(`/payments/invoices/${id}`),
  subscriptions: () => http.get<PaymentSubscription[]>('/payments/subscriptions'),
  checkout: (payload: CheckoutRequest) => http.post<CheckoutResult>('/payments/checkout', payload),
  checkoutSession: (sessionId: string) => http.get<CheckoutSessionStatus>(`/payments/checkout/sessions/${sessionId}`),
  createMethod: (payload: {
    type: PaymentMethodType
    holderName: string
    label?: string
    externalId?: string
    isDefault?: boolean
    provider?: string
    last4?: string
    expMonth?: number
    expYear?: number
    brand?: string
  }) => http.post<PaymentMethod>('/payments/methods', payload),
  updateMethod: (id: string, payload: Partial<PaymentMethod>) =>
    http.patch<PaymentMethod>(`/payments/methods/${id}`, payload),
  removeMethod: (id: string) => http.del<{ success?: boolean }>(`/payments/methods/${id}`),
  beginVerification: (id: string) => http.post<{ redirectUrl?: string }>(`/payments/methods/${id}/verify`),
  confirmVerification: (id: string, success: boolean) =>
    http.post<PaymentMethod>(`/payments/methods/${id}/confirm`, { success }),
  walletSummary: () => http.get<WalletSummary>('/payments/wallet'),
  walletTransactions: (params: URLSearchParams) =>
    http.get<WalletTransactionsResponse>(`/payments/wallet/transactions?${params.toString()}`),
  walletTopup: (payload: {
    amount: number
    currency: string
    paymentMethod: 'mobile_money' | 'card'
    paymentOperator?: 'mtn' | 'orange'
    paymentPhone?: string
  }) =>
    http.post<{ paymentUrl?: string }>('/payments/wallet/topup', payload),
  walletWithdraw: (payload: { amount: number; currency: string }) =>
    http.post<{ success?: boolean }>('/payments/wallet/withdraw', payload),
  cancelSubscription: (id: string) => http.post<{ success?: boolean }>(`/payments/subscriptions/${id}/cancel`),
  resumeSubscription: (id: string) => http.post<{ success?: boolean }>(`/payments/subscriptions/${id}/resume`),
  requestProPlan: (payload: { planId: string; mode: 'trial' | 'subscribe' }) =>
    http.post<CheckoutResult>('/payments/pro-plans', payload)
}
