import { http } from '@/core/api/http'

export type ListingItem = {
  id: string
  title: string
  description: string | null
  price: string
  currency: string
  city?: string | null
  flow?: 'sell' | 'buy' | 'let' | 'rent' | null
  status?: string
  tag?: string | null
  surface?: string | null
  rooms?: number | null
  highlights?: string[]
  location?: {
    cityId?: string
    neighborhoodId?: string
    lat?: number
    lng?: number
    city?: string
    address?: string
    zipcode?: string
    hideExact?: boolean
  } | null
  contact?: {
    email?: string
    phone?: string
    phoneHidden?: boolean
    noSalesmen?: boolean
  } | null
  images?: ({ id?: string; url?: string | null; isCover?: boolean; position?: number } | string)[]
  attributes?: Record<string, unknown>
  details?: Record<string, unknown>
  meta?: Record<string, unknown>
  category?: {
    id?: string
    name?: string
    slug?: string
  } | null
  owner?: {
    id?: string
    firstName?: string | null
    lastName?: string | null
    avatarUrl?: string | null
    storefrontSlug?: string | null
    isPro?: boolean
    isCompanyVerified?: boolean
    listingCount?: number
  } | null
  isFeatured?: boolean
  isBoosted?: boolean
  isPremium?: boolean
  views?: number
  messagesCount?: number
  publishedAt?: string | null
  created_at?: string
}

type ListingsResponse = {
  data: ListingItem[]
  total?: number
  page?: number
  limit?: number
}

export type PriceSuggestion = {
  suggested: number | null
  min: number | null
  max: number | null
  currency: string
  sampleSize: number
}

export type ListingFormField = {
  id: string
  name: string
  label: string
  type: string
  disabled?: boolean
  active?: boolean
  isActive?: boolean
  unit?: string
  rows?: number
  info?: string[]
  tooltip?: string[]
  options?: { value: string; label: string }[]
  dependsOn?: string
  conditionalOptions?: Record<string, { value: string; label: string }[]>
  ui?: {
    placeholder?: string
    disabledUntilDependsOnFilled?: boolean
  }
  rules?: {
    mandatory?: boolean
    min_length?: number
    max_length?: number
    min?: number
    max?: number
    regexp?: string
    err_mandatory?: string
    err_regexp?: string
  }
}

export type ListingFormStep = {
  id: string
  name: string
  label: string
  order: number
  fields: ListingFormField[]
}

export type ListingFormSchema = {
  categoryId: string
  subCategoryId: string | null
  flow: 'sell' | 'buy' | 'let' | 'rent' | null
  adTypes?: Record<string, { label?: string; description?: string }>
  steps: ListingFormStep[]
}

export type ListingImagePayload = {
  url: string
  position?: number
  isCover?: boolean
}

export type ListingWritePayload = {
  categoryId: string
  subCategoryId?: string
  adType?: string | null
  status?: string
  title: string
  description: string
  price: {
    amount: number
    currency: string
    newItemPrice?: number
  }
  location: {
    cityId?: string
    neighborhoodId?: string
    city?: string
    zipcode?: string
    address?: string
    lat?: number
    lng?: number
    hideExact?: boolean
  }
  contact: {
    email?: string
    phone?: string
    phoneHidden?: boolean
    noSalesmen?: boolean
  }
  attributes?: Record<string, unknown>
  meta?: Record<string, unknown>
  images?: ListingImagePayload[]
}

export const listingsApi = {
  latest: async (limit = 20): Promise<ListingsResponse> => {
    try {
      const response = await http.get<ListingItem[] | ListingsResponse>(`/listings/latest?limit=${limit}`)
      if (Array.isArray(response)) {
        if (response.length > 0) {
          return {
            data: response,
            total: response.length,
            page: 1,
            limit
          }
        }
      } else if ((response.data?.length ?? 0) > 0) {
        return response
      }
    } catch {
      // Fallback handled below.
    }

    const fallback = await http.get<ListingsResponse>(`/listings?limit=${limit}&sort=recent`)
    if (Array.isArray((fallback as unknown as ListingItem[]))) {
      const items = fallback as unknown as ListingItem[]
      return {
        data: items,
        total: items.length,
        page: 1,
        limit
      }
    }
    return fallback
  },
  search: (params: URLSearchParams) => http.get<ListingsResponse>(`/listings?${params.toString()}`),
  priceSuggestion: (params: {
    categoryId?: string | null
    subCategoryId?: string | null
    city?: string | null
    sampleSize?: number | null
  }) => {
    const search = new URLSearchParams()
    if (params.categoryId) search.set('categoryId', params.categoryId)
    if (params.subCategoryId) search.set('subCategoryId', params.subCategoryId)
    if (params.city) search.set('city', params.city)
    if (params.sampleSize) search.set('sampleSize', String(params.sampleSize))
    const query = search.toString()
    return http.get<PriceSuggestion>(`/listings/price-suggestion${query ? `?${query}` : ''}`)
  },
  getById: (id: string) => http.get<ListingItem>(`/listings/${id}`),
  similar: (id: string, limit = 4) => http.get<ListingItem[]>(`/listings/${id}/similar?limit=${limit}`),
  mine: (status?: string) =>
    http.get<ListingItem[]>(status ? `/listings/me?status=${encodeURIComponent(status)}` : '/listings/me'),
  formSchema: (categoryId: string) => http.get<ListingFormSchema>(`/listings/form-schema/${categoryId}`),
  create: (payload: ListingWritePayload) => http.post<ListingItem>('/listings', payload),
  update: (id: string, payload: Partial<ListingWritePayload>) => http.patch<ListingItem>(`/listings/${id}`, payload),
  remove: (id: string) => http.del<{ success?: boolean }>(`/listings/${id}`)
}
