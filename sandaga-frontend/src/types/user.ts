export type AdminUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'user' | 'pro' | 'admin' | 'moderator'
  isActive: boolean
  isPro: boolean
  created_at: string
  lastLoginAt?: string | null
  companyName?: string | null
  companyId?: string | null
  companyNiu?: string | null
  companyRccm?: string | null
  companyCity?: string | null
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
  location?: string | null
}

export type UpdateUserPayload = Partial<{
  firstName: string
  lastName: string
  email: string
  role: 'user' | 'pro' | 'admin' | 'moderator'
  isActive: boolean
  isPro: boolean
}> 
