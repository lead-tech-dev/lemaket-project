export type AuthUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  companyName?: string | null
  avatarUrl?: string | null
  location?: string | null
  storefrontSlug?: string | null
  storefrontTagline?: string | null
  storefrontHeroUrl?: string | null
  isPro?: boolean
  walletBalance?: string
  walletCurrency?: string
}

export type AuthResponse = {
  accessToken: string
  expiresIn: number
  user: AuthUser
}
