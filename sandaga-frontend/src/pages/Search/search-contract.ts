export const ATTRIBUTE_PARAM_PREFIX = 'attr_'

type PriceBand = {
  min?: number
  max?: number
}

type SearchPreferences = {
  page?: number
  limit?: number
  priceBand?: string
  radius?: string
}

const LEGACY_TO_CANONICAL_KEY_MAP: Record<string, string> = {
  q: 'search',
  l: 'city',
  category: 'categorySlug',
  tag: 'tag',
  featured: 'isFeatured',
  minPrice: 'minPrice',
  maxPrice: 'maxPrice',
  page: 'page',
  limit: 'limit',
  owner: 'ownerId',
  sort: 'sort',
  sellerType: 'sellerType',
  adType: 'adType',
  radius: 'radiusKm',
  cityId: 'cityId',
  neighborhoodId: 'neighborhoodId'
}

const MULTI_VALUE_KEYS = new Set(['cityIds', 'neighborhoodIds'])
const MAX_API_PAGE = 100000
const MAX_API_LIMIT = 100

const normalizeFreeText = (value: string, maxLength = 255) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)

const parseBooleanValue = (value: string): boolean | undefined => {
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return undefined
}

const sanitizeIntegerParam = (value: string, min: number, max: number) => {
  if (!/^\d+$/.test(value)) {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < min) {
    return undefined
  }
  return String(Math.min(parsed, max))
}

const sanitizeRadiusValue = (value: string): string | undefined => {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }
  return String(Math.min(parsed, 500))
}

const isValidCoordinate = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180

export type ParsedSearchUrlState = {
  term: string
  city: string
  locationLabel: string
  sortParam: string
  adTypeParam: string
  sellerTypeParam: string
  minPriceQuery: string
  maxPriceQuery: string
  radiusQuery: string
  categorySlug: string
  hasLocationSelection: boolean
}

export const parseSearchUrlState = (rawSearchParamsString: string): ParsedSearchUrlState => {
  const params = new URLSearchParams(rawSearchParamsString)
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = params.get(key)
      if (typeof value === 'string' && value.trim()) {
        return value
      }
    }
    return ''
  }

  const term = normalizeFreeText(pick('q', 'search'), 255)
  const city = normalizeFreeText(pick('l', 'city'), 120)
  const locationLabel = normalizeFreeText(pick('llabel'), 255) || city
  const sortParam = pick('sort')
  const adTypeParam = pick('adType')
  const sellerTypeParam = pick('sellerType')
  const minPriceQuery = pick('minPrice')
  const maxPriceQuery = pick('maxPrice')
  const radiusQuery = pick('radius', 'radiusKm')
  const categorySlug = pick('category', 'categorySlug')
  const hasLocationSelection = Boolean(pick('lat')) && Boolean(pick('lng'))

  return {
    term,
    city,
    locationLabel,
    sortParam,
    adTypeParam,
    sellerTypeParam,
    minPriceQuery,
    maxPriceQuery,
    radiusQuery,
    categorySlug,
    hasLocationSelection
  }
}

export const parseAttributeFiltersFromParams = (params: URLSearchParams) => {
  const filters: Record<string, unknown> = {}
  const keys = Array.from(new Set(params.keys()))
  const attributeKeys = keys.filter(key => key.startsWith(ATTRIBUTE_PARAM_PREFIX))
  if (attributeKeys.length > 0) {
    attributeKeys.forEach(key => {
      const name = key.slice(ATTRIBUTE_PARAM_PREFIX.length)
      if (!name) {
        return
      }
      const values = params.getAll(key).filter(value => value !== '')
      if (values.length === 1) {
        filters[name] = values[0]
      } else if (values.length > 1) {
        filters[name] = values
      }
    })
    return filters
  }

  const legacyAttributes = params.get('attributes')
  if (!legacyAttributes) {
    return filters
  }

  try {
    const parsed = JSON.parse(legacyAttributes)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return filters
  }

  return filters
}

export const normalizeAttributeFilters = (filters: Record<string, unknown>) => {
  const entries = Object.entries(filters).filter(([, value]) => {
    if (value === null || value === undefined) {
      return false
    }
    if (typeof value === 'string' && value.trim() === '') {
      return false
    }
    if (Array.isArray(value)) {
      return value.some(entry => {
        if (entry === null || entry === undefined) {
          return false
        }
        if (typeof entry === 'string' && entry.trim() === '') {
          return false
        }
        return true
      })
    }
    return true
  })

  const normalizedEntries = entries.map(([key, value]) => {
    if (Array.isArray(value)) {
      const cleaned = value.filter(entry => {
        if (entry === null || entry === undefined) {
          return false
        }
        if (typeof entry === 'string' && entry.trim() === '') {
          return false
        }
        return true
      })
      cleaned.sort((a, b) => String(a).localeCompare(String(b)))
      return [key, cleaned]
    }
    return [key, value]
  }) as [string, unknown][]

  normalizedEntries.sort(([a], [b]) => a.localeCompare(b))
  return Object.fromEntries(normalizedEntries)
}

export const buildListingsApiQueryString = (args: {
  rawSearchParamsString: string
  preferences: SearchPreferences
  defaultPageSize: number
  resolvePriceBand: (id: string) => PriceBand | undefined
  attributeFilters: Record<string, unknown>
}) => {
  const { rawSearchParamsString, preferences, defaultPageSize, resolvePriceBand, attributeFilters } = args
  const rawParams = new URLSearchParams(rawSearchParamsString)
  const params = new URLSearchParams()
  const multiValueBuffer: Record<string, string[]> = {
    cityIds: [],
    neighborhoodIds: []
  }

  rawParams.forEach((value, key) => {
    if (!value) {
      return
    }
    if (key.startsWith(ATTRIBUTE_PARAM_PREFIX) || key === 'attributes') {
      return
    }

    const mappedKey = LEGACY_TO_CANONICAL_KEY_MAP[key] ?? key
    let normalizedValue = value

    if (mappedKey === 'search') {
      normalizedValue = normalizeFreeText(value, 255)
    } else if (mappedKey === 'city') {
      normalizedValue = normalizeFreeText(value, 120)
    } else if (mappedKey === 'categorySlug') {
      normalizedValue = normalizeFreeText(value, 120)
    } else if (mappedKey === 'titleOnly') {
      const parsed = parseBooleanValue(value)
      if (parsed !== true) {
        return
      }
      normalizedValue = 'true'
    } else if (mappedKey === 'isFeatured') {
      const parsed = parseBooleanValue(value)
      if (parsed === undefined) {
        return
      }
      normalizedValue = parsed ? 'true' : 'false'
    } else if (mappedKey === 'page') {
      const parsed = sanitizeIntegerParam(value, 1, MAX_API_PAGE)
      if (!parsed) {
        return
      }
      normalizedValue = parsed
    } else if (mappedKey === 'limit') {
      const parsed = sanitizeIntegerParam(value, 1, MAX_API_LIMIT)
      if (!parsed) {
        return
      }
      normalizedValue = parsed
    }

    if (!normalizedValue) {
      return
    }

    if (MULTI_VALUE_KEYS.has(mappedKey)) {
      multiValueBuffer[mappedKey].push(...normalizedValue.split(',').map(entry => entry.trim()).filter(Boolean))
      return
    }

    params.set(mappedKey, normalizedValue)
  })

  Object.entries(multiValueBuffer).forEach(([key, values]) => {
    Array.from(new Set(values)).forEach(value => params.append(key, value))
  })

  if (!params.has('page') && Number(preferences.page) > 1) {
    const parsed = sanitizeIntegerParam(String(preferences.page), 1, MAX_API_PAGE)
    if (parsed) {
      params.set('page', parsed)
    }
  }

  if (!params.has('limit')) {
    const fallbackLimit = Number(preferences.limit ?? defaultPageSize)
    const parsed = sanitizeIntegerParam(String(fallbackLimit), 1, MAX_API_LIMIT)
    params.set('limit', parsed ?? String(Math.min(Math.max(defaultPageSize, 1), MAX_API_LIMIT)))
  }

  const latParam = params.get('lat')
  const lngParam = params.get('lng')
  const hasLatLng = latParam !== null && lngParam !== null
  const parsedLat = hasLatLng ? Number.parseFloat(latParam) : Number.NaN
  const parsedLng = hasLatLng ? Number.parseFloat(lngParam) : Number.NaN
  const hasValidCoordinates = hasLatLng && isValidCoordinate(parsedLat, parsedLng)

  if (!hasValidCoordinates) {
    params.delete('lat')
    params.delete('lng')
    params.delete('radiusKm')
  }

  if (hasValidCoordinates) {
    const currentRadius = params.get('radiusKm')
    if (currentRadius) {
      const parsed = sanitizeRadiusValue(currentRadius)
      if (parsed) {
        params.set('radiusKm', parsed)
      } else {
        params.delete('radiusKm')
      }
    }

    if (!params.has('radiusKm')) {
      const fallback = sanitizeRadiusValue(preferences.radius || '25')
      if (fallback) {
        params.set('radiusKm', fallback)
      }
    }
  }

  const priceBand = resolvePriceBand(preferences.priceBand ?? 'all')
  if (priceBand?.min !== undefined) {
    params.set('minPrice', String(priceBand.min))
  }
  if (priceBand?.max !== undefined) {
    params.set('maxPrice', String(priceBand.max))
  }

  const normalizedAttributes = normalizeAttributeFilters(attributeFilters)
  if (Object.keys(normalizedAttributes).length) {
    params.set('attributes', JSON.stringify(normalizedAttributes))
  }

  return params.toString()
}
