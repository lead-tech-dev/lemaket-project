import { getApiUrl } from './api'

export type GeoSuggestion = {
  id: string
  kind: 'city' | 'neighborhood'
  label: string
  context: string | null
  cityId?: string
  city?: string | null
  neighborhoodId?: string
  zipcode?: string | null
  coordinates: [number, number] | null
}

type GeoReverseResult = GeoSuggestion & {
  address?: string | null
}

export function formatGeoSuggestionLabel(suggestion: GeoSuggestion): string {
  const rawLabel = (suggestion.label ?? '').trim()
  const city = suggestion.city?.trim() ?? ''

  if (!rawLabel) {
    return city
  }

  if (suggestion.kind !== 'neighborhood') {
    return rawLabel
  }

  const primary = rawLabel.split(',')[0]?.trim() || rawLabel
  if (!city) {
    return rawLabel
  }
  return `${primary}, ${city}`
}

export async function geoAutocomplete(query: string, limit = 8): Promise<GeoSuggestion[]> {
  const q = query.trim()
  if (!q) return []
  const params = new URLSearchParams({
    q,
    limit: String(limit)
  })
  const response = await fetch(getApiUrl(`/geo/autocomplete?${params.toString()}`), {
    credentials: 'include'
  })
  if (!response.ok) {
    throw new Error(`Geo autocomplete failed (${response.status})`)
  }
  const items: GeoSuggestion[] = await response.json()
  return items.map(item => ({
    ...item,
    label: formatGeoSuggestionLabel(item)
  }))
}

export async function geoReverse(lat: number, lng: number): Promise<GeoReverseResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng)
  })
  const response = await fetch(getApiUrl(`/geo/reverse?${params.toString()}`), {
    credentials: 'include'
  })
  if (!response.ok) {
    throw new Error(`Geo reverse failed (${response.status})`)
  }
  const item: GeoReverseResult | null = await response.json()
  if (!item) {
    return null
  }
  const label = formatGeoSuggestionLabel(item)
  return {
    ...item,
    label,
    address: item.address?.trim() ? item.address : label
  }
}

export async function geoGeocodeFirst(query: string): Promise<{ lat: number; lng: number } | null> {
  const suggestions = await geoAutocomplete(query, 1)
  const first = suggestions[0]
  if (!first?.coordinates || first.coordinates.length !== 2) {
    return null
  }
  return { lng: first.coordinates[0], lat: first.coordinates[1] }
}
