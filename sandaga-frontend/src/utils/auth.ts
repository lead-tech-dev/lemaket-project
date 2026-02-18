import { apiDelete, apiGet, apiPatch, apiPost, apiPostFormData } from './api'
import {
  clearAuthToken as clearStoredToken,
  getAuthToken as getStoredToken,
  setAuthToken as storeAuthToken
} from './auth-token'

export { getStoredToken as getAuthToken, storeAuthToken as setAuthToken, clearStoredToken as clearAuthToken }

export type LoginCredentials = {
  email: string
  password: string
}

export type RegisterPayload = {
  email: string
  password: string
  firstName: string
  lastName: string
  phoneNumber?: string
  isPro?: boolean
  companyName?: string
  companyId?: string
  companyNiu?: string
  companyRccm?: string
  companyCity?: string
}

export type PreferredContactChannel = 'email' | 'sms' | 'phone' | 'whatsapp' | 'in_app'

export type IdentityVerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected'
export type CompanyVerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected'

export type IdentityDocumentType =
  | 'id_card_front'
  | 'id_card_back'
  | 'passport'
  | 'driver_license'
  | 'selfie'
  | 'business_registration'

export type IdentityDocument = {
  id: string
  type: IdentityDocumentType
  url: string
  uploadedAt: string
  description?: string
  status?: 'pending' | 'approved' | 'rejected'
}

export type UserAddressPayload = {
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

export type UserAddress = UserAddressPayload & {
  id: string
  isDefaultShipping: boolean
  isDefaultBilling: boolean
  created_at: string
  updatedAt: string
}

export type LoginResponse = {
  accessToken: string
  user: {
    id: string
    firstName: string
    lastName: string
    role: string
    isPro: boolean
  }
  expiresIn: number
}

export type ForgotPasswordPayload = {
  email: string
}

export type ForgotPasswordResponse = {
  message: string
}

export type ResetPasswordPayload = {
  token: string
  password: string
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
}

export type UpdateProfilePayload = Partial<{
  firstName: string
  lastName: string
  phoneNumber: string
  avatarUrl: string
  bio: string
  location: string
  companyName: string
  companyId: string
  companyNiu: string
  companyRccm: string
  companyCity: string
  businessDescription: string
  businessWebsite: string
  storefrontSlug: string
  storefrontTagline: string
  storefrontHeroUrl: string
  storefrontTheme: string
  storefrontShowReviews: boolean
}>

export type UpdateSettingsPayload = Partial<{
  showPhoneToApprovedOnly: boolean
  maskPreciseLocation: boolean
  enableTwoFactorAuth: boolean
  tipsNotifications: boolean
  favoritePriceAlerts: boolean
  emailAlerts: boolean
  importantSmsNotifications: boolean
  savedSearchAlerts: boolean
  moderationAlerts: boolean
  systemAlerts: boolean
  marketingOptIn: boolean
  preferredContactChannels: PreferredContactChannel[]
  onboardingChecklistDismissed: boolean
  isCourier: boolean
  aiAutoReplyEnabled: boolean
  aiAutoReplyCooldownMinutes: number
  aiAutoReplyDailyLimit: number
  payoutMobileNetwork: 'mtn' | 'orange' | null
  payoutMobileNumber: string | null
  payoutMobileName: string | null
  courierLocation: {
    city?: string
    zipcode?: string
    lat?: number
    lng?: number
  }
  courierRadiusKm?: number | null
}>

export type UpdateTwoFactorResponse = UserAccount

export type DeactivateAccountPayload = {
  reason?: string
}

export type UserAccount = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isPro: boolean
  phoneNumber?: string | null
  avatarUrl?: string | null
  bio?: string | null
  location?: string | null
  settings?: Record<string, unknown> | null
  lastLoginAt?: string | null
  companyName?: string | null
  companyId?: string | null
  companyNiu?: string | null
  companyRccm?: string | null
  companyCity?: string | null
  companyVerificationStatus?: CompanyVerificationStatus
  companyVerificationDocumentUrl?: string | null
  companyVerificationSubmittedAt?: string | null
  companyVerificationReviewedAt?: string | null
  companyVerificationReviewNotes?: string | null
  courierVerificationStatus?: 'unverified' | 'pending' | 'approved' | 'rejected'
  courierVerificationDocumentUrl?: string | null
  courierVerificationSubmittedAt?: string | null
  courierVerificationReviewedAt?: string | null
  courierVerificationReviewNotes?: string | null
  businessDescription?: string | null
  businessWebsite?: string | null
  storefrontSlug?: string | null
  storefrontTagline?: string | null
  storefrontHeroUrl?: string | null
  storefrontTheme?: string | null
  storefrontShowReviews?: boolean
  identityVerificationStatus?: IdentityVerificationStatus
  identityDocuments?: IdentityDocument[] | null
  identitySubmittedAt?: string | null
  identityReviewNotes?: string | null
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const data = await apiPost<LoginResponse>('/auth/login', credentials)
  storeAuthToken(data.accessToken)
  return data
}

export async function register(payload: RegisterPayload): Promise<LoginResponse> {
  const data = await apiPost<LoginResponse>('/auth/register', payload)
  storeAuthToken(data.accessToken)
  return data
}

export async function logout(): Promise<void> {
  return apiPost<void>('/auth/logout')
    .catch(error => {
      console.warn('Logout request failed (ignored)', error)
    })
    .finally(() => {
      clearStoredToken()
    })
}

export function forgotPassword(payload: ForgotPasswordPayload): Promise<ForgotPasswordResponse> {
  return apiPost<ForgotPasswordResponse>('/auth/forgot-password', payload)
}

export function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  return apiPost<void>('/auth/reset-password', payload)
}

export function changePassword(payload: ChangePasswordPayload): Promise<void> {
  return apiPatch<void>('/users/me/change-password', payload)
}

export function updateProfile(payload: UpdateProfilePayload): Promise<UserAccount> {
  return apiPatch<UserAccount>('/users/me', payload)
}

export function updateSettings(payload: UpdateSettingsPayload): Promise<UserAccount> {
  return apiPatch<UserAccount>('/users/me/settings', payload)
}

export function updateTwoFactor(enable: boolean): Promise<UpdateTwoFactorResponse> {
  return apiPatch<UserAccount>('/users/me/two-factor', { enable })
}

export function deactivateAccount(payload?: DeactivateAccountPayload): Promise<UserAccount> {
  return apiDelete<UserAccount>('/users/me', payload)
}

export function listAddresses(): Promise<UserAddress[]> {
  return apiGet<UserAddress[]>('/users/me/addresses')
}

export function createAddress(payload: UserAddressPayload): Promise<UserAddress> {
  return apiPost<UserAddress>('/users/me/addresses', payload)
}

export function updateAddress(id: string, payload: UserAddressPayload): Promise<UserAddress> {
  return apiPatch<UserAddress>(`/users/me/addresses/${id}`, payload)
}

export function deleteAddress(id: string): Promise<{ success: boolean }> {
  return apiDelete<{ success: boolean }>(`/users/me/addresses/${id}`)
}

export type IdentityDocumentResponse = {
  status: IdentityVerificationStatus
  documents: IdentityDocument[]
  submittedAt?: string | null
}

export function uploadIdentityDocument(payload: {
  type: IdentityDocumentType
  file: File
  description?: string
}): Promise<IdentityDocumentResponse> {
  const formData = new FormData()
  formData.append('type', payload.type)
  if (payload.description) {
    formData.append('description', payload.description)
  }
  formData.append('file', payload.file)
  return apiPostFormData<IdentityDocumentResponse>('/users/me/identity-docs', formData)
}

export function uploadCompanyVerificationDocument(file: File): Promise<UserAccount> {
  const formData = new FormData()
  formData.append('file', file)
  return apiPostFormData<UserAccount>('/users/me/company-doc', formData)
}

export function uploadCourierVerificationDocument(file: File): Promise<UserAccount> {
  const formData = new FormData()
  formData.append('file', file)
  return apiPostFormData<UserAccount>('/users/me/courier-doc', formData)
}

export function removeIdentityDocument(documentId: string): Promise<IdentityDocumentResponse> {
  return apiDelete<IdentityDocumentResponse>(`/users/me/identity-docs/${documentId}`)
}
