import { http } from '@/core/api/http'
import { getAccessToken } from '@/core/auth/token-storage'
import { API_BASE_URL } from '@/core/config/env'

export type PreferredContactChannel = 'email' | 'sms' | 'phone' | 'whatsapp' | 'in_app'

export type UserSettings = {
  showPhoneToApprovedOnly?: boolean
  maskPreciseLocation?: boolean
  enableTwoFactorAuth?: boolean
  tipsNotifications?: boolean
  favoritePriceAlerts?: boolean
  emailAlerts?: boolean
  importantSmsNotifications?: boolean
  savedSearchAlerts?: boolean
  moderationAlerts?: boolean
  systemAlerts?: boolean
  marketingOptIn?: boolean
  preferredContactChannels?: PreferredContactChannel[]
  payoutMobileNetwork?: 'mtn' | 'orange' | null
  payoutMobileNumber?: string | null
  payoutMobileName?: string | null
  isCourier?: boolean
  courierLocation?: {
    city?: string
    zipcode?: string
    lat?: number
    lng?: number
  } | null
  courierRadiusKm?: number
}

export type UserMe = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  created_at?: string
  lastLoginAt?: string | null
  phoneNumber?: string | null
  avatarUrl?: string | null
  bio?: string | null
  location?: string | null
  companyName?: string | null
  companyId?: string | null
  companyNiu?: string | null
  companyRccm?: string | null
  companyCity?: string | null
  businessDescription?: string | null
  businessWebsite?: string | null
  storefrontSlug?: string | null
  storefrontTagline?: string | null
  storefrontHeroUrl?: string | null
  storefrontTheme?: string | null
  storefrontShowReviews?: boolean
  isPro?: boolean
  identityVerificationStatus?: 'unverified' | 'pending' | 'approved' | 'rejected'
  identityDocuments?: IdentityDocumentRecord[] | null
  identitySubmittedAt?: string | null
  identityReviewNotes?: string | null
  companyVerificationStatus?: 'unverified' | 'pending' | 'approved' | 'rejected'
  companyVerificationDocumentUrl?: string | null
  companyVerificationSubmittedAt?: string | null
  companyVerificationReviewedAt?: string | null
  companyVerificationReviewNotes?: string | null
  courierVerificationStatus?: 'unverified' | 'pending' | 'approved' | 'rejected'
  courierVerificationDocumentUrl?: string | null
  courierVerificationSubmittedAt?: string | null
  courierVerificationReviewedAt?: string | null
  courierVerificationReviewNotes?: string | null
  walletBalance?: string
  walletCurrency?: string
  settings?: UserSettings
}

export type IdentityDocumentType =
  | 'id_card_front'
  | 'id_card_back'
  | 'passport'
  | 'driver_license'
  | 'selfie'
  | 'business_registration'

export type IdentityDocumentRecord = {
  id: string
  type: IdentityDocumentType
  url: string
  uploadedAt: string
  description?: string
  reviewedAt?: string | null
  reviewerId?: string | null
  status?: 'pending' | 'approved' | 'rejected'
}

export type UserAddress = {
  id: string
  label: string
  recipientName: string
  line1: string
  line2?: string | null
  city: string
  state?: string | null
  postalCode: string
  country: string
  phone?: string | null
  isDefaultShipping: boolean
  isDefaultBilling: boolean
}

export type PublicUserProfile = {
  id: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  location?: string | null
  createdAt: string
  lastLoginAt?: string | null
  isOnline?: boolean
  hasPhoneNumber?: boolean
  averageRating?: number
  reviewsCount?: number
  responseTimeHours?: number | null
  responseRate?: number | null
  listingCount: number
  proFollowsCount?: number
}

export type UpdateSettingsPayload = {
  showPhoneToApprovedOnly?: boolean
  maskPreciseLocation?: boolean
  enableTwoFactorAuth?: boolean
  tipsNotifications?: boolean
  favoritePriceAlerts?: boolean
  emailAlerts?: boolean
  importantSmsNotifications?: boolean
  savedSearchAlerts?: boolean
  moderationAlerts?: boolean
  systemAlerts?: boolean
  marketingOptIn?: boolean
  preferredContactChannels?: PreferredContactChannel[]
  payoutMobileNetwork?: 'mtn' | 'orange'
  payoutMobileNumber?: string
  payoutMobileName?: string
  isCourier?: boolean
  courierLocation?: {
    city?: string
    zipcode?: string
    lat?: number
    lng?: number
  } | null
  courierRadiusKm?: number
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
}

export type UpdateProfilePayload = {
  firstName?: string
  lastName?: string
  phoneNumber?: string
  avatarUrl?: string
  bio?: string
  location?: string
  companyName?: string
  companyId?: string
  companyNiu?: string
  companyRccm?: string
  companyCity?: string
  businessDescription?: string
  businessWebsite?: string
  storefrontSlug?: string
  storefrontTagline?: string
  storefrontHeroUrl?: string
  storefrontTheme?: string
  storefrontShowReviews?: boolean
}

export type UpsertAddressPayload = {
  label: string
  recipientName: string
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
  phone?: string
  isDefaultShipping?: boolean
  isDefaultBilling?: boolean
}

const buildUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

const uploadUserDocument = async (
  path: string,
  file: { uri: string; name: string; type: string },
  fields?: Record<string, string | undefined>
) => {
  const token = getAccessToken()
  const formData = new FormData()
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type
  } as unknown as Blob)

  if (fields) {
    Object.entries(fields).forEach(([key, value]) => {
      if (value) {
        formData.append(key, value)
      }
    })
  }

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  })

  if (!response.ok) {
    const raw = await response.text().catch(() => '')
    throw new Error(raw || `HTTP ${response.status}`)
  }

  return response.json()
}

export const usersApi = {
  me: () => http.get<UserMe>('/users/me'),
  publicProfile: (userId: string) => http.get<PublicUserProfile>(`/users/public/${userId}`),
  publicProfileBySlug: (slug: string) => http.get<PublicUserProfile>(`/users/public/slug/${encodeURIComponent(slug)}`),
  followedSellerIds: () => http.get<{ sellerIds: string[] }>('/users/me/follows'),
  followersCount: (userId: string) => http.get<{ count: number }>(`/users/${userId}/followers/count`),
  followSeller: (sellerId: string) => http.post<{ following: boolean }>(`/users/${sellerId}/follow`),
  unfollowSeller: (sellerId: string) => http.del<{ following: boolean }>(`/users/${sellerId}/follow`),
  updateProfile: (payload: UpdateProfilePayload) => http.patch<UserMe>('/users/me', payload),
  updateSettings: (payload: UpdateSettingsPayload) => http.patch<UserMe>('/users/me/settings', payload),
  updateTwoFactor: (enable: boolean) => http.patch<UserMe>('/users/me/two-factor', { enable }),
  changePassword: (payload: ChangePasswordPayload) => http.patch<void>('/users/me/change-password', payload),
  addresses: () => http.get<UserAddress[]>('/users/me/addresses'),
  createAddress: (payload: UpsertAddressPayload) => http.post<UserAddress>('/users/me/addresses', payload),
  updateAddress: (id: string, payload: UpsertAddressPayload) => http.patch<UserAddress>(`/users/me/addresses/${id}`, payload),
  removeAddress: (id: string) => http.del<{ success: boolean }>(`/users/me/addresses/${id}`),
  deactivate: (reason?: string) => http.del<UserMe>('/users/me', reason ? { reason } : undefined),
  uploadIdentityDocument: (payload: {
    type: IdentityDocumentType
    file: { uri: string; name: string; type: string }
    description?: string
  }) => uploadUserDocument('/users/me/identity-docs', payload.file, { type: payload.type, description: payload.description }),
  removeIdentityDocument: (documentId: string) => http.del(`/users/me/identity-docs/${documentId}`),
  uploadCompanyDocument: (file: { uri: string; name: string; type: string }) =>
    uploadUserDocument('/users/me/company-doc', file),
  uploadCourierDocument: (file: { uri: string; name: string; type: string }) =>
    uploadUserDocument('/users/me/courier-doc', file)
}
