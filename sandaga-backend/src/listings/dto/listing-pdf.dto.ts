export class ListingPdfDto {
  id!: string
  title!: string
  description!: string
  price?: number | null
  currency?: string | null
  location?: {
    address?: string
    city?: string
    zipcode?: string
    lat?: number
    lng?: number
    hideExact?: boolean
  } | null
  coverImage?: string | null
  images?: string[]
  publishedAt?: Date | null
  ownerName?: string | null
}
