import { useEffect, useMemo, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { categoriesApi, type CategoryNode } from '@/features/categories/categories.api'
import { geoApi, type GeoAutocompleteItem } from '@/features/geo/geo.api'
import { homeApi } from '@/features/home/home.api'
import { listingsApi, type ListingItem } from '@/features/listings/listings.api'
import { searchApi, type SearchQuerySuggestionItem } from '@/features/search/search.api'
import {
  parseMobileSearchRouteParams,
  isValidSuggestionQuery,
  normalizeSearchTerm,
  normalizeSuggestionKey,
  resolveDidYouMeanCandidate,
  scoreQuerySuggestion
} from '@/features/search/search-utils'
import { buildListingsSearchParams } from '@/features/search/search-contract'
import { dashboardApi } from '@/features/dashboard/dashboard.api'
import { useSession } from '@/core/auth/session-context'
import { useTabScreenInsets } from '@/core/layout/useTabScreenInsets'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import { getListingImageSource } from '@/core/utils/listing-image'

type SortOption = 'recent' | 'priceAsc' | 'priceDesc'
type SellerTypeOption = '' | 'pro' | 'individual'
type AdTypeOption = '' | 'SELL' | 'BUY' | 'LET' | 'RENT'
type PriceBandId = 'all' | 'lt100' | '100-500' | '500-1000' | 'gt1000'

type SearchFilters = {
  categorySlug: string
  priceBand: PriceBandId
  radiusKm: string
  sort: SortOption
  sellerType: SellerTypeOption
  adType: AdTypeOption
  titleOnly: boolean
}

type LocationSelection = {
  kind: GeoAutocompleteItem['kind']
  label: string
  city: string
  cityId: string
  neighborhoodId: string
  coordinates: { lng: number; lat: number } | null
}

type RecentSearchEntry = {
  id: string
  label: string
  subtitle?: string
  term: string
  selectedLocations: LocationSelection[]
  filters: SearchFilters
  createdAt: string
}

type QuerySuggestionSource = 'recent' | 'trending' | 'history'

type QuerySuggestion = {
  id: string
  label: string
  query: string
  resultCount: number
  hits: number
  source: QuerySuggestionSource
}

const PRICE_BANDS: { id: PriceBandId; min?: number; max?: number }[] = [
  { id: 'all' },
  { id: 'lt100', max: 10000 },
  { id: '100-500', min: 10000, max: 50000 },
  { id: '500-1000', min: 50000, max: 100000 },
  { id: 'gt1000', min: 100000 }
]

const RADIUS_OPTIONS: { value: string; label: string }[] = [
  { value: '10', label: '10 km' },
  { value: '25', label: '25 km' },
  { value: '50', label: '50 km' },
  { value: '100', label: '100 km' }
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'priceAsc', label: 'Prix croissant' },
  { value: 'priceDesc', label: 'Prix décroissant' }
]

const SELLER_TYPE_OPTIONS: { value: SellerTypeOption; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'individual', label: 'Particuliers' },
  { value: 'pro', label: 'Professionnels' }
]

const AD_TYPE_OPTIONS: { value: AdTypeOption; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'SELL', label: 'Offres' },
  { value: 'BUY', label: 'Demandes' },
  { value: 'LET', label: 'Location' },
  { value: 'RENT', label: 'Recherche location' }
]

const DEFAULT_FILTERS: SearchFilters = {
  categorySlug: '',
  priceBand: 'all',
  radiusKm: '25',
  sort: 'recent',
  sellerType: '',
  adType: '',
  titleOnly: false
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() ?? ''
const MAPBOX_STYLE_ID = 'mapbox/streets-v12'
const DEFAULT_MAPBOX_CENTER = { lng: 11.5021, lat: 4.0511 }
const SEARCH_PAGE_SIZE = 24
const RECENT_SEARCHES_STORAGE_KEY = 'lemaket:search:recent'
const SEARCH_STATE_STORAGE_KEY = 'lemaket:search:last-state:v1'
const MAX_RECENT_SEARCHES = 8
const SEARCH_SYNTAX_EXAMPLES = [
  { key: 'phrase', label: '"studio meublé"', value: '"studio meublé"' },
  { key: 'exclude', label: 'coloc -maison', value: 'coloc -maison' },
  { key: 'exactExclude', label: '"iphone 13" -cassé', value: '"iphone 13" -cassé' }
] as const

function getPriceBandLabel(id: PriceBandId) {
  switch (id) {
    case 'lt100':
      return 'Jusqu’à 10 000 FCFA'
    case '100-500':
      return '10 000 - 50 000 FCFA'
    case '500-1000':
      return '50 000 - 100 000 FCFA'
    case 'gt1000':
      return '100 000 FCFA et +'
    default:
      return 'Tous les prix'
  }
}

function resolvePriceBand(id: PriceBandId) {
  return PRICE_BANDS.find(option => option.id === id)
}

function buildPrettyLocation(item: GeoAutocompleteItem) {
  const city = item.city?.trim() || item.context?.split(',')[0]?.trim() || ''
  const primary = item.label.split(',')[0]?.trim() || item.label
  return city && !primary.toLowerCase().includes(city.toLowerCase()) ? `${primary}, ${city}` : primary
}

function buildSuggestionKey(item: GeoAutocompleteItem) {
  return [
    item.kind,
    item.id,
    item.cityId ?? '',
    item.neighborhoodId ?? '',
    item.label.trim().toLowerCase(),
    item.context?.trim().toLowerCase() ?? ''
  ].join(':')
}

function buildLocationSelectionKey(selection: LocationSelection) {
  return [
    selection.kind,
    selection.cityId,
    selection.neighborhoodId,
    selection.label.trim().toLowerCase()
  ].join(':')
}

function buildLocationSelectionFromItem(item: GeoAutocompleteItem) {
  const pretty = buildPrettyLocation(item)
  const city = item.city?.trim() || item.context?.split(',')[0]?.trim() || pretty
  return {
    kind: item.kind,
    label: pretty,
    city,
    cityId: item.cityId ?? (item.kind === 'city' ? item.id.replace(/^city:/, '') : ''),
    neighborhoodId: item.neighborhoodId ?? '',
    coordinates: item.coordinates ? { lng: item.coordinates[0], lat: item.coordinates[1] } : null
  } satisfies LocationSelection
}

function summarizeLocationSelections(selections: LocationSelection[]) {
  if (selections.length === 0) {
    return ''
  }
  if (selections.length === 1) {
    return selections[0]?.label ?? ''
  }
  return `${selections[0]?.label ?? ''} +${selections.length - 1}`
}

function getMapboxZoom(radiusKm: string) {
  const radius = Number(radiusKm)
  if (!Number.isFinite(radius)) {
    return 11
  }
  if (radius <= 5) return 12.2
  if (radius <= 10) return 11.4
  if (radius <= 25) return 10.3
  if (radius <= 50) return 9.5
  if (radius <= 100) return 8.6
  return 7.7
}

function buildMapboxStaticUrl(
  coordinates: { lng: number; lat: number } | null,
  radiusKm: string
) {
  if (!MAPBOX_TOKEN) {
    return null
  }

  const center = coordinates ?? DEFAULT_MAPBOX_CENTER
  const zoom = coordinates ? getMapboxZoom(radiusKm) : 5.2
  const marker = coordinates ? `pin-s+0f60c4(${center.lng},${center.lat})/` : ''
  return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE_ID}/static/${marker}${center.lng},${center.lat},${zoom},0/1200x700?access_token=${MAPBOX_TOKEN}`
}

function countActiveFilters(filters: SearchFilters, hasLocationSelection: boolean) {
  let total = 0
  if (filters.categorySlug) total += 1
  if (filters.priceBand !== 'all') total += 1
  if (filters.sort !== 'recent') total += 1
  if (filters.sellerType) total += 1
  if (filters.adType) total += 1
  if (filters.titleOnly) total += 1
  if (hasLocationSelection && filters.radiusKm !== '25') total += 1
  return total
}

function buildRecentSearchId(term: string, selectedLocations: LocationSelection[], filters: SearchFilters) {
  return JSON.stringify({
    term: term.trim().toLowerCase(),
    locations: selectedLocations.map(selection => buildLocationSelectionKey(selection)).sort(),
    categorySlug: filters.categorySlug,
    priceBand: filters.priceBand,
    radiusKm: filters.radiusKm,
    sort: filters.sort,
    sellerType: filters.sellerType,
    adType: filters.adType,
    titleOnly: filters.titleOnly
  })
}

function buildRecentSearchLabel(term: string, selectedLocationLabel: string, categoryLabel: string) {
  if (term.trim()) {
    return term.trim()
  }
  if (categoryLabel && selectedLocationLabel) {
    return `${categoryLabel} à ${selectedLocationLabel}`
  }
  return categoryLabel || selectedLocationLabel || 'Recherche'
}

function buildRecentSearchSubtitle(selectedLocationLabel: string, categoryLabel: string) {
  return [categoryLabel, selectedLocationLabel].filter(Boolean).join(' • ')
}

function normalizeSearchFilters(input: Partial<SearchFilters> | null | undefined, categorySlugFallback = ''): SearchFilters {
  const next = {
    ...DEFAULT_FILTERS,
    ...(input ?? {})
  }

  if (!SORT_OPTIONS.some(option => option.value === next.sort)) {
    next.sort = DEFAULT_FILTERS.sort
  }
  if (!PRICE_BANDS.some(option => option.id === next.priceBand)) {
    next.priceBand = DEFAULT_FILTERS.priceBand
  }
  if (!RADIUS_OPTIONS.some(option => option.value === next.radiusKm)) {
    next.radiusKm = DEFAULT_FILTERS.radiusKm
  }
  if (!SELLER_TYPE_OPTIONS.some(option => option.value === next.sellerType)) {
    next.sellerType = DEFAULT_FILTERS.sellerType
  }
  if (!AD_TYPE_OPTIONS.some(option => option.value === next.adType)) {
    next.adType = DEFAULT_FILTERS.adType
  }

  next.titleOnly = Boolean(next.titleOnly)
  next.categorySlug =
    typeof next.categorySlug === 'string' && next.categorySlug.trim()
      ? next.categorySlug.trim()
      : categorySlugFallback

  return next
}

function normalizeLocationSelections(input: unknown): LocationSelection[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map(entry => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      const value = entry as Partial<LocationSelection>
      const label = typeof value.label === 'string' ? value.label.trim() : ''
      if (!label) {
        return null
      }

      const kind: LocationSelection['kind'] =
        value.kind === 'city' || value.kind === 'neighborhood' ? value.kind : 'city'

      const coordinates =
        value.coordinates &&
        typeof value.coordinates === 'object' &&
        Number.isFinite((value.coordinates as { lat?: number }).lat) &&
        Number.isFinite((value.coordinates as { lng?: number }).lng)
          ? {
              lat: Number((value.coordinates as { lat: number }).lat),
              lng: Number((value.coordinates as { lng: number }).lng)
            }
          : null

      return {
        kind,
        label,
        city: typeof value.city === 'string' && value.city.trim() ? value.city.trim() : label,
        cityId: typeof value.cityId === 'string' ? value.cityId.trim() : '',
        neighborhoodId: typeof value.neighborhoodId === 'string' ? value.neighborhoodId.trim() : '',
        coordinates
      } satisfies LocationSelection
    })
    .filter((item): item is LocationSelection => Boolean(item))
}

function areFiltersEqual(a: SearchFilters, b: SearchFilters) {
  return (
    a.categorySlug === b.categorySlug &&
    a.priceBand === b.priceBand &&
    a.radiusKm === b.radiusKm &&
    a.sort === b.sort &&
    a.sellerType === b.sellerType &&
    a.adType === b.adType &&
    a.titleOnly === b.titleOnly
  )
}

function formatPrice(price: string, currency: string) {
  const value = Number(price)
  if (!Number.isFinite(value)) {
    return `${price} ${currency}`
  }
  return new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: currency || 'XAF',
    maximumFractionDigits: 0
  }).format(value)
}

function SearchListingCard({ item, onPress }: { item: ListingItem; onPress: () => void }) {
  const imageSource = getListingImageSource(item)
  const locationLine = [item.location?.address || item.location?.city, item.location?.zipcode].filter(Boolean).join(', ')
  const subtitle = item.category?.name || 'Annonce'

  return (
    <Pressable style={({ pressed }) => [styles.resultCard, pressed && styles.resultCardPressed]} onPress={onPress}>
      <View style={styles.resultMedia}>
        <Image source={imageSource} style={styles.resultImage} resizeMode="cover" />

        <View style={styles.resultTopBadges}>
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>{subtitle}</Text>
          </View>
          <Pressable style={styles.resultFavoriteFab} onPress={event => event.stopPropagation()}>
            <Ionicons name="heart-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

      </View>

      <View style={styles.resultBody}>
        <Text style={styles.resultPrice}>{formatPrice(item.price, item.currency || 'XAF')}</Text>
        <Text style={styles.resultTitle} numberOfLines={1} ellipsizeMode="tail">
          {item.title}
        </Text>
        <Text style={styles.resultMetaLocation} numberOfLines={2}>
          {locationLine || item.location?.city || 'Localisation à confirmer'}
        </Text>
      </View>
    </Pressable>
  )
}

export default function SearchScreen() {
  const router = useRouter()
  const { isAuthenticated } = useSession()
  const params = useLocalSearchParams<{
    category?: string | string[]
    categorySlug?: string | string[]
    q?: string | string[]
    search?: string | string[]
    l?: string | string[]
    city?: string | string[]
  }>()
  const { topInset, bottomInset } = useTabScreenInsets()
  const safeAreaInsets = useSafeAreaInsets()
  const modalBottomPadding = Math.max(safeAreaInsets.bottom, spacing.md)
  const floatingActionBottom = spacing.sm
  const routeSearchState = useMemo(() => parseMobileSearchRouteParams(params), [params])

  const [term, setTerm] = useState(routeSearchState.term)
  const [termFocused, setTermFocused] = useState(false)
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [location, setLocation] = useState(routeSearchState.city)
  const [debouncedLocation, setDebouncedLocation] = useState('')
  const [selectedLocations, setSelectedLocations] = useState<LocationSelection[]>([])
  const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false)
  const [draftLocationSelections, setDraftLocationSelections] = useState<LocationSelection[]>([])
  const [draftLocationRadiusKm, setDraftLocationRadiusKm] = useState('25')
  const [isLocating, setIsLocating] = useState(false)
  const [isFiltersVisible, setIsFiltersVisible] = useState(false)
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>([])
  const [categoryBrowserParentId, setCategoryBrowserParentId] = useState<string | null>(null)
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [locationFooterHeight, setLocationFooterHeight] = useState(96)
  const [hasSearchScrolled, setHasSearchScrolled] = useState(false)
  const normalizedTerm = useMemo(() => normalizeSearchTerm(term), [term])
  const saveActionTextOpacity = useRef(new Animated.Value(0)).current
  const saveActionTextTranslateX = useRef(new Animated.Value(10)).current
  const lastSavedSearchIdRef = useRef<string | null>(null)
  const termBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasHydratedPersistedStateRef = useRef(false)

  const selectedLocationLabel = useMemo(() => summarizeLocationSelections(selectedLocations), [selectedLocations])
  const selectedCity = useMemo(() => (selectedLocations.length === 1 ? selectedLocations[0]?.city ?? '' : ''), [selectedLocations])
  const selectedCoordinates = useMemo(
    () => (selectedLocations.length === 1 ? selectedLocations[0]?.coordinates ?? null : null),
    [selectedLocations]
  )
  const selectedCityIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedLocations
            .filter(selection => selection.kind === 'city')
            .map(selection => selection.cityId)
            .filter(Boolean)
        )
      ),
    [selectedLocations]
  )
  const selectedNeighborhoodIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedLocations
            .filter(selection => selection.kind === 'neighborhood')
            .map(selection => selection.neighborhoodId)
            .filter(Boolean)
        )
      ),
    [selectedLocations]
  )

  const categoryParam = routeSearchState.categorySlug

  useEffect(() => {
    if (routeSearchState.term) {
      setTerm(routeSearchState.term)
    }
  }, [routeSearchState.term])

  useEffect(() => {
    if (routeSearchState.city) {
      setLocation(routeSearchState.city)
    }
  }, [routeSearchState.city])

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedLocation(location.trim()), 250)
    return () => clearTimeout(timeoutId)
  }, [location])

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedTerm(normalizedTerm), 220)
    return () => clearTimeout(timeoutId)
  }, [normalizedTerm])

  useEffect(() => {
    return () => {
      if (termBlurTimeoutRef.current) {
        clearTimeout(termBlurTimeoutRef.current)
        termBlurTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true

    void AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY)
      .then(raw => {
        if (!mounted || !raw) {
          return
        }
        const parsed = JSON.parse(raw) as RecentSearchEntry[]
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES))
        }
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (hasHydratedPersistedStateRef.current) {
      return
    }

    hasHydratedPersistedStateRef.current = true
    let active = true

    void AsyncStorage.getItem(SEARCH_STATE_STORAGE_KEY)
      .then(raw => {
        if (!active || !raw) {
          return
        }

        const parsed = JSON.parse(raw) as {
          term?: string
          selectedLocations?: unknown
          filters?: Partial<SearchFilters>
        }

        const restoredTerm = typeof parsed.term === 'string' ? normalizeSearchTerm(parsed.term) : ''
        const restoredLocations = normalizeLocationSelections(parsed.selectedLocations)
        const restoredFilters = normalizeSearchFilters(parsed.filters, categoryParam)
        const hasRouteTerm = Boolean(routeSearchState.term)
        const hasRouteCity = Boolean(routeSearchState.city)
        const hasRouteCategory = Boolean(categoryParam)

        if (!hasRouteTerm && restoredTerm) {
          setTerm(restoredTerm)
        }

        if (!hasRouteCity && restoredLocations.length > 0) {
          setSelectedLocations(restoredLocations)
          setDraftLocationSelections(restoredLocations)
        }

        if (hasRouteCategory) {
          restoredFilters.categorySlug = categoryParam
        }

        setFilters(restoredFilters)
        setDraftFilters(restoredFilters)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [categoryParam, routeSearchState.city, routeSearchState.term])

  useEffect(() => {
    setFilters(current => ({ ...current, categorySlug: categoryParam }))
    setDraftFilters(current => ({ ...current, categorySlug: categoryParam }))
  }, [categoryParam])

  useEffect(() => {
    const baselineFilters = { ...DEFAULT_FILTERS, categorySlug: categoryParam }
    const shouldClear =
      !normalizedTerm &&
      selectedLocations.length === 0 &&
      areFiltersEqual(filters, baselineFilters)

    if (shouldClear) {
      void AsyncStorage.removeItem(SEARCH_STATE_STORAGE_KEY).catch(() => {})
      return
    }

    const payload = JSON.stringify({
      term: normalizedTerm,
      selectedLocations,
      filters,
      updatedAt: new Date().toISOString()
    })

    void AsyncStorage.setItem(SEARCH_STATE_STORAGE_KEY, payload).catch(() => {})
  }, [categoryParam, filters, normalizedTerm, selectedLocations])

  const suggestionsQuery = useQuery({
    queryKey: ['geo', 'autocomplete', debouncedLocation],
    queryFn: async () => {
      const q = debouncedLocation.trim()
      if (q.length < 2) {
        const [citiesResult, neighborhoodsResult] = await Promise.allSettled([
          geoApi.searchCities(q, 8),
          geoApi.searchNeighborhoods(q, 8)
        ])
        const cities = citiesResult.status === 'fulfilled' ? citiesResult.value : []
        const neighborhoods = neighborhoodsResult.status === 'fulfilled' ? neighborhoodsResult.value : []

        if (!cities.length && !neighborhoods.length && citiesResult.status === 'rejected' && neighborhoodsResult.status === 'rejected') {
          throw new Error('Impossible de charger les suggestions de localisation.')
        }

        const seen = new Set<string>()
        return [...neighborhoods, ...cities].filter(item => {
          const key = `${item.kind}:${item.cityId ?? ''}:${item.neighborhoodId ?? item.id}:${item.label.toLowerCase()}`
          if (seen.has(key)) {
            return false
          }
          seen.add(key)
          return true
        })
      }

      const [autocompleteResult, citiesResult, neighborhoodsResult] = await Promise.allSettled([
        geoApi.autocomplete(q, 10),
        geoApi.searchCities(q, 8),
        geoApi.searchNeighborhoods(q, 8)
      ])

      const autocomplete = autocompleteResult.status === 'fulfilled' ? autocompleteResult.value : []
      const cities = citiesResult.status === 'fulfilled' ? citiesResult.value : []
      const neighborhoods = neighborhoodsResult.status === 'fulfilled' ? neighborhoodsResult.value : []

      if (
        !autocomplete.length &&
        !cities.length &&
        !neighborhoods.length &&
        autocompleteResult.status === 'rejected' &&
        citiesResult.status === 'rejected' &&
        neighborhoodsResult.status === 'rejected'
      ) {
        throw new Error('Impossible de charger les suggestions de localisation.')
      }

      const seen = new Set<string>()
      return [...autocomplete, ...neighborhoods, ...cities].filter(item => {
        const key = `${item.kind}:${item.cityId ?? ''}:${item.neighborhoodId ?? item.id}:${item.label.toLowerCase()}`
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
    },
    enabled: isLocationPickerVisible && debouncedLocation.length >= 1
  })

  const trendingSearchesQuery = useQuery({
    queryKey: ['home', 'trending-searches', 'search-screen'],
    queryFn: () => homeApi.trendingSearches(),
    staleTime: 5 * 60 * 1000
  })

  const historySuggestionsQuery = useQuery({
    queryKey: ['search', 'query-suggestions', debouncedTerm],
    queryFn: () => searchApi.suggestions(debouncedTerm, 10),
    enabled: termFocused && debouncedTerm.length >= 2,
    staleTime: 60 * 1000
  })

  const didYouMeanQuery = useQuery({
    queryKey: ['search', 'did-you-mean', normalizedTerm],
    queryFn: () => searchApi.suggestions(normalizedTerm, 6),
    enabled: normalizedTerm.length >= DID_YOU_MEAN_MIN_LENGTH,
    staleTime: 60 * 1000
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => categoriesApi.active()
  })

  const listingsQuery = useInfiniteQuery({
    queryKey: [
      'listings',
      'search',
      normalizedTerm,
      selectedLocationLabel,
      selectedCityIds.join(','),
      selectedNeighborhoodIds.join(','),
      selectedCoordinates?.lat,
      selectedCoordinates?.lng,
      filters.categorySlug,
      filters.priceBand,
      filters.radiusKm,
      filters.sort,
      filters.sellerType,
      filters.adType,
      filters.titleOnly
    ],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const query = buildListingsSearchParams({
        page: Number(pageParam),
        limit: SEARCH_PAGE_SIZE,
        term: normalizedTerm,
        selectedCity,
        selectedCityIds,
        selectedNeighborhoodIds,
        selectedCoordinates,
        filters,
        resolvePriceBand
      })
      return listingsApi.search(query)
    },
    getNextPageParam: lastPage => {
      const currentPage = lastPage.page ?? 1
      const limit = lastPage.limit ?? SEARCH_PAGE_SIZE
      const total = lastPage.total ?? 0
      const loaded = currentPage * limit
      return loaded < total ? currentPage + 1 : undefined
    }
  })

  const createAlertMutation = useMutation({
    mutationFn: async () => {
      if (!normalizedTerm && selectedLocations.length === 0 && !filters.categorySlug) {
        throw new Error('Ajoute au moins un mot-clé, une localisation ou une catégorie.')
      }
      return dashboardApi.createAlert({
        term: normalizedTerm || undefined,
        location: selectedLocations.map(selection => selection.label).join(', ') || undefined,
        categorySlug: filters.categorySlug || undefined,
        sellerType: filters.sellerType || undefined,
        priceBand: filters.priceBand !== 'all' ? filters.priceBand : undefined,
        radius: selectedLocations.length === 1 && selectedCoordinates ? Number(filters.radiusKm) : undefined
      })
    },
    onSuccess: () => {
      Alert.alert('Recherche enregistrée', 'L’alerte a bien été sauvegardée.')
    },
    onError: error => {
      Alert.alert('Alerte', error instanceof Error ? error.message : 'Impossible d’enregistrer cette recherche.')
    }
  })

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const parentCategories = useMemo(() => categories.filter(category => !category.parentId), [categories])

  const categoryLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      if (category.slug?.trim()) {
        map.set(category.slug.trim().toLowerCase(), category.name)
      }
      for (const child of category.children ?? []) {
        if (child.slug?.trim()) {
          map.set(child.slug.trim().toLowerCase(), child.name)
        }
      }
    }
    return map
  }, [categories])

  const childParentSlugMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      for (const child of category.children ?? []) {
        map.set(child.slug, category.id)
      }
    }
    return map
  }, [categories])

  const selectedCategoryLabel = useMemo(() => {
    if (!filters.categorySlug) {
      return ''
    }
    return categoryLabelMap.get(filters.categorySlug.toLowerCase()) ?? filters.categorySlug
  }, [categoryLabelMap, filters.categorySlug])

  const selectedBrowseParent = useMemo(() => {
    if (!categoryBrowserParentId) {
      return null
    }
    return parentCategories.find(category => category.id === categoryBrowserParentId) ?? null
  }, [categoryBrowserParentId, parentCategories])

  const suggestions = useMemo(() => suggestionsQuery.data ?? [], [suggestionsQuery.data])
  const stableSuggestions = useMemo(() => {
    const seen = new Set<string>()
    return suggestions.filter(item => {
      const key = buildSuggestionKey(item)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }, [suggestions])
  const querySuggestions = useMemo<QuerySuggestion[]>(() => {
    const normalizedInput = debouncedTerm.trim().toLowerCase()
    const recentSuggestions: QuerySuggestion[] = recentSearches
      .map(entry => {
        const query = normalizeSearchTerm(entry.term)
        if (!query) {
          return null
        }
        return {
          id: `recent-${query.toLowerCase()}`,
          label: query,
          query,
          resultCount: 0,
          hits: 0,
          source: 'recent'
        } satisfies QuerySuggestion
      })
      .filter((item): item is QuerySuggestion => Boolean(item?.query))

    const trendingSuggestions: QuerySuggestion[] = (trendingSearchesQuery.data ?? []).map(item => ({
      id: `trending-${item.id}`,
      label: item.label,
      query: item.query,
      resultCount: item.resultCount ?? 0,
      hits: 0,
      source: 'trending'
    }))

    const historySuggestions: QuerySuggestion[] = (historySuggestionsQuery.data ?? []).map((item: SearchQuerySuggestionItem) => ({
      id: `history-${item.id}`,
      label: item.label,
      query: item.query,
      resultCount: item.resultCount ?? 0,
      hits: item.hits ?? 0,
      source: 'history'
    }))

    const candidates = normalizedInput
      ? [...historySuggestions, ...recentSuggestions, ...trendingSuggestions].filter(item => {
          const normalizedQuery = item.query.toLowerCase()
          const normalizedLabel = item.label.toLowerCase()
          return normalizedQuery.includes(normalizedInput) || normalizedLabel.includes(normalizedInput)
        })
      : [...recentSuggestions, ...trendingSuggestions]

    const seen = new Set<string>()
    return candidates
      .map(item => ({ item, score: scoreQuerySuggestion(item, normalizedInput) }))
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)
      .filter(item => {
        if (!isValidSuggestionQuery(item.query)) {
          return false
        }
        const key = normalizeSuggestionKey(item.query)
        if (!key || seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
      .slice(0, 8)
  }, [debouncedTerm, historySuggestionsQuery.data, recentSearches, trendingSearchesQuery.data])

  const showQuerySuggestionPanel = termFocused
  const querySuggestionError =
    historySuggestionsQuery.error instanceof Error ? historySuggestionsQuery.error.message : null
  const didYouMean = useMemo(
    () => resolveDidYouMeanCandidate(normalizedTerm, didYouMeanQuery.data ?? []),
    [didYouMeanQuery.data, normalizedTerm]
  )
  const results = useMemo(
    () => listingsQuery.data?.pages.flatMap(page => page.data ?? []) ?? [],
    [listingsQuery.data]
  )
  const hasRadiusSelection = selectedLocations.length === 1 && Boolean(selectedCoordinates)
  const activeFiltersCount = countActiveFilters(filters, hasRadiusSelection)
  const resultsCount = listingsQuery.data?.pages[0]?.total ?? results.length
  const hasPrimarySearchIntent = Boolean(normalizedTerm || selectedLocations.length > 0 || filters.categorySlug)
  const hasZeroResultsWithIntent =
    !listingsQuery.isLoading && !listingsQuery.isError && hasPrimarySearchIntent && results.length === 0
  const listingsErrorMessage =
    listingsQuery.error instanceof Error
      ? listingsQuery.error.message
      : 'Impossible de charger les annonces.'
  const zeroResultSuggestions = useMemo(() => {
    const normalizedCurrent = normalizeSuggestionKey(normalizedTerm)
    const seen = new Set<string>()
    return querySuggestions
      .filter(item => {
        const key = normalizeSuggestionKey(item.query)
        if (!key || key === normalizedCurrent || seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
      .slice(0, 4)
  }, [normalizedTerm, querySuggestions])

  useEffect(() => {
    if (!listingsQuery.isSuccess || !hasPrimarySearchIntent) {
      return
    }

    const searchId = buildRecentSearchId(normalizedTerm, selectedLocations, filters)
    if (lastSavedSearchIdRef.current === searchId) {
      return
    }

    const nextEntry: RecentSearchEntry = {
      id: searchId,
      label: buildRecentSearchLabel(normalizedTerm, selectedLocationLabel, selectedCategoryLabel),
      subtitle: buildRecentSearchSubtitle(selectedLocationLabel, selectedCategoryLabel) || undefined,
      term: normalizedTerm,
      selectedLocations,
      filters,
      createdAt: new Date().toISOString()
    }

    lastSavedSearchIdRef.current = searchId
    setRecentSearches(current => {
      const next = [nextEntry, ...current.filter(entry => entry.id !== nextEntry.id)].slice(0, MAX_RECENT_SEARCHES)
      void AsyncStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [
    filters,
    hasPrimarySearchIntent,
    listingsQuery.isSuccess,
    selectedCategoryLabel,
    selectedLocationLabel,
    selectedLocations,
    normalizedTerm
  ])

  const applyRecentSearch = (entry: RecentSearchEntry) => {
    setTerm(entry.term)
    setSelectedLocations(entry.selectedLocations)
    setDraftLocationSelections(entry.selectedLocations)
    setFilters(entry.filters)
    setDraftFilters(entry.filters)
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    void AsyncStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY).catch(() => {})
  }

  const openFilters = () => {
    setDraftFilters(filters)
    setCategoryBrowserParentId(filters.categorySlug ? childParentSlugMap.get(filters.categorySlug) ?? null : null)
    setIsFiltersVisible(true)
  }

  const applyFilters = () => {
    setFilters(draftFilters)
    setIsFiltersVisible(false)
    setCategoryBrowserParentId(null)
  }

  const resetFilters = () => {
    const reset = { ...DEFAULT_FILTERS, categorySlug: categoryParam }
    setDraftFilters(reset)
    setCategoryBrowserParentId(null)
  }

  const removeLocation = () => {
    setLocation('')
    setDebouncedLocation('')
    setSelectedLocations([])
    setDraftLocationSelections([])
    setFilters(current => ({ ...current, radiusKm: DEFAULT_FILTERS.radiusKm }))
    setDraftFilters(current => ({ ...current, radiusKm: DEFAULT_FILTERS.radiusKm }))
  }

  const resetSearchConstraints = () => {
    const baseline = { ...DEFAULT_FILTERS, categorySlug: categoryParam }
    setLocation('')
    setDebouncedLocation('')
    setSelectedLocations([])
    setDraftLocationSelections([])
    setFilters(baseline)
    setDraftFilters(baseline)
    setCategoryBrowserParentId(null)
    lastSavedSearchIdRef.current = null
    void AsyncStorage.removeItem(SEARCH_STATE_STORAGE_KEY).catch(() => {})
  }

  const applyZeroResultSuggestion = (query: string) => {
    setTerm(normalizeSearchTerm(query))
    if (filters.titleOnly) {
      setFilters(current => ({ ...current, titleOnly: false }))
      setDraftFilters(current => ({ ...current, titleOnly: false }))
    }
  }

  const openLocationPicker = () => {
    setLocation('')
    setDebouncedLocation('')
    setDraftLocationSelections(selectedLocations)
    setDraftLocationRadiusKm(filters.radiusKm || '25')
    setIsLocationPickerVisible(true)
  }

  const handleUseCurrentLocation = async () => {
    if (isLocating) {
      return
    }

    const geolocation = globalThis.navigator?.geolocation
    if (!geolocation) {
      Alert.alert(
        'Localisation indisponible',
        'La géolocalisation n’est pas disponible sur cet appareil ou cette version de l’application.'
      )
      return
    }

    setIsLocating(true)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000
        })
      })

      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const reverseResult = await geoApi.reverse(lat, lng).catch(() => null)

      const selection: LocationSelection = reverseResult
        ? {
            ...buildLocationSelectionFromItem(reverseResult),
            coordinates: { lat, lng }
          }
        : {
            kind: 'city',
            label: 'Autour de moi',
            city: 'Autour de moi',
            cityId: '',
            neighborhoodId: '',
            coordinates: { lat, lng }
          }

      setDraftLocationSelections([selection])
      setDraftLocationRadiusKm(current => current || '25')
      setLocation('')
      setDebouncedLocation('')
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Impossible de récupérer votre position actuelle.'
      Alert.alert('Localisation', message)
    } finally {
      setIsLocating(false)
    }
  }

  const applyLocationSelection = () => {
    if (draftLocationSelections.length === 0) {
      removeLocation()
      setFilters(current => ({ ...current, radiusKm: '25' }))
      setIsLocationPickerVisible(false)
      return
    }

    setLocation('')
    setDebouncedLocation('')
    setSelectedLocations(draftLocationSelections)
    setFilters(current => ({ ...current, radiusKm: draftLocationRadiusKm }))
    setIsLocationPickerVisible(false)
  }

  const browseParentSelected = (category: CategoryNode) => {
    if (draftFilters.categorySlug === category.slug) {
      return true
    }
    return (category.children ?? []).some(child => child.slug === draftFilters.categorySlug)
  }

  const topChips = [
    {
      key: 'filters',
      icon: 'options-outline' as const,
      label: activeFiltersCount > 0 ? `Filtres ${activeFiltersCount}` : 'Filtres',
      onPress: openFilters,
      active: activeFiltersCount > 0
    },
    {
      key: 'location',
      icon: 'location-outline' as const,
      label: selectedLocationLabel || 'Tout le Cameroun',
      onPress: openLocationPicker,
      active: selectedLocations.length > 0
    },
    {
      key: 'category',
      icon: 'pricetag-outline' as const,
      label: selectedCategoryLabel || 'Catégories',
      onPress: openFilters,
      active: Boolean(selectedCategoryLabel)
    }
  ]

  const draftPrimaryLocation = draftLocationSelections[0] ?? null
  const mapPreviewUrl = buildMapboxStaticUrl(
    draftLocationSelections.length === 1 ? draftPrimaryLocation?.coordinates ?? null : draftPrimaryLocation?.coordinates ?? null,
    draftLocationRadiusKm
  )

  const handleLocationFooterLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height)
    if (nextHeight > 0 && nextHeight !== locationFooterHeight) {
      setLocationFooterHeight(nextHeight)
    }
  }

  const showSaveActionLabel = hasSearchScrolled || createAlertMutation.isPending

  useEffect(() => {
    if (!showSaveActionLabel) {
      saveActionTextOpacity.setValue(0)
      saveActionTextTranslateX.setValue(10)
      return
    }

    Animated.parallel([
      Animated.timing(saveActionTextOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true
      }),
      Animated.timing(saveActionTextTranslateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true
      })
    ]).start()
  }, [saveActionTextOpacity, saveActionTextTranslateX, showSaveActionLabel])

  return (
    <View style={styles.screen}>
      <FlatList
        data={results}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        onScroll={event => {
          const nextScrolled = event.nativeEvent.contentOffset.y > 8
          if (nextScrolled !== hasSearchScrolled) {
            setHasSearchScrolled(nextScrolled)
          }
        }}
        scrollEventThrottle={16}
        onEndReached={() => {
          if (listingsQuery.hasNextPage && !listingsQuery.isFetchingNextPage) {
            void listingsQuery.fetchNextPage()
          }
        }}
        onEndReachedThreshold={0.35}
        contentContainerStyle={{
          paddingTop: topInset + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: bottomInset + 120
        }}
        ListHeaderComponent={
          <>
            <View style={styles.searchHeaderRow}>
              <Pressable style={styles.headerIconButton} onPress={() => router.push('/(tabs)/index')}>
                <Ionicons name="arrow-back" size={28} color={colors.text} />
              </Pressable>

              <View style={styles.searchBarShell}>
                <Ionicons name="search-outline" size={24} color={colors.muted} />
                <TextInput
                  value={term}
                  onChangeText={setTerm}
                  onFocus={() => {
                    if (termBlurTimeoutRef.current) {
                      clearTimeout(termBlurTimeoutRef.current)
                      termBlurTimeoutRef.current = null
                    }
                    setTermFocused(true)
                  }}
                  onBlur={() => {
                    termBlurTimeoutRef.current = setTimeout(() => {
                      setTermFocused(false)
                      termBlurTimeoutRef.current = null
                    }, 140)
                  }}
                  placeholder="Rechercher sur LEMAKET"
                  placeholderTextColor={colors.placeholder}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                <Pressable style={styles.searchCameraButton} onPress={() => router.push('/listings/new')}>
                  <Ionicons name="camera-outline" size={22} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {showQuerySuggestionPanel ? (
              <View style={styles.querySuggestionsCard}>
                {historySuggestionsQuery.isFetching ? (
                  <View style={styles.querySuggestionsLoading}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.querySuggestionsLoadingText}>Suggestions en cours…</Text>
                  </View>
                ) : querySuggestionError ? (
                  <Text style={styles.querySuggestionsErrorText}>{querySuggestionError}</Text>
                ) : querySuggestions.length > 0 ? (
                  querySuggestions.map(item => (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [styles.querySuggestionItem, pressed && styles.querySuggestionItemPressed]}
                      onPress={() => {
                        if (termBlurTimeoutRef.current) {
                          clearTimeout(termBlurTimeoutRef.current)
                          termBlurTimeoutRef.current = null
                        }
                        setTerm(item.query)
                        setTermFocused(false)
                      }}
                    >
                      <View style={styles.querySuggestionIcon}>
                        <Ionicons
                          name={
                            item.source === 'recent'
                              ? 'time-outline'
                              : item.source === 'trending'
                              ? 'trending-up-outline'
                              : 'sparkles-outline'
                          }
                          size={16}
                          color={colors.accent}
                        />
                      </View>
                      <View style={styles.querySuggestionContent}>
                        <Text style={styles.querySuggestionLabel} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={styles.querySuggestionMeta} numberOfLines={1}>
                          {item.source === 'recent'
                            ? 'Historique'
                            : item.source === 'trending'
                            ? 'Tendance'
                            : 'Suggestions'}
                          {item.resultCount > 0 ? ` · ${item.resultCount}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.querySuggestionsEmptyText}>
                    {debouncedTerm.length >= 2
                      ? 'Aucune suggestion pour ce mot-clé.'
                      : 'Commence à saisir pour voir des suggestions.'}
                  </Text>
                )}
              </View>
            ) : null}

            <View style={styles.searchSyntaxRow}>
              <Text style={styles.searchSyntaxHint}>Astuce: « phrase exacte » ou -mot pour exclure</Text>
              <View style={styles.searchSyntaxChips}>
                {SEARCH_SYNTAX_EXAMPLES.map(example => (
                  <Pressable
                    key={example.key}
                    style={styles.searchSyntaxChip}
                    onPress={() => setTerm(example.value)}
                  >
                    <Text style={styles.searchSyntaxChipText}>{example.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.topChipsWrap}
              contentContainerStyle={styles.topChipsContent}
            >
              {topChips.map(chip => (
                <Pressable
                  key={chip.key}
                  style={[styles.topChip, chip.active && styles.topChipActive]}
                  onPress={chip.onPress}
                >
                  <Ionicons name={chip.icon} size={18} color={chip.active ? colors.primary : colors.text} />
                  <Text style={[styles.topChipText, chip.active && styles.topChipTextActive]} numberOfLines={1}>
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {!hasPrimarySearchIntent && recentSearches.length > 0 ? (
              <View style={styles.recentSearchesSection}>
                <View style={styles.recentSearchesHeader}>
                  <Text style={styles.recentSearchesTitle}>Recherches récentes</Text>
                  <Pressable onPress={clearRecentSearches}>
                    <Text style={styles.recentSearchesClearText}>Effacer</Text>
                  </Pressable>
                </View>
                <View style={styles.recentSearchesList}>
                  {recentSearches.map(entry => (
                    <Pressable
                      key={entry.id}
                      style={styles.recentSearchRow}
                      onPress={() => applyRecentSearch(entry)}
                    >
                      <View style={styles.recentSearchIcon}>
                        <Ionicons name="time-outline" size={18} color={colors.accent} />
                      </View>
                      <View style={styles.recentSearchContent}>
                        <Text style={styles.recentSearchLabel} numberOfLines={1}>
                          {entry.label}
                        </Text>
                        {entry.subtitle ? (
                          <Text style={styles.recentSearchSubtitle} numberOfLines={1}>
                            {entry.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {selectedLocations.length === 1 && selectedCoordinates ? (
              <View style={styles.radiusInline}>
                {RADIUS_OPTIONS.map(option => {
                  const selected = filters.radiusKm === option.value
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.radiusPill, selected && styles.radiusPillActive]}
                      onPress={() => setFilters(current => ({ ...current, radiusKm: option.value }))}
                    >
                      <Text style={[styles.radiusPillText, selected && styles.radiusPillTextActive]}>{option.label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            ) : null}

            <View style={styles.resultsHeading}>
              <Text style={styles.resultsCount}>{resultsCount.toLocaleString('fr-FR')} annonces</Text>
              {selectedCategoryLabel || selectedLocationLabel ? (
                <Text style={styles.resultsSubline}>
                  {[selectedCategoryLabel, selectedLocationLabel].filter(Boolean).join(' • ')}
                </Text>
              ) : null}
              {didYouMean ? (
                <View style={styles.didYouMeanRow}>
                  <Text style={styles.didYouMeanText}>Vous vouliez dire </Text>
                  <Pressable onPress={() => setTerm(didYouMean.query)}>
                    <Text style={styles.didYouMeanLink}>{didYouMean.label}</Text>
                  </Pressable>
                  <Text style={styles.didYouMeanText}> ?</Text>
                </View>
              ) : null}
            </View>
          </>
        }
        ListEmptyComponent={
          listingsQuery.isLoading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.empty}>
                {listingsQuery.isError ? listingsErrorMessage : null}
                {!listingsQuery.isError && (selectedLocations.length > 0 || filters.categorySlug || normalizedTerm)
                  ? 'Aucune annonce trouvée pour ces filtres.'
                  : null}
                {!listingsQuery.isError && !(selectedLocations.length > 0 || filters.categorySlug || normalizedTerm)
                  ? 'Commence par saisir un mot-clé, une catégorie ou un quartier.'
                  : null}
              </Text>
              {!listingsQuery.isError && hasZeroResultsWithIntent ? (
                <>
                  {didYouMean ? (
                    <View style={styles.emptyDidYouMeanRow}>
                      <Text style={styles.emptyDidYouMeanText}>Essayez plutôt </Text>
                      <Pressable onPress={() => applyZeroResultSuggestion(didYouMean.query)}>
                        <Text style={styles.emptyDidYouMeanLink}>{didYouMean.label}</Text>
                      </Pressable>
                      <Text style={styles.emptyDidYouMeanText}>.</Text>
                    </View>
                  ) : null}

                  <View style={styles.emptyActionsRow}>
                    {selectedLocations.length > 0 ? (
                      <Pressable style={styles.emptyActionButton} onPress={removeLocation}>
                        <Text style={styles.emptyActionButtonText}>Tout le Cameroun</Text>
                      </Pressable>
                    ) : null}
                    {filters.titleOnly ? (
                      <Pressable
                        style={styles.emptyActionButton}
                        onPress={() => {
                          setFilters(current => ({ ...current, titleOnly: false }))
                          setDraftFilters(current => ({ ...current, titleOnly: false }))
                        }}
                      >
                        <Text style={styles.emptyActionButtonText}>Chercher titre + description</Text>
                      </Pressable>
                    ) : null}
                    {activeFiltersCount > 0 || selectedLocations.length > 0 ? (
                      <Pressable style={styles.emptyActionButton} onPress={resetSearchConstraints}>
                        <Text style={styles.emptyActionButtonText}>Réinitialiser les filtres</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {zeroResultSuggestions.length > 0 ? (
                    <View style={styles.emptySuggestions}>
                      <Text style={styles.emptySuggestionsTitle}>Suggestions</Text>
                      <View style={styles.emptySuggestionsList}>
                        {zeroResultSuggestions.map(item => (
                          <Pressable
                            key={item.id}
                            style={styles.emptySuggestionChip}
                            onPress={() => applyZeroResultSuggestion(item.query)}
                          >
                            <Text style={styles.emptySuggestionChipText}>{item.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}
              {listingsQuery.isError ? (
                <Pressable
                  style={styles.retryButton}
                  onPress={() => {
                    void listingsQuery.refetch()
                  }}
                >
                  <Text style={styles.retryButtonText}>Réessayer</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={
          listingsQuery.isFetchingNextPage ? (
            <View style={styles.paginationLoader}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.paginationLoaderText}>Chargement des annonces...</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.resultItemWrap}>
            <SearchListingCard item={item} onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.id } })} />
          </View>
        )}
      />

      <View style={[styles.floatingActions, { bottom: floatingActionBottom }]}>
        <Pressable
          style={[styles.saveAction, !showSaveActionLabel && styles.saveActionCollapsed]}
          onPress={() => {
            if (!isAuthenticated) {
              router.push('/(auth)/login')
              return
            }
            createAlertMutation.mutate()
          }}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.white} />
          {showSaveActionLabel ? (
            <Animated.Text
              style={[
                styles.saveActionText,
                {
                  opacity: saveActionTextOpacity,
                  transform: [{ translateX: saveActionTextTranslateX }]
                }
              ]}
            >
              {createAlertMutation.isPending ? 'Enregistrement...' : 'Sauvegarder la recherche'}
            </Animated.Text>
          ) : null}
        </Pressable>
      </View>

      <Modal
        visible={isLocationPickerVisible}
        animationType="slide"
        onRequestClose={() => setIsLocationPickerVisible(false)}
      >
        <KeyboardAvoidingView
          style={[styles.locationPickerScreen, { paddingTop: topInset + spacing.md }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.locationPickerMain}>
            <ScrollView
              style={styles.locationPickerScroll}
              contentContainerStyle={[
                styles.locationPickerScrollContent,
                { paddingBottom: locationFooterHeight + spacing.md }
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.locationPickerHeader}>
                <Pressable style={styles.headerIconButton} onPress={() => setIsLocationPickerVisible(false)}>
                  <Ionicons name="arrow-back" size={28} color={colors.text} />
                </Pressable>
                <Text style={styles.locationPickerTitle}>Où cherchez-vous ?</Text>
                <View style={styles.headerIconButton} />
              </View>

              <View style={styles.locationPickerSearchBar}>
                <Ionicons name="search-outline" size={22} color={colors.muted} />
                <TextInput
                  value={location}
                  onChangeText={value => {
                    setLocation(value)
                  }}
                  placeholder="Saisissez une localisation"
                  placeholderTextColor={colors.placeholder}
                  style={styles.locationPickerInput}
                  autoFocus
                />
                {location ? (
                  <Pressable onPress={() => setLocation('')}>
                    <Ionicons name="close-circle" size={20} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>

              {draftLocationSelections.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.locationSelectionChipsScroll}
                  contentContainerStyle={styles.locationSelectionChipsWrap}
                >
                  {draftLocationSelections.map(selection => (
                    <View key={buildLocationSelectionKey(selection)} style={styles.locationSelectionChip}>
                      <Text style={styles.locationSelectionChipText} numberOfLines={1}>
                        {selection.label}
                      </Text>
                      <Pressable
                        onPress={() => {
                          setDraftLocationSelections(current =>
                            current.filter(item => buildLocationSelectionKey(item) !== buildLocationSelectionKey(selection))
                          )
                        }}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.text} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              <View style={styles.locationSuggestionsInline}>
                {suggestionsQuery.isLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Recherche des quartiers et villes...</Text>
                  </View>
                ) : null}

              {suggestionsQuery.error ? (
                <View style={styles.locationErrorCard}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                  <Text style={styles.locationErrorText}>
                    {suggestionsQuery.error instanceof Error
                      ? suggestionsQuery.error.message
                      : 'Impossible de charger les suggestions.'}
                  </Text>
                </View>
              ) : null}

              {location.trim().length >= 1 ? (
                stableSuggestions.length > 0 ? (
                  <ScrollView
                    style={styles.inlineSuggestionsScroll}
                    contentContainerStyle={styles.inlineSuggestionsContent}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.suggestionsCard}>
                      {stableSuggestions.map(item => {
                        const pretty = buildPrettyLocation(item)
                        return (
                          <Pressable
                            key={buildSuggestionKey(item)}
                            style={({ pressed }) => [styles.suggestionItem, pressed && styles.suggestionItemPressed]}
                            onPress={() => {
                              const nextSelection = buildLocationSelectionFromItem(item)
                              const nextKey = buildLocationSelectionKey(nextSelection)
                              setDraftLocationSelections(current => {
                                const exists = current.some(selection => buildLocationSelectionKey(selection) === nextKey)
                                if (exists) {
                                  return current.filter(selection => buildLocationSelectionKey(selection) !== nextKey)
                                }
                                return [...current, nextSelection]
                              })
                              setLocation('')
                              setDebouncedLocation('')
                            }}
                          >
                            <View style={styles.suggestionIcon}>
                              <Ionicons
                                name={item.kind === 'neighborhood' ? 'location-outline' : 'business-outline'}
                                size={16}
                                color={colors.muted}
                              />
                            </View>
                            <View style={styles.suggestionContent}>
                              <Text style={styles.suggestionText}>{pretty}</Text>
                              <Text style={styles.suggestionMeta}>
                                {item.kind === 'neighborhood' ? 'Quartier' : 'Ville'}
                                {item.city && item.kind === 'neighborhood' ? ` • ${item.city}` : ''}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                          </Pressable>
                        )
                      })}
                    </View>
                  </ScrollView>
                ) : suggestionsQuery.isLoading ? (
                  <View style={styles.suggestionsCard}>
                    <View style={styles.locationSuggestionsLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.loadingText}>Recherche des suggestions...</Text>
                    </View>
                  </View>
                ) : !suggestionsQuery.isLoading ? (
                  <Text style={styles.locationPickerEmpty}>Aucun résultat pour cette recherche.</Text>
                ) : null
              ) : (
                <View style={styles.locationPickerHintCard}>
                  <Ionicons name="navigate-outline" size={22} color={colors.accent} />
                  <Text style={styles.locationPickerHintTitle}>Recherche par ville ou quartier</Text>
                  <Text style={styles.locationPickerHintText}>
                    Saisis par exemple Douala, Yaoundé, Akwa ou Mvog-Ada pour filtrer tes annonces.
                  </Text>
                </View>
              )}
            </View>

            {draftLocationSelections.length <= 1 ? (
              <View style={styles.radiusPickerSection}>
                <View style={styles.radiusPickerHeader}>
                  <Text style={styles.radiusPickerTitle}>Dans un rayon de</Text>
                  <Text style={styles.radiusPickerValue}>{draftLocationRadiusKm} km</Text>
                </View>
                <View style={styles.radiusPickerChips}>
                  {RADIUS_OPTIONS.map(option => {
                    const selected = draftLocationRadiusKm === option.value
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.radiusPickerChip, selected && styles.radiusPickerChipActive]}
                        onPress={() => setDraftLocationRadiusKm(option.value)}
                      >
                        <Text style={[styles.radiusPickerChipText, selected && styles.radiusPickerChipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.multiLocationInfoCard}>
                <Ionicons name="layers-outline" size={18} color={colors.accent} />
                <Text style={styles.multiLocationInfoText}>
                  Le rayon s’applique à une seule zone. Avec plusieurs villes ou quartiers, la recherche couvre directement
                  toutes les zones sélectionnées.
                </Text>
              </View>
            )}

            <View style={styles.mapPreviewCard}>
              {mapPreviewUrl ? (
                <>
                  <Image source={{ uri: mapPreviewUrl }} style={styles.mapPreviewImage} resizeMode="cover" />
                  <View style={styles.mapPreviewCenter}>
                    <Ionicons name="locate" size={18} color={colors.accent} />
                  </View>
                  <View style={styles.mapPreviewBadge}>
                    <Text style={styles.mapPreviewBadgeText}>Mapbox</Text>
                  </View>
                  <Text style={styles.mapPreviewLabel} numberOfLines={1}>
                    {draftLocationSelections.length > 1
                      ? `${draftPrimaryLocation?.city || draftPrimaryLocation?.label || 'Cameroun'} +${draftLocationSelections.length - 1}`
                      : draftPrimaryLocation?.city || 'Tout le Cameroun'}
                  </Text>
                </>
              ) : (
                <View style={styles.mapPreviewFallback}>
                  <Ionicons name="map-outline" size={30} color={colors.accent} />
                  <Text style={styles.mapPreviewFallbackTitle}>
                    {MAPBOX_TOKEN ? 'Carte centrée sur le Cameroun' : 'Token Mapbox manquant'}
                  </Text>
                  <Text style={styles.mapPreviewFallbackText}>
                    {MAPBOX_TOKEN
                      ? 'Choisissez une ville ou un quartier pour recentrer la carte.'
                      : 'Ajoutez EXPO_PUBLIC_MAPBOX_TOKEN dans le .env mobile pour afficher la carte Mapbox.'}
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              style={styles.locationPickerAllCountry}
              onPress={() => {
                setDraftLocationSelections([])
                setLocation('')
                setDebouncedLocation('')
              }}
            >
              <View style={styles.locationPickerAllCountryIcon}>
                <Ionicons name="earth-outline" size={18} color={colors.accent} />
              </View>
              <View style={styles.locationPickerAllCountryContent}>
                <Text style={styles.locationPickerAllCountryTitle}>Tout le Cameroun</Text>
                <Text style={styles.locationPickerAllCountryMeta}>Aucune restriction géographique</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>

              <View style={styles.locationPickerResults}>
                <Text style={styles.locationSuggestionsTitle}>Suggestions</Text>

                <Pressable
                  style={styles.locationSuggestionRow}
                  onPress={() => {
                    void handleUseCurrentLocation()
                  }}
                >
                  <View style={styles.locationSuggestionIcon}>
                    {isLocating ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Ionicons name="locate-outline" size={18} color={colors.accent} />
                    )}
                  </View>
                  <Text style={styles.locationSuggestionText}>
                    {isLocating ? 'Localisation en cours...' : 'Autour de moi'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.locationSuggestionRow}
                  onPress={() => {
                    setDraftLocationSelections([])
                    setLocation('')
                    setDebouncedLocation('')
                  }}
                >
                  <View style={styles.locationSuggestionIcon}>
                    <Ionicons name="earth-outline" size={18} color={colors.accent} />
                  </View>
                  <Text style={styles.locationSuggestionText}>Tout le Cameroun</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>

          <View
            style={[styles.locationPickerFooter, { paddingBottom: modalBottomPadding }]}
            onLayout={handleLocationFooterLayout}
          >
            <Pressable
              style={styles.locationPickerClearButton}
              onPress={() => {
                setDraftLocationSelections([])
                setLocation('')
                setDebouncedLocation('')
                setDraftLocationRadiusKm('25')
              }}
            >
              <Text style={styles.locationPickerClearButtonText}>Effacer</Text>
            </Pressable>
            <Pressable style={styles.locationPickerApplyButton} onPress={applyLocationSelection}>
              <Text style={styles.locationPickerApplyButtonText}>Valider la localisation</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isFiltersVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsFiltersVisible(false)
          setCategoryBrowserParentId(null)
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setIsFiltersVisible(false)
              setCategoryBrowserParentId(null)
            }}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              {selectedBrowseParent ? (
                <Pressable style={styles.modalIconButton} onPress={() => setCategoryBrowserParentId(null)}>
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
              ) : (
                <View style={styles.modalIconPlaceholder} />
              )}
              <Text style={styles.modalTitle}>{selectedBrowseParent ? selectedBrowseParent.name : 'Filtres'}</Text>
              <Pressable
                style={styles.modalIconButton}
                onPress={() => {
                  setIsFiltersVisible(false)
                  setCategoryBrowserParentId(null)
                }}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Catégorie</Text>
                {selectedBrowseParent ? (
                  <>
                    <Pressable
                      style={[
                        styles.categoryRow,
                        draftFilters.categorySlug === selectedBrowseParent.slug && styles.categoryRowActive
                      ]}
                      onPress={() => setDraftFilters(current => ({ ...current, categorySlug: selectedBrowseParent.slug }))}
                    >
                      <Text style={styles.categoryRowTitle}>Toute la catégorie {selectedBrowseParent.name}</Text>
                      {draftFilters.categorySlug === selectedBrowseParent.slug ? (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                      )}
                    </Pressable>
                    {(selectedBrowseParent.children ?? []).map(child => {
                      const selected = draftFilters.categorySlug === child.slug
                      return (
                        <Pressable
                          key={child.id}
                          style={[styles.categoryRow, selected && styles.categoryRowActive]}
                          onPress={() => setDraftFilters(current => ({ ...current, categorySlug: child.slug }))}
                        >
                          <View style={styles.categoryRowContent}>
                            <Text style={styles.categoryRowTitle}>{child.name}</Text>
                            {child.description ? (
                              <Text style={styles.categoryRowDescription} numberOfLines={2}>
                                {child.description}
                              </Text>
                            ) : null}
                          </View>
                          {selected ? (
                            <Ionicons name="checkmark" size={18} color={colors.primary} />
                          ) : (
                            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                          )}
                        </Pressable>
                      )
                    })}
                  </>
                ) : (
                  <>
                    <Pressable
                      style={[styles.categoryRow, !draftFilters.categorySlug && styles.categoryRowActive]}
                      onPress={() => setDraftFilters(current => ({ ...current, categorySlug: '' }))}
                    >
                      <Text style={styles.categoryRowTitle}>Toutes les catégories</Text>
                      {!draftFilters.categorySlug ? (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                      )}
                    </Pressable>
                    {parentCategories.map(category => {
                      const selected = browseParentSelected(category)
                      return (
                        <Pressable
                          key={category.id}
                          style={[styles.categoryRow, selected && styles.categoryRowActive]}
                          onPress={() => {
                            if ((category.children ?? []).length > 0) {
                              setCategoryBrowserParentId(category.id)
                              return
                            }
                            setDraftFilters(current => ({ ...current, categorySlug: category.slug }))
                          }}
                        >
                          <View style={styles.categoryRowContent}>
                            <Text style={styles.categoryRowTitle}>{category.name}</Text>
                            {category.description ? (
                              <Text style={styles.categoryRowDescription} numberOfLines={2}>
                                {category.description}
                              </Text>
                            ) : null}
                          </View>
                          <Ionicons
                            name={(category.children ?? []).length > 0 ? 'chevron-forward' : selected ? 'checkmark' : 'chevron-forward'}
                            size={18}
                            color={selected ? colors.primary : colors.muted}
                          />
                        </Pressable>
                      )
                    })}
                  </>
                )}
              </View>

              {!selectedBrowseParent ? (
                <>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Tri</Text>
                    <View style={styles.filterGrid}>
                      {SORT_OPTIONS.map(option => {
                        const selected = draftFilters.sort === option.value
                        return (
                          <Pressable
                            key={option.value}
                            style={[styles.filterOption, selected && styles.filterOptionActive]}
                            onPress={() => setDraftFilters(current => ({ ...current, sort: option.value }))}
                          >
                            <Text style={[styles.filterOptionText, selected && styles.filterOptionTextActive]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Prix</Text>
                    <View style={styles.filterGrid}>
                      {PRICE_BANDS.map(option => {
                        const selected = draftFilters.priceBand === option.id
                        return (
                          <Pressable
                            key={option.id}
                            style={[styles.filterOption, selected && styles.filterOptionActive]}
                            onPress={() => setDraftFilters(current => ({ ...current, priceBand: option.id }))}
                          >
                            <Text style={[styles.filterOptionText, selected && styles.filterOptionTextActive]}>
                              {getPriceBandLabel(option.id)}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>

                  {hasRadiusSelection ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Rayon</Text>
                      <View style={styles.filterGrid}>
                        {RADIUS_OPTIONS.map(option => {
                          const selected = draftFilters.radiusKm === option.value
                          return (
                            <Pressable
                              key={option.value}
                              style={[styles.filterOption, selected && styles.filterOptionActive]}
                              onPress={() => setDraftFilters(current => ({ ...current, radiusKm: option.value }))}
                            >
                              <Text style={[styles.filterOptionText, selected && styles.filterOptionTextActive]}>
                                {option.label}
                              </Text>
                            </Pressable>
                          )
                        })}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Type d’annonce</Text>
                    <View style={styles.filterGrid}>
                      {AD_TYPE_OPTIONS.map(option => {
                        const selected = draftFilters.adType === option.value
                        return (
                          <Pressable
                            key={option.label}
                            style={[styles.filterOption, selected && styles.filterOptionActive]}
                            onPress={() => setDraftFilters(current => ({ ...current, adType: option.value }))}
                          >
                            <Text style={[styles.filterOptionText, selected && styles.filterOptionTextActive]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Vendeur</Text>
                    <View style={styles.filterGrid}>
                      {SELLER_TYPE_OPTIONS.map(option => {
                        const selected = draftFilters.sellerType === option.value
                        return (
                          <Pressable
                            key={option.label}
                            style={[styles.filterOption, selected && styles.filterOptionActive]}
                            onPress={() => setDraftFilters(current => ({ ...current, sellerType: option.value }))}
                          >
                            <Text style={[styles.filterOptionText, selected && styles.filterOptionTextActive]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <View style={styles.switchRow}>
                      <View style={styles.switchContent}>
                        <Text style={styles.modalSectionTitle}>Titre uniquement</Text>
                        <Text style={styles.switchHint}>Recherche stricte dans le titre</Text>
                      </View>
                      <Switch
                        value={draftFilters.titleOnly}
                        onValueChange={value => setDraftFilters(current => ({ ...current, titleOnly: value }))}
                        trackColor={{ false: colors.surfaceMuted, true: colors.primarySoftStrong }}
                        thumbColor={draftFilters.titleOnly ? colors.primary : colors.white}
                      />
                    </View>
                  </View>
                </>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.secondaryButton} onPress={resetFilters}>
                <Text style={styles.secondaryButtonText}>Réinitialiser</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={applyFilters}>
                <Text style={styles.primaryButtonText}>Appliquer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchBarShell: {
    flex: 1,
    minHeight: 60,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
    paddingVertical: 0
  },
  searchCameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  querySuggestionsCard: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.soft
  },
  querySuggestionsLoading: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  querySuggestionsLoadingText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  querySuggestionsErrorText: {
    color: colors.danger,
    fontSize: typography.caption,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  querySuggestionsEmptyText: {
    color: colors.muted,
    fontSize: typography.caption,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  querySuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  querySuggestionItemPressed: {
    backgroundColor: colors.surfaceAlt
  },
  querySuggestionIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  querySuggestionContent: {
    flex: 1
  },
  querySuggestionLabel: {
    color: colors.text,
    fontWeight: typography.weightSemibold,
    fontSize: typography.bodySm
  },
  querySuggestionMeta: {
    color: colors.muted,
    marginTop: 1,
    fontSize: typography.caption
  },
  searchSyntaxRow: {
    marginTop: spacing.sm,
    gap: spacing.xs
  },
  searchSyntaxHint: {
    color: colors.muted,
    fontSize: typography.caption
  },
  searchSyntaxChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  searchSyntaxChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface
  },
  searchSyntaxChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  loadingRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  loadingText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  locationErrorCard: {
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerSoftStrong,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  locationErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 18
  },
  suggestionsCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.soft
  },
  suggestionItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  suggestionItemPressed: {
    backgroundColor: colors.surfaceAlt
  },
  suggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  suggestionContent: {
    flex: 1
  },
  suggestionText: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  suggestionMeta: {
    color: colors.muted,
    marginTop: 1,
    fontSize: typography.caption
  },
  locationSuggestionsLoading: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  topChipsWrap: {
    marginTop: spacing.lg
  },
  topChipsContent: {
    gap: spacing.sm,
    paddingRight: spacing.xl
  },
  topChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md
  },
  topChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  topChipText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold,
    maxWidth: 180
  },
  topChipTextActive: {
    color: colors.primary
  },
  recentSearchesSection: {
    marginTop: spacing.lg,
    gap: spacing.sm
  },
  recentSearchesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  recentSearchesTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  recentSearchesClearText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  recentSearchesList: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.soft
  },
  recentSearchRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  recentSearchIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  recentSearchContent: {
    flex: 1,
    gap: 2
  },
  recentSearchLabel: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  recentSearchSubtitle: {
    color: colors.muted,
    fontSize: typography.caption
  },
  radiusInline: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  radiusPill: {
    minHeight: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  radiusPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  radiusPillText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  radiusPillTextActive: {
    color: colors.primary
  },
  resultsHeading: {
    marginTop: spacing.xl,
    marginBottom: spacing.md
  },
  resultsCount: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: typography.weightExtrabold
  },
  resultsSubline: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.caption
  },
  didYouMeanRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  didYouMeanText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  didYouMeanLink: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: typography.weightBold,
    textDecorationLine: 'underline'
  },
  resultItemWrap: {
    marginBottom: spacing.lg
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden'
  },
  resultCardPressed: {
    opacity: 0.94
  },
  resultMedia: {
    height: 280,
    backgroundColor: colors.surfaceMuted,
    position: 'relative'
  },
  resultImage: {
    width: '100%',
    height: '100%'
  },
  resultTopBadges: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  featuredBadge: {
    maxWidth: '70%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  featuredBadgeText: {
    color: colors.white,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  resultFavoriteFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.elevated
  },
  resultBody: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  resultPrice: {
    color: colors.primary,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold
  },
  resultTitle: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  resultMetaLocation: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: typography.bodySm,
    lineHeight: 20
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    paddingTop: spacing.xl
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm
  },
  emptyDidYouMeanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  emptyDidYouMeanText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  emptyDidYouMeanLink: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: typography.weightBold,
    textDecorationLine: 'underline'
  },
  emptyActionsRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm
  },
  emptyActionButton: {
    minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyActionButtonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  emptySuggestions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs
  },
  emptySuggestionsTitle: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  emptySuggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs
  },
  emptySuggestionChip: {
    minHeight: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentSoftStrong,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptySuggestionChipText: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  retryButton: {
    marginTop: spacing.md,
    alignSelf: 'center',
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  retryButtonText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  paginationLoader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  paginationLoaderText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  locationPickerScreen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg
  },
  locationPickerMain: {
    flex: 1
  },
  locationPickerScroll: {
    flex: 1
  },
  locationPickerScrollContent: {
    flexGrow: 1
  },
  locationPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md
  },
  locationPickerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightBold
  },
  locationPickerSearchBar: {
    marginTop: spacing.lg,
    minHeight: 58,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  locationPickerInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
    paddingVertical: 0
  },
  locationSuggestionsInline: {
    marginTop: spacing.sm
  },
  inlineSuggestionsScroll: {
    maxHeight: 232
  },
  inlineSuggestionsContent: {
    paddingBottom: spacing.xs
  },
  locationPickerAllCountry: {
    marginTop: spacing.md,
    minHeight: 62,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.soft
  },
  locationPickerAllCountryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  locationPickerAllCountryContent: {
    flex: 1,
    gap: 2
  },
  locationPickerAllCountryTitle: {
    color: colors.text,
    fontWeight: typography.weightSemibold,
    fontSize: typography.bodySm
  },
  locationPickerAllCountryMeta: {
    color: colors.muted,
    fontSize: typography.caption
  },
  locationPickerResults: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  locationPickerHintCard: {
    marginTop: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.soft
  },
  locationPickerHintTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold,
    textAlign: 'center'
  },
  locationPickerHintText: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center'
  },
  locationPickerEmpty: {
    color: colors.muted,
    textAlign: 'center',
    paddingTop: spacing.xl
  },
  locationSelectionChipsScroll: {
    marginTop: spacing.md
  },
  locationSelectionChipsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  locationSelectionChip: {
    maxWidth: '100%',
    minHeight: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSurface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  locationSelectionChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold,
    maxWidth: 260
  },
  radiusPickerSection: {
    marginTop: spacing.xl,
    gap: spacing.md
  },
  radiusPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  radiusPickerTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightSemibold
  },
  radiusPickerValue: {
    color: colors.accent,
    fontSize: typography.titleSm,
    fontWeight: typography.weightBold
  },
  radiusPickerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  radiusPickerChip: {
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radiusPickerChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  radiusPickerChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  radiusPickerChipTextActive: {
    color: colors.primary
  },
  multiLocationInfoCard: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  multiLocationInfoText: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18
  },
  mapPreviewCard: {
    marginTop: spacing.lg,
    height: 210,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    position: 'relative'
  },
  mapPreviewImage: {
    width: '100%',
    height: '100%'
  },
  mapPreviewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm
  },
  mapPreviewFallbackTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold,
    textAlign: 'center'
  },
  mapPreviewFallbackText: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center'
  },
  mapPreviewCenter: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -21,
    ...shadows.elevated
  },
  mapPreviewBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5
  },
  mapPreviewBadgeText: {
    color: colors.text,
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  mapPreviewLabel: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    maxWidth: '80%',
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightSemibold
  },
  locationSuggestionsTitle: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightBold,
    marginTop: spacing.sm
  },
  locationSuggestionRow: {
    minHeight: 64,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  locationSuggestionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  locationSuggestionText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightSemibold
  },
  locationPickerFooter: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    zIndex: 20
  },
  locationPickerClearButton: {
    minWidth: 120,
    minHeight: 58,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  locationPickerClearButtonText: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  locationPickerApplyButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  locationPickerApplyButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  floatingActions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  saveAction: {
    flex: 1,
    minHeight: 60,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.elevated
  },
  saveActionCollapsed: {
    flex: 0,
    width: 60,
    paddingHorizontal: 0
  },
  saveActionText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayStrong,
    justifyContent: 'flex-end'
  },
  modalBackdrop: {
    flex: 1
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md
  },
  modalIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  modalIconPlaceholder: {
    width: 40,
    height: 40
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: typography.title,
    fontWeight: typography.weightExtrabold
  },
  modalContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md
  },
  modalSection: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm
  },
  modalSectionTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  categoryRow: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  categoryRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  categoryRowContent: {
    flex: 1,
    gap: 2
  },
  categoryRowTitle: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  categoryRowDescription: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 16
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  filterOption: {
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  filterOptionText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  filterOptionTextActive: {
    color: colors.primary
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  switchContent: {
    flex: 1,
    gap: 2
  },
  switchHint: {
    color: colors.muted,
    fontSize: typography.caption
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold
  }
})
