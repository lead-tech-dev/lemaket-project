import { http } from '@/core/api/http'

export type GeoAutocompleteItem = {
  id: string
  kind: 'city' | 'neighborhood'
  label: string
  context: string | null
  city: string | null
  cityId?: string
  neighborhoodId?: string
  zipcode?: string | null
  coordinates: [number, number] | null
}

type GeoCityItem = {
  id: string
  name: string
  slug: string
  region: string | null
  coordinates: [number, number] | null
}

type GeoNeighborhoodItem = {
  id: string
  name: string
  slug: string
  cityId: string
  city: string | null
  region: string | null
  coordinates: [number, number] | null
}

export const geoApi = {
  autocomplete: (q: string, limit = 8) =>
    http.get<GeoAutocompleteItem[]>(`/geo/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`),
  reverse: (lat: number, lng: number) =>
    http.get<GeoAutocompleteItem | null>(`/geo/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`),
  searchCities: async (q: string, limit = 8): Promise<GeoAutocompleteItem[]> => {
    const items = await http.get<GeoCityItem[]>(`/geo/cities?q=${encodeURIComponent(q)}&limit=${limit}`)
    return items.map(item => ({
      id: `city:${item.id}`,
      kind: 'city' as const,
      label: item.name,
      context: item.region,
      city: item.name,
      cityId: item.id,
      neighborhoodId: undefined,
      zipcode: null,
      coordinates: item.coordinates
    }))
  },
  searchNeighborhoods: async (q: string, limit = 8, cityId?: string): Promise<GeoAutocompleteItem[]> => {
    const suffix = cityId ? `&cityId=${encodeURIComponent(cityId)}` : ''
    const items = await http.get<GeoNeighborhoodItem[]>(
      `/geo/neighborhoods?q=${encodeURIComponent(q)}&limit=${limit}${suffix}`
    )
    return items.map(item => ({
      id: `neighborhood:${item.id}`,
      kind: 'neighborhood' as const,
      label: item.name,
      context: item.city,
      city: item.city,
      cityId: item.cityId,
      neighborhoodId: item.id,
      zipcode: null,
      coordinates: item.coordinates
    }))
  }
}
