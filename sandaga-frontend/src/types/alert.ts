export type Alert = {
  id: string
  term?: string | null
  location?: string | null
  categorySlug?: string | null
  sellerType?: string | null
  priceBand?: string | null
  radiusKm?: number | null
  isActive: boolean
  created_at: string
}
