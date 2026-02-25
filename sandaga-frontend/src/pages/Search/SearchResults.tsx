import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import type { SortOption } from '../../components/ui/SortSelect'
import type { Category } from '../../types/category'
import { useUserPreferences } from '../../hooks/useUserPreferences'
import { apiGet, apiPost } from '../../utils/api'
import type { Listing } from '../../types/listing'
import type { Paginated } from '../../types/pagination'
import {
  PRICE_BANDS,
  getPriceBandLabel,
  resolvePriceBand
} from '../../constants/filters'
import { useToast } from '../../components/ui/Toast'
import { useCategories } from '../../hooks/useCategories'
import { useI18n } from '../../contexts/I18nContext'
import { useListingFormSchema } from '../../hooks/useListingFormSchema'
import type { FormSchemaDTO } from '../../hooks/useListingFormSchema'
import { ROOT_LISTING_FIELDS } from '../../constants/listingForm'
import { formatListingLocation } from '../../utils/location'
import { useFollowedSellers } from '../../hooks/useFollowedSellers'
import { useAuth } from '../../hooks/useAuth'
import type { LocationSuggestion, SearchDrawerView, SearchViewMode } from './types'
import { SearchResultsHeader } from './components/SearchResultsHeader'
import { SearchFiltersDrawer } from './components/SearchFiltersDrawer'
import { SearchResultsList } from './components/SearchResultsList'

const DEFAULT_PAGE_SIZE = 20
const ATTRIBUTE_PARAM_PREFIX = 'attr_'

const MAPBOX_LOCATION_TYPES = 'neighborhood,locality,place,district,address,postcode'

const extractCityFromSuggestion = (suggestion: LocationSuggestion) => {
  const fromCity = suggestion.city?.trim()
  if (fromCity) {
    return fromCity
  }
  const fromLabel = suggestion.label.split(',')[0]?.trim()
  return fromLabel || suggestion.label.trim()
}

const parseAttributeFiltersFromParams = (params: URLSearchParams) => {
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

const normalizeAttributeFilters = (filters: Record<string, unknown>) => {
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

export default function SearchResults(){
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()
  const { locale, t } = useI18n()
  const { isAuthenticated } = useAuth()
  const { isFollowing, followSeller, unfollowSeller } = useFollowedSellers()
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const numberFormatter = useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale])
  const sortLocale = locale === 'fr' ? 'fr' : 'en'
  const searchParamsString = searchParams.toString()
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN
  const VIEW_MODE_KEY = 'lemaket.searchView'
  const [viewMode, setViewMode] = useState<SearchViewMode>(() => {
    if (typeof window === 'undefined') {
      return 'list'
    }
    try {
      const stored = window.localStorage.getItem(VIEW_MODE_KEY)
      return stored === 'grid' ? 'grid' : 'list'
    } catch {
      return 'list'
    }
  })
  const { preferences, setPreference, resetPreferences } = useUserPreferences({
    limit: DEFAULT_PAGE_SIZE,
    page: 1
  })
  const query = useMemo(
    () => Object.fromEntries(new URLSearchParams(searchParamsString)),
    [searchParamsString]
  )
  const term = query.q || ''
  const city = query.l || ''
  const sortParam = query.sort
  const sort: SortOption =
    sortParam === 'priceAsc' || sortParam === 'priceDesc'
      ? sortParam
      : preferences.sort
  const adTypeParam = typeof query.adType === 'string' ? query.adType : ''
  const sellerType = query.sellerType || preferences.sellerType
  const minPriceQuery = query.minPrice
  const maxPriceQuery = query.maxPrice
  const radiusQuery = query.radius
  const hasLocationSelection = Boolean(searchParams.get('lat')) && Boolean(searchParams.get('lng'))
  const attributeFiltersFromUrl = useMemo(
    () => parseAttributeFiltersFromParams(searchParams),
    [searchParamsString]
  )

  const [results, setResults] = useState<Paginated<Listing> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingAlert, setIsCreatingAlert] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [drawerView, setDrawerView] = useState<SearchDrawerView>('main')
  const [activeCriteriaField, setActiveCriteriaField] = useState<
    FormSchemaDTO['steps'][number]['fields'][number] | null
  >(null)
  const [criteriaSearch, setCriteriaSearch] = useState('')
  const [selectedRootCategory, setSelectedRootCategory] = useState('')
  const [selectedSubCategory, setSelectedSubCategory] = useState('')
  const [attributeFilters, setAttributeFilters] = useState<Record<string, unknown>>({})
  const [locationQuery, setLocationQuery] = useState(city)
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const locationWrapperRef = useRef<HTMLDivElement>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)
  const locationAbortRef = useRef<AbortController | null>(null)
  const locationDebounceRef = useRef<number | null>(null)
  const mapboxTokenLoggedRef = useRef(false)

  const handleViewModeChange = (next: SearchViewMode) => {
    setViewMode(next)
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, next)
    } catch {
      // ignore storage errors
    }
  }
  const { categories, isLoading: categoriesLoading, error: categoryError } = useCategories({ activeOnly: false })
  const categoryErrorMessage = categoryError ? t('search.categories.error') : null
  const priceBandFromQuery = useMemo(() => {
    if (!minPriceQuery && !maxPriceQuery) {
      return null
    }
    const min = minPriceQuery ? Number(minPriceQuery) : undefined
    const max = maxPriceQuery ? Number(maxPriceQuery) : undefined
    const match = PRICE_BANDS.find(band => {
      const minMatches =
        typeof band.min === 'number'
          ? min === band.min
          : min === undefined || min === 0
      const maxMatches =
        typeof band.max === 'number'
          ? max === band.max
          : max === undefined || max === 0
      return minMatches && maxMatches
    })
    return match?.id ?? null
  }, [minPriceQuery, maxPriceQuery])

  const parsedAttributeFilters = attributeFiltersFromUrl

  useEffect(() => {
    if (priceBandFromQuery && priceBandFromQuery !== preferences.priceBand) {
      setPreference('priceBand', priceBandFromQuery)
    } else if (!minPriceQuery && !maxPriceQuery && preferences.priceBand !== 'all') {
      setPreference('priceBand', 'all')
    }
  }, [
    priceBandFromQuery,
    preferences.priceBand,
    setPreference,
    minPriceQuery,
    maxPriceQuery
  ])

  useEffect(() => {
    if (radiusQuery && radiusQuery !== preferences.radius) {
      setPreference('radius', radiusQuery)
    } else if (!radiusQuery && preferences.radius !== '25') {
      setPreference('radius', '25')
    }
  }, [radiusQuery, preferences.radius, setPreference])

  useEffect(() => {
    setLocationQuery(city)
  }, [city])

  useEffect(() => {
    if (!import.meta.env.DEV || !mapboxToken || mapboxTokenLoggedRef.current) {
      return
    }
    const masked =
      mapboxToken.length > 12
        ? `${mapboxToken.slice(0, 6)}...${mapboxToken.slice(-4)}`
        : 'set'
    mapboxTokenLoggedRef.current = true
    console.info('Mapbox token loaded', masked)
  }, [mapboxToken])

  useEffect(() => {
    if (!locationOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) {
        setLocationOpen(false)
        return
      }
      if (locationWrapperRef.current?.contains(target)) {
        return
      }
      setLocationOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLocationOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [locationOpen])

  useEffect(() => {
    if (!locationOpen) {
      return
    }

    if (locationDebounceRef.current) {
      window.clearTimeout(locationDebounceRef.current)
    }
    if (locationAbortRef.current) {
      locationAbortRef.current.abort()
    }

    const queryValue = locationQuery.trim()
    if (!queryValue || queryValue.length < 3) {
      setLocationSuggestions([])
      setLocationLoading(false)
      setLocationError(null)
      return
    }

    if (!mapboxToken) {
      setLocationSuggestions([])
      setLocationLoading(false)
      setLocationError(t('search.location.missingToken'))
      return
    }

    setLocationLoading(true)
    setLocationError(null)

    locationDebounceRef.current = window.setTimeout(async () => {
      try {
        const controller = new AbortController()
        locationAbortRef.current = controller
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            queryValue
          )}.json?access_token=${mapboxToken}&autocomplete=true&limit=6&country=cm&types=${MAPBOX_LOCATION_TYPES}&language=${locale}`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          throw new Error(t('search.location.error', { status: response.status }))
        }
        const data = await response.json()
        const items: LocationSuggestion[] = (data.features ?? []).map((feature: any) => ({
          id: feature.id,
          label: feature.place_name,
          context:
            feature.context
              ?.map((ctx: any) => ctx.text)
              .filter(Boolean)
              .join(' · ') ?? null,
          coordinates: feature.center,
          city: (() => {
            const placeFromContext =
              feature.context?.find(
                (ctx: any) =>
                  typeof ctx.id === 'string' &&
                  (ctx.id.startsWith('place') || ctx.id.startsWith('locality'))
              )?.text ?? undefined
            if (placeFromContext) {
              return placeFromContext
            }
            const featureText =
              typeof feature.text === 'string' && feature.text.trim()
                ? feature.text.trim()
                : undefined
            const placeTypes = Array.isArray(feature.place_type)
              ? feature.place_type.map((entry: unknown) => String(entry))
              : []
            if (featureText && (placeTypes.includes('place') || placeTypes.includes('locality'))) {
              return featureText
            }
            return undefined
          })(),
          zipcode:
            feature.context?.find((ctx: any) => typeof ctx.id === 'string' && ctx.id.startsWith('postcode'))
              ?.text ?? undefined
        }))
        setLocationSuggestions(items)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setLocationError(t('search.location.loadError'))
        }
      } finally {
        setLocationLoading(false)
      }
    }, 350)

    return () => {
      if (locationDebounceRef.current) {
        window.clearTimeout(locationDebounceRef.current)
      }
      if (locationAbortRef.current) {
        locationAbortRef.current.abort()
      }
    }
  }, [locationOpen, locationQuery, locale, t])

  const apiQueryString = useMemo(() => {
    const rawParams = new URLSearchParams(searchParamsString)
    const params = new URLSearchParams()

    const mapping: Record<string, string> = {
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
      radius: 'radiusKm'
    }

    rawParams.forEach((value, key) => {
      if (!value) {
        return
      }
      if (key.startsWith(ATTRIBUTE_PARAM_PREFIX) || key === 'attributes') {
        return
      }
      const mappedKey = mapping[key] ?? key
      params.set(mappedKey, value)
    })

    const hasLatLng = rawParams.has('lat') && rawParams.has('lng')

    if (!params.has('page') && preferences.page > 1) {
      params.set('page', String(preferences.page))
    }

    if (!params.has('limit')) {
      params.set('limit', String(preferences.limit ?? DEFAULT_PAGE_SIZE))
    }

    if (hasLatLng && !params.has('radiusKm')) {
      params.set('radiusKm', preferences.radius || '25')
    }

    const priceBand = resolvePriceBand(preferences.priceBand)
    if (priceBand?.min !== undefined) {
      params.set('minPrice', String(priceBand.min))
    }
    if (priceBand?.max !== undefined) {
      params.set('maxPrice', String(priceBand.max))
    }
    if (
      preferences.radius &&
      preferences.radius !== '25' &&
      !params.has('radiusKm')
    ) {
      params.set('radiusKm', preferences.radius)
    }

    const normalizedAttributes = normalizeAttributeFilters(attributeFilters)
    if (Object.keys(normalizedAttributes).length) {
      params.set('attributes', JSON.stringify(normalizedAttributes))
    }

    return params.toString()
  }, [searchParamsString, preferences.page, preferences.limit, preferences.priceBand, preferences.radius, attributeFilters])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    const path = apiQueryString ? `/listings?${apiQueryString}` : '/listings'

    apiGet<Paginated<Listing>>(path, { signal: controller.signal })
      .then(data => setResults(data))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        console.error('Unable to fetch listings', err)
        setError(t('search.results.error'))
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [apiQueryString, t])

  useEffect(() => {
    setPreference('sort', sort)
  }, [sort])

  useEffect(() => {
    setPreference('sellerType', sellerType)
  }, [sellerType])

  useEffect(() => {
    if (results) {
      if (Number.isFinite(results.page)) {
        setPreference('page', results.page)
      }
      if (Number.isFinite(results.limit)) {
        setPreference('limit', results.limit)
      }
    }
  }, [results?.page, results?.limit, setPreference])

  useEffect(() => {
    if (!filtersOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFiltersOpen(false)
      }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [filtersOpen])

  useEffect(() => {
    if (filtersOpen) {
      setDrawerView('main')
    }
  }, [filtersOpen])

  const listings = results?.data ?? []
  const total = results?.total ?? 0
  const page = results?.page ?? 1
  const limit = results?.limit ?? preferences.limit ?? DEFAULT_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)))
  const formattedTotal = numberFormatter.format(total)
  const totalLabel =
    total === 1
      ? t('search.header.countSingle', { count: formattedTotal })
      : t('search.header.countMultiple', { count: formattedTotal })
  const headerCountLabel = isLoading ? t('search.header.loading') : totalLabel
  const applyFiltersLabel = isLoading
    ? t('search.filters.applyLoading')
    : t('search.filters.apply', { count: formattedTotal })

  const handlePageChange = (nextPage: number) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages)
    if (boundedPage === page) {
      return
    }
    const params = new URLSearchParams(searchParamsString)
    if (boundedPage > 1) {
      params.set('page', String(boundedPage))
    } else {
      params.delete('page')
    }
    setPreference('page', boundedPage)
    setSearchParams(params)
  }

  const rootCategories = useMemo(() => {
    if (!categories.length) {
      return []
    }
    const roots = categories.filter(category => !category.parentId)
    return roots.length ? roots : categories
  }, [categories])

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>()
    categories.forEach(category => map.set(category.id, category))
    return map
  }, [categories])

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Map<string, { id: string; name: string; slug: string }>>()

    const addChild = (parentId: string, child: { id: string; name: string; slug: string }) => {
      if (!map.has(parentId)) {
        map.set(parentId, new Map())
      }
      map.get(parentId)!.set(child.id, child)
    }

    categories.forEach(category => {
      const parentId = category.parentId ?? null
      if (parentId) {
        addChild(parentId, { id: category.id, name: category.name, slug: category.slug })
      }

      const children = category.children ?? []
      children.forEach(child => {
        addChild(category.id, { id: child.id, name: child.name, slug: child.slug })
      })
    })

    const normalized = new Map<string, Array<{ id: string; name: string; slug: string }>>()
    map.forEach((childrenMap, parentId) => {
      const children = Array.from(childrenMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, sortLocale, { sensitivity: 'base' })
      )
      normalized.set(parentId, children)
    })

    return normalized
  }, [categories, sortLocale])

  const categoryBySlug = useMemo(() => {
    const map = new Map<string, { id: string; name: string; slug: string; parentId: string | null; parentSlug: string | null }>()
    categories.forEach(category => {
      const parentId = category.parentId ?? null
      const parentSlug = parentId ? categoriesById.get(parentId)?.slug ?? null : null
      map.set(category.slug, {
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId,
        parentSlug
      })
      const children = childrenByParent.get(category.id) ?? []
      children.forEach(child => {
        map.set(child.slug, {
          id: child.id,
          name: child.name,
          slug: child.slug,
          parentId: category.id,
          parentSlug: category.slug
        })
      })
    })
    return map
  }, [categories, categoriesById, childrenByParent])

  const activeCategorySlug = selectedSubCategory || selectedRootCategory
  const activeCategory = activeCategorySlug ? categoryBySlug.get(activeCategorySlug) : null
  const activeCategoryFull = activeCategory ? categoriesById.get(activeCategory.id) ?? null : null
  const {
    schema: categorySchema,
    isLoading: schemaLoading,
    error: schemaError
  } = useListingFormSchema(activeCategory?.id ?? null)

  const isAdParamsStep = (step: FormSchemaDTO['steps'][number]) => {
    const name = String(step.name ?? '').toLowerCase()
    const label = String(step.label ?? '').toLowerCase()
    return name === 'ad_params' || label === 'ad_params'
  }

  const isPriceStep = (step: FormSchemaDTO['steps'][number]) => {
    const name = String(step.name ?? '').toLowerCase()
    const label = String(step.label ?? '').toLowerCase()
    if (name === 'price' || name === 'prix') {
      return true
    }
    return label.includes('prix') || label.includes('price')
  }

  const hasPriceStep = useMemo(() => {
    if (!categorySchema?.steps?.length) {
      return false
    }
    return categorySchema.steps.some(isPriceStep)
  }, [categorySchema])

  const shouldShowPriceFilter = !activeCategory || hasPriceStep

  const dynamicFilterGroups = useMemo(() => {
    if (!categorySchema?.steps?.length) {
      return []
    }
    return categorySchema.steps
      .filter(isAdParamsStep)
      .map(step => {
        const fields = (step.fields ?? []).filter(field => {
          if (!field?.name) {
            return false
          }
          if (ROOT_LISTING_FIELDS.has(field.name)) {
            return false
          }
          if (field.type === 'map') {
            return false
          }
          return true
        })
        return {
          id: step.id,
          label: step.label || step.name || step.id,
          fields
        }
      })
      .filter(group => group.fields.length > 0)
  }, [categorySchema])

  const dynamicFilterNames = useMemo(() => {
    const names = new Set<string>()
    dynamicFilterGroups.forEach(group => {
      group.fields.forEach(field => names.add(field.name))
    })
    return names
  }, [dynamicFilterGroups])
  const criteriaFields = useMemo(
    () => dynamicFilterGroups.flatMap(group => group.fields),
    [dynamicFilterGroups]
  )

  useEffect(() => {
    if (!activeCriteriaField) {
      return
    }
    const stillAvailable = criteriaFields.some(field => field.name === activeCriteriaField.name)
    if (!stillAvailable) {
      setActiveCriteriaField(null)
      if (drawerView === 'criteriaOptions') {
        setDrawerView('criteriaList')
      }
    }
  }, [activeCriteriaField, criteriaFields, drawerView])

  useEffect(() => {
    setCriteriaSearch('')
  }, [activeCriteriaField])

  const subCategoryOptions = useMemo(() => {
    if (!selectedRootCategory) {
      return []
    }
    const rootEntry = categoryBySlug.get(selectedRootCategory)
    if (!rootEntry) {
      return []
    }
    const children = childrenByParent.get(rootEntry.id) ?? []
    if (!children.length) {
      return []
    }
    const options = children
      .map(child => ({ value: child.slug, label: child.name }))
      .sort((a, b) => a.label.localeCompare(b.label, sortLocale, { sensitivity: 'base' }))
    options.unshift({ value: selectedRootCategory, label: t('filters.category.allSub') })
    return options
  }, [selectedRootCategory, categoryBySlug, childrenByParent, sortLocale, t])

  const selectedRootLabel = selectedRootCategory
    ? categoryBySlug.get(selectedRootCategory)?.name ?? t('filters.category.all')
    : t('filters.category.all')
  const isAllSubSelected =
    !!selectedRootCategory &&
    selectedSubCategory === selectedRootCategory &&
    subCategoryOptions.length > 0
  const selectedSubLabel = isAllSubSelected
    ? t('filters.category.allSub')
    : selectedSubCategory
    ? categoryBySlug.get(selectedSubCategory)?.name ?? t('filters.category.allSub')
    : t('filters.category.allSub')
  const selectedCriteriaCount = Object.keys(normalizeAttributeFilters(attributeFilters)).length
  const criteriaSummary = selectedCriteriaCount
    ? t('search.filters.selectedCount', { count: selectedCriteriaCount })
    : t('filters.dynamic.all')

  const selectedCategoryAdTypes = useMemo(() => {
    if (!activeCategoryFull) {
      return []
    }
    const parseMaybeJson = (value: unknown) => {
      if (typeof value !== 'string') return value
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }

    const extractAdTypes = (category: Category | null) => {
      if (!category) return null
      const directAdTypes =
        (category as unknown as { ad_types?: any })?.ad_types ??
        (category as unknown as { adTypes?: any })?.adTypes ??
        null
      const maybeObj =
        directAdTypes ??
        (category as unknown as { extraFieldsRaw?: any })?.extraFieldsRaw ??
        (!Array.isArray((category as unknown as { extraFields?: any })?.extraFields)
          ? (category as unknown as { extraFields?: any })?.extraFields
          : null) ??
        (category as unknown as { extra_fields?: any })?.extra_fields

      const parsedMaybe = parseMaybeJson(maybeObj)
      let adTypes =
        (parsedMaybe && typeof parsedMaybe === 'object' && !Array.isArray(parsedMaybe)
          ? (parsedMaybe as { ad_types?: any; adTypes?: any }).ad_types ??
            (parsedMaybe as { ad_types?: any; adTypes?: any }).adTypes
          : null) ?? null

      if (!adTypes && Array.isArray((category as any)?.extraFields)) {
        for (const entry of (category as any).extraFields as any[]) {
          if (!entry) continue
          const parsedEntry = parseMaybeJson(entry)
          if (parsedEntry && typeof parsedEntry === 'object' && 'ad_types' in parsedEntry) {
            adTypes = (parsedEntry as any).ad_types
            break
          }
        }
      }

      const parsedAdTypes = parseMaybeJson(adTypes)
      return parsedAdTypes && typeof parsedAdTypes === 'object' && !Array.isArray(parsedAdTypes)
        ? (parsedAdTypes as Record<string, { label?: string; description?: string }>)
        : null
    }

    let adTypes =
      (categorySchema?.adTypes as Record<string, { label?: string; description?: string }> | undefined) ??
      null
    if (!adTypes) {
      adTypes = extractAdTypes(activeCategoryFull)
    }
    if (!adTypes && activeCategoryFull.parentId) {
      const parentCategory = categoriesById.get(activeCategoryFull.parentId) ?? null
      adTypes = extractAdTypes(parentCategory)
    }

    if (!adTypes) {
      return []
    }

    return Object.entries(adTypes)
      .filter(([, value]) => value && typeof value === 'object')
      .map(([key, value]) => ({
        value: key,
        label:
          typeof (value as any).label === 'string'
            ? (value as any).label
            : key
      }))
  }, [activeCategoryFull, categoriesById, categorySchema?.adTypes, t])

  const shouldShowAdType = selectedCategoryAdTypes.length > 0

  useEffect(() => {
    const slug = typeof query.category === 'string' ? query.category : ''
    if (!slug) {
      if (selectedRootCategory) {
        setSelectedRootCategory('')
      }
      if (selectedSubCategory) {
        setSelectedSubCategory('')
      }
      return
    }
    const entry = categoryBySlug.get(slug)
    if (!entry) {
      return
    }
    const nextRoot = entry.parentSlug ?? entry.slug
    const nextSub = entry.parentSlug ? entry.slug : entry.slug
    if (selectedRootCategory !== nextRoot) {
      setSelectedRootCategory(nextRoot)
    }
    if (selectedSubCategory !== nextSub) {
      setSelectedSubCategory(nextSub)
    }
  }, [query.category, categoryBySlug, selectedRootCategory, selectedSubCategory])

  useEffect(() => {
    if (!adTypeParam || !activeCategory || selectedCategoryAdTypes.length === 0) {
      return
    }
    const isValid = selectedCategoryAdTypes.some(option => option.value === adTypeParam)
    if (!isValid) {
      updateSearchParam('adType', null)
    }
  }, [adTypeParam, selectedCategoryAdTypes])

  useEffect(() => {
    const normalizedFromUrl = normalizeAttributeFilters(parsedAttributeFilters)
    if (!dynamicFilterNames.size) {
      const normalizedState = normalizeAttributeFilters(attributeFilters)
      if (JSON.stringify(normalizedState) !== JSON.stringify(normalizedFromUrl)) {
        setAttributeFilters(normalizedFromUrl)
      }
      return
    }
    const next: Record<string, unknown> = {}
    Object.entries(parsedAttributeFilters).forEach(([key, value]) => {
      if (dynamicFilterNames.has(key)) {
        next[key] = value
      }
    })
    const normalized = normalizeAttributeFilters(next)
    const normalizedSignature = JSON.stringify(normalized)
    const urlSignature = JSON.stringify(normalizeAttributeFilters(parsedAttributeFilters))
    if (normalizedSignature !== urlSignature) {
      updateAttributeSearchParams(normalized)
    }
    const currentKeys = Object.keys(attributeFilters)
    const nextKeys = Object.keys(next)
    const isSame =
      currentKeys.length === nextKeys.length &&
      currentKeys.every(key => attributeFilters[key] === next[key])
    if (!isSame) {
      setAttributeFilters(normalized)
    }
  }, [parsedAttributeFilters, dynamicFilterNames, attributeFilters])

  const handleParentCategorySelect = (slug: string) => {
    if (!slug) {
      setSelectedRootCategory('')
      setSelectedSubCategory('')
      updateSearchParam('category', null)
      setDrawerView('main')
      return
    }
    setSelectedRootCategory(slug)
    setSelectedSubCategory(slug)
    updateSearchParam('category', slug)
    const parentEntry = categoryBySlug.get(slug)
    const children = parentEntry ? childrenByParent.get(parentEntry.id) ?? [] : []
    if (children.length) {
      setDrawerView('categoryChildren')
    } else {
      setDrawerView('main')
    }
  }

  const handleChildCategorySelect = (slug: string) => {
    if (!slug || slug === selectedRootCategory) {
      updateSearchParam('category', selectedRootCategory || null)
      setSelectedSubCategory(selectedRootCategory)
      setDrawerView('main')
      return
    }
    setSelectedSubCategory(slug)
    updateSearchParam('category', slug)
    setDrawerView('main')
  }

  const formatPrice = (listing: Listing) => {
    const numericPrice = Number(listing.price)
    if (Number.isFinite(numericPrice)) {
      try {
        return new Intl.NumberFormat(numberLocale, {
          style: 'currency',
          currency: listing.currency || 'XAF'
        }).format(numericPrice)
      } catch {
        // ignore and fallback below
      }
    }
    return [listing.price, listing.currency]
      .filter(Boolean)
      .join(' ')
  }

  const getSellerType = (listing: Listing) => {
    if (listing.owner?.isPro) {
      return t('filters.sellerType.pro')
    }
    return t('filters.sellerType.individual')
  }

  const getSortLabel = (value: SortOption) => {
    if (value === 'priceAsc') {
      return t('sort.priceAsc')
    }
    if (value === 'priceDesc') {
      return t('sort.priceDesc')
    }
    return t('sort.recent')
  }

  const getListingLocation = (listing: Listing) => {
    return formatListingLocation(
      listing.location as any,
      listing.city || t('listing.locationUnavailable')
    )
  }

  const getOwnerProfileUrl = (listing: Listing) => {
    if (!listing.owner?.id) return null
    if (listing.owner.isPro) {
      return listing.owner.storefrontSlug ? `/store/${listing.owner.storefrontSlug}` : null
    }
    if (listing.owner.storefrontSlug) {
      return `/u/${listing.owner.storefrontSlug}`
    }
    return `/u/${listing.owner.id}`
  }

  const getOwnerName = (listing: Listing) => {
    if (!listing.owner) return ''
    return `${listing.owner.firstName ?? ''} ${listing.owner.lastName ?? ''}`.trim()
  }

  const handleFollowSeller = async (sellerId: string, isCurrentlyFollowing: boolean) => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (isCurrentlyFollowing) {
      await unfollowSeller(sellerId)
    } else {
      await followSeller(sellerId)
    }
  }

  const formatListingDate = (value: string | null | undefined) => {
    if (!value) return null
    try {
      const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
      return new Date(value).toLocaleDateString(dateLocale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    } catch {
      return null
    }
  }

  const updateAttributeSearchParams = (nextFilters: Record<string, unknown>) => {
    const params = new URLSearchParams(searchParamsString)
    const normalized = normalizeAttributeFilters(nextFilters)
    const currentNormalized = normalizeAttributeFilters(parseAttributeFiltersFromParams(params))
    const nextSignature = JSON.stringify(normalized)
    const currentSignature = JSON.stringify(currentNormalized)
    if (nextSignature === currentSignature) {
      return
    }
    const keys = Array.from(new Set(params.keys()))
    keys.forEach(key => {
      if (key.startsWith(ATTRIBUTE_PARAM_PREFIX)) {
        params.delete(key)
      }
    })
    params.delete('attributes')
    Object.entries(normalized).forEach(([key, value]) => {
      const paramKey = `${ATTRIBUTE_PARAM_PREFIX}${key}`
      if (Array.isArray(value)) {
        value.forEach(entry => params.append(paramKey, String(entry)))
        return
      }
      params.set(paramKey, String(value))
    })
    params.delete('page')
    setPreference('page', 1)
    setSearchParams(params)
  }

  const handleAttributeFilterChange = (fieldName: string, value: unknown) => {
    setAttributeFilters(prev => {
      const next = { ...prev }
      if (value === null || value === undefined) {
        delete next[fieldName]
      } else if (typeof value === 'string' && value.trim() === '') {
        delete next[fieldName]
      } else if (Array.isArray(value) && value.length === 0) {
        delete next[fieldName]
      } else {
        next[fieldName] = value
      }
      updateAttributeSearchParams(next)
      return next
    })
  }

  const updateSearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParamsString)
    if (value && value !== 'recent' && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    setPreference('page', 1)
    setSearchParams(params)
  }

  const handleLocationClear = () => {
    const params = new URLSearchParams(searchParamsString)
    params.delete('l')
    params.delete('lat')
    params.delete('lng')
    params.delete('page')
    setPreference('page', 1)
    setSearchParams(params)
    setLocationQuery('')
    setLocationSuggestions([])
    setLocationOpen(false)
    setLocationError(null)
  }

  const commitManualLocation = () => {
    const nextValue = locationQuery.trim()
    const params = new URLSearchParams(searchParamsString)
    const currentLocation = (params.get('l') ?? '').trim()
    const normalizedNext = nextValue.toLocaleLowerCase()
    const normalizedCurrent = currentLocation.toLocaleLowerCase()

    if (normalizedNext === normalizedCurrent) {
      setLocationOpen(false)
      return
    }

    if (nextValue) {
      params.set('l', nextValue)
    } else {
      params.delete('l')
    }
    params.delete('lat')
    params.delete('lng')
    params.delete('page')
    setPreference('page', 1)
    setSearchParams(params)
    setLocationOpen(false)
    setLocationError(null)
  }

  const handleLocationSelect = (suggestion: LocationSuggestion) => {
    const params = new URLSearchParams(searchParamsString)
    const cityValue = extractCityFromSuggestion(suggestion)
    if (cityValue) {
      params.set('l', cityValue)
    } else {
      params.delete('l')
    }
    params.set('lat', String(suggestion.coordinates[1]))
    params.set('lng', String(suggestion.coordinates[0]))
    params.delete('page')
    setPreference('page', 1)
    setSearchParams(params)
    setLocationQuery(cityValue || '')
    setLocationSuggestions([])
    setLocationOpen(false)
    setLocationError(null)
  }

  const handleSortChange = (value: SortOption) => {
    updateSearchParam('sort', value === 'recent' ? null : value)
    setPreference('sort', value)
  }

  const handleSellerTypeChange = (value: string | number) => {
    const next = String(value)
    updateSearchParam('sellerType', next === 'all' ? null : next)
    setPreference('sellerType', next)
  }

  const handlePriceBandChange = (next: string) => {
    const params = new URLSearchParams(searchParamsString)
    const band = resolvePriceBand(next)
    if (band?.min !== undefined) {
      params.set('minPrice', String(band.min))
    } else {
      params.delete('minPrice')
    }

    if (band?.max !== undefined) {
      params.set('maxPrice', String(band.max))
    } else {
      params.delete('maxPrice')
    }

    if (next === 'all') {
      params.delete('minPrice')
      params.delete('maxPrice')
    }

    params.delete('page')
    setPreference('priceBand', next)
    setPreference('page', 1)
    setSearchParams(params)
  }

  const handleRadiusChange = (value: string) => {
    const params = new URLSearchParams(searchParamsString)
    if (value === '25') {
      params.delete('radius')
    } else {
      params.set('radius', value)
    }
    params.delete('page')
    setPreference('radius', value)
    setPreference('page', 1)
    setSearchParams(params)
  }

  useEffect(() => {
    if (
      activeCategory &&
      !hasPriceStep &&
      (minPriceQuery || maxPriceQuery || preferences.priceBand !== 'all')
    ) {
      handlePriceBandChange('all')
    }
  }, [activeCategory, hasPriceStep, minPriceQuery, maxPriceQuery, preferences.priceBand, handlePriceBandChange])

  const handleCreateAlert = async () => {
    if (isCreatingAlert) {
      return
    }

    const categorySlug = typeof query.category === 'string' ? query.category.trim() : ''
    const hasCriteria =
      term.trim() ||
      city.trim() ||
      categorySlug ||
      (preferences.sellerType && preferences.sellerType !== 'all') ||
      (preferences.priceBand && preferences.priceBand !== 'all') ||
      (preferences.radius && preferences.radius !== '25')

    if (!hasCriteria) {
      addToast({
        variant: 'info',
        title: t('search.alert.missingTitle'),
        message: t('search.alert.missingMessage')
      })
      return
    }

    setIsCreatingAlert(true)
    const payload = {
      term: term.trim() || undefined,
      location: city.trim() || undefined,
      categorySlug: categorySlug || undefined,
      sellerType: preferences.sellerType,
      priceBand: preferences.priceBand,
      radius: preferences.radius
    }

    try {
      await apiPost('/alerts', payload)
      addToast({
        variant: 'success',
        title: t('search.alert.successTitle'),
        message: t('search.alert.successMessage')
      })
    } catch (err) {
      console.error('Unable to create saved search', err)
      const message = err instanceof Error ? err.message : t('search.alert.errorFallback')
      if (message.includes('401') || message.toLowerCase().includes('unauthorized')) {
        addToast({
          variant: 'info',
          title: t('search.alert.loginTitle'),
          message: t('search.alert.loginMessage')
        })
        navigate('/login')
      } else {
        addToast({
          variant: 'error',
          title: t('search.alert.errorTitle'),
          message
        })
      }
    } finally {
      setIsCreatingAlert(false)
    }
  }

  const resolveFieldOptions = (field: FormSchemaDTO['steps'][number]['fields'][number]) => {
    const groupedOptions =
      field.optionGroups?.flatMap(group => group.options ?? []) ?? []
    if (field.dependsOn && field.conditionalOptions) {
      const dependencyValue = attributeFilters[field.dependsOn]
      const dependencyKey = dependencyValue === undefined || dependencyValue === null ? null : String(dependencyValue)
      if (dependencyKey && field.conditionalOptions[dependencyKey]) {
        return field.conditionalOptions[dependencyKey]
      }
    }
    return groupedOptions.length ? groupedOptions : field.options ?? []
  }

  const sellerTypeSelections = {
    pro: sellerType === 'pro' || sellerType === 'all',
    individual: sellerType === 'individual' || sellerType === 'all'
  }

  const handleSellerTypeToggle = (nextKey: 'pro' | 'individual') => {
    const next = {
      pro: nextKey === 'pro' ? !sellerTypeSelections.pro : sellerTypeSelections.pro,
      individual:
        nextKey === 'individual' ? !sellerTypeSelections.individual : sellerTypeSelections.individual
    }
    if (next.pro && next.individual) {
      handleSellerTypeChange('all')
      return
    }
    if (next.pro) {
      handleSellerTypeChange('pro')
      return
    }
    if (next.individual) {
      handleSellerTypeChange('individual')
      return
    }
    handleSellerTypeChange('all')
  }

  const handleAdTypeChange = (value: string) => {
    updateSearchParam('adType', value || null)
  }

  const handleResetFilters = () => {
    const params = new URLSearchParams()
    if (query.q) {
      params.set('q', String(query.q))
    }
    if (query.l) {
      params.set('l', String(query.l))
    }
    resetPreferences()
    setSelectedRootCategory('')
    setSelectedSubCategory('')
    setAttributeFilters({})
    setActiveCriteriaField(null)
    setCriteriaSearch('')
    setSearchParams(params)
  }

  const closeFilters = () => {
    setFiltersOpen(false)
    setDrawerView('main')
  }

  const drawerTitle = (() => {
    if (drawerView === 'categoryParents') {
      return t('filters.category.label')
    }
    if (drawerView === 'categoryChildren') {
      return t('filters.subcategory.label')
    }
    if (drawerView === 'criteriaList') {
      return t('search.filters.categoryFieldsTitle')
    }
    if (drawerView === 'criteriaOptions') {
      return activeCriteriaField?.label ?? t('search.filters.categoryFieldsTitle')
    }
    return t('search.filters.title')
  })()

  const handleDrawerBack = () => {
    if (drawerView === 'categoryChildren') {
      setDrawerView('categoryParents')
      return
    }
    if (drawerView === 'criteriaOptions') {
      setDrawerView('criteriaList')
      return
    }
    setDrawerView('main')
  }

  const renderBlockTitle = (icon: JSX.Element, label: string) => (
    <div className="search-drawer__block-title">
      <span className="search-drawer__title-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </div>
  )

  const iconStroke = {
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  } as const
  const blockIcons = {
    category: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" {...iconStroke} />
      </svg>
    ),
    price: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 7h12v10H6z" fill="none" {...iconStroke} />
        <path d="M12 9v6M9 12h6" fill="none" {...iconStroke} />
      </svg>
    ),
    radius: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" fill="none" {...iconStroke} />
        <circle cx="12" cy="12" r="3" fill="none" {...iconStroke} />
      </svg>
    ),
    criteria: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" fill="none" {...iconStroke} />
        <circle cx="9" cy="6" r="1.5" fill="none" {...iconStroke} />
        <circle cx="15" cy="12" r="1.5" fill="none" {...iconStroke} />
        <circle cx="11" cy="18" r="1.5" fill="none" {...iconStroke} />
      </svg>
    ),
    sort: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 6v12M8 6l-2 2M8 6l2 2" fill="none" {...iconStroke} />
        <path d="M16 18V6M16 18l-2-2M16 18l2-2" fill="none" {...iconStroke} />
      </svg>
    ),
    adType: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5l8 4-8 4-8-4z" fill="none" {...iconStroke} />
        <path d="M4 13l8 4 8-4" fill="none" {...iconStroke} />
      </svg>
    ),
    sellerType: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3" fill="none" {...iconStroke} />
        <path d="M5 19c1.8-3 5-4 7-4s5.2 1 7 4" fill="none" {...iconStroke} />
      </svg>
    )
  }

  const renderDrawerMain = (
    <section className="search-drawer__section">
      <div className="search-drawer__block">
        {renderBlockTitle(blockIcons.category, t('filters.category.label'))}
        <button
          type="button"
          className="search-drawer__row"
          onClick={() => setDrawerView('categoryParents')}
        >
          <div>
            <span className="search-drawer__row-label">{t('filters.category.label')}</span>
            <strong>{selectedRootLabel}</strong>
          </div>
          <span className="search-drawer__row-chevron" aria-hidden="true">›</span>
        </button>
        {selectedRootCategory && subCategoryOptions.length > 0 ? (
          <button
            type="button"
            className="search-drawer__row"
            onClick={() => setDrawerView('categoryChildren')}
          >
            <div>
              <span className="search-drawer__row-label">{t('filters.subcategory.label')}</span>
              <strong>{selectedSubLabel}</strong>
            </div>
            <span className="search-drawer__row-chevron" aria-hidden="true">›</span>
          </button>
        ) : null}
        {categoriesLoading && categories.length === 0 && !categoryError ? (
          <p className="search-page__filter-hint">{t('search.categories.loading')}</p>
        ) : null}
        {categoryErrorMessage ? (
          <p role="alert" className="search-page__category-error">{categoryErrorMessage}</p>
        ) : null}
      </div>

      {shouldShowPriceFilter ? (
        <div className="search-drawer__block">
          {renderBlockTitle(blockIcons.price, t('filters.price.label'))}
          <div className="lbc-filter-chips" role="group" aria-label={t('filters.price.aria')}>
            {PRICE_BANDS.map(band => (
              <button
                key={band.id}
                type="button"
                className={`lbc-chip ${preferences.priceBand === band.id ? 'lbc-chip--active' : ''}`}
                onClick={() => handlePriceBandChange(band.id)}
              >
                {getPriceBandLabel(t, band.id)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="search-drawer__block">
        <div className="search-drawer__section-header">
          <h3 className="search-drawer__section-title">
            <span className="search-drawer__title-icon" aria-hidden="true">
              {blockIcons.criteria}
            </span>
            <span>{t('search.filters.categoryFieldsTitle')}</span>
          </h3>
          <p>{t('search.filters.categoryFieldsHint')}</p>
        </div>
        <button
          type="button"
          className="search-drawer__row"
          onClick={() => setDrawerView('criteriaList')}
        >
          <div>
            <span className="search-drawer__row-label">{t('search.filters.categoryFieldsTitle')}</span>
            <strong>{criteriaSummary}</strong>
          </div>
          <span className="search-drawer__row-chevron" aria-hidden="true">›</span>
        </button>
      </div>

      <div className="search-drawer__block">
        {renderBlockTitle(blockIcons.sort, t('filters.sort.label'))}
        <div className="search-drawer__choices">
          {(['recent', 'priceAsc', 'priceDesc'] as const).map(option => (
            <label key={option} className="search-drawer__choice">
              <input
                type="checkbox"
                checked={sort === option}
                onChange={event => handleSortChange(event.target.checked ? option : 'recent')}
              />
              <span>{getSortLabel(option)}</span>
            </label>
          ))}
        </div>
      </div>

      {shouldShowAdType ? (
        <div className="search-drawer__block">
          {renderBlockTitle(blockIcons.adType, t('listings.new.adType.title'))}
          <div className="search-drawer__choices">
            <label className="search-drawer__choice">
              <input
                type="radio"
                name="search-ad-type"
                checked={!adTypeParam}
                onChange={() => handleAdTypeChange('')}
              />
              <span>{t('filters.dynamic.all')}</span>
            </label>
            {selectedCategoryAdTypes.map(option => (
              <label key={option.value} className="search-drawer__choice">
                <input
                  type="radio"
                  name="search-ad-type"
                  checked={adTypeParam === option.value}
                  onChange={() => handleAdTypeChange(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="search-drawer__block">
        {renderBlockTitle(blockIcons.sellerType, t('filters.sellerType.label'))}
        <div className="search-drawer__choices">
          <label className="search-drawer__choice">
            <input
              type="checkbox"
              checked={sellerTypeSelections.individual}
              onChange={() => handleSellerTypeToggle('individual')}
            />
            <span>{t('filters.sellerType.individual')}</span>
          </label>
          <label className="search-drawer__choice">
            <input
              type="checkbox"
              checked={sellerTypeSelections.pro}
              onChange={() => handleSellerTypeToggle('pro')}
            />
            <span>{t('filters.sellerType.pro')}</span>
          </label>
        </div>
      </div>

      <div className="search-drawer__footer">
        <Button variant="outline" onClick={handleResetFilters}>
          {t('search.filters.reset')}
        </Button>
        <Button onClick={closeFilters}>
          {applyFiltersLabel}
        </Button>
      </div>
    </section>
  )

  const renderDrawerCategoryParents = (
    <section className="search-drawer__section">
      <div className="search-drawer__list">
        <button
          type="button"
          className="search-drawer__list-item"
          onClick={() => handleParentCategorySelect('')}
        >
          {t('filters.category.all')}
        </button>
        {rootCategories.map(category => (
          <button
            key={category.id}
            type="button"
            className="search-drawer__list-item"
            onClick={() => handleParentCategorySelect(category.slug)}
          >
            {category.name}
          </button>
        ))}
      </div>
    </section>
  )

  const renderDrawerCategoryChildren = (
    <section className="search-drawer__section">
      {selectedRootCategory && subCategoryOptions.length > 0 ? (
        <div className="search-drawer__list">
          <button
            type="button"
            className="search-drawer__list-item"
            onClick={() => handleChildCategorySelect(selectedRootCategory)}
          >
            {t('filters.category.allSub')}
          </button>
          {subCategoryOptions
            .filter(option => option.value !== selectedRootCategory)
            .map(option => (
              <button
                key={option.value}
                type="button"
                className="search-drawer__list-item"
                onClick={() => handleChildCategorySelect(String(option.value))}
              >
                {option.label}
              </button>
            ))}
        </div>
      ) : (
        <p className="search-page__filter-hint">{t('search.filters.categoryFieldsEmpty')}</p>
      )}
    </section>
  )

  const getFieldSummary = (
    field: FormSchemaDTO['steps'][number]['fields'][number],
    options: ReturnType<typeof resolveFieldOptions>
  ) => {
    const rawValue = attributeFilters[field.name]
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return t('filters.dynamic.all')
    }
    const allowMultiple = field.multiSelect || field.type === 'multiselect' || field.type === 'chips'
    const values = allowMultiple
      ? Array.isArray(rawValue)
        ? rawValue.map(String)
        : [String(rawValue)]
      : [String(rawValue)]
    const labels = values.map(value => options.find(option => option.value === value)?.label ?? value)
    return labels.join(', ')
  }

  const handleCriteriaFieldOpen = (
    field: FormSchemaDTO['steps'][number]['fields'][number]
  ) => {
    setActiveCriteriaField(field)
    setDrawerView('criteriaOptions')
  }

  const renderDrawerCriteriaList = (
    <section className="search-drawer__section">
      <div className="search-drawer__section-header">
        <h3>{t('search.filters.categoryFieldsTitle')}</h3>
        <p>{t('search.filters.categoryFieldsHint')}</p>
      </div>
      {schemaLoading ? (
        <p className="search-page__filter-hint">{t('search.filters.categoryFieldsLoading')}</p>
      ) : null}
      {schemaError ? (
        <p role="alert" className="search-page__category-error">{t('search.filters.categoryFieldsError')}</p>
      ) : null}
      {!schemaLoading && !schemaError && criteriaFields.length === 0 && activeCategory ? (
        <p className="search-page__filter-hint">{t('search.filters.categoryFieldsEmpty')}</p>
      ) : null}
      {criteriaFields.length > 0 ? (
        <div className="search-drawer__list">
          {criteriaFields.map(field => {
            const options = resolveFieldOptions(field)
            return (
              <button
                key={field.name}
                type="button"
                className="search-drawer__row"
                onClick={() => handleCriteriaFieldOpen(field)}
              >
                <div>
                  <span className="search-drawer__row-label">{field.label}</span>
                  <strong>{getFieldSummary(field, options)}</strong>
                </div>
                <span className="search-drawer__row-chevron" aria-hidden="true">›</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )

  const renderCriteriaOptions = () => {
    if (!activeCriteriaField) {
      return (
        <p className="search-page__filter-hint">{t('search.filters.categoryFieldsHint')}</p>
      )
    }
    const field = activeCriteriaField
    const options = resolveFieldOptions(field)
    const normalizedSearch = criteriaSearch.trim().toLowerCase()
    const filteredOptions =
      normalizedSearch.length > 0
        ? options.filter(option => option.label.toLowerCase().includes(normalizedSearch))
        : options
    const allowMultiple = field.multiSelect || field.type === 'multiselect' || field.type === 'chips'
    const rawValue = attributeFilters[field.name]
    const selectedValues = allowMultiple
      ? Array.isArray(rawValue)
        ? rawValue.map(String)
        : rawValue !== undefined && rawValue !== null && rawValue !== ''
        ? [String(rawValue)]
        : []
      : rawValue !== undefined && rawValue !== null && rawValue !== ''
      ? [String(rawValue)]
      : []

    if (options.length > 0) {
      return (
        <div className="search-drawer__choices">
          <div className="search-drawer__search">
            <Input
              type="text"
              value={criteriaSearch}
              placeholder={t('search.filters.criteriaSearchPlaceholder')}
              onChange={event => setCriteriaSearch(event.target.value)}
            />
          </div>
          {!allowMultiple ? (
            <label className="search-drawer__choice">
              <input
                type="radio"
                name={`criteria-${field.name}`}
                checked={selectedValues.length === 0}
                onChange={() => handleAttributeFilterChange(field.name, null)}
              />
              <span>{t('filters.dynamic.all')}</span>
            </label>
          ) : null}
          {filteredOptions.map(option => {
            const isChecked = selectedValues.includes(option.value)
            return (
              <label key={option.value} className="search-drawer__choice">
                <input
                  type={allowMultiple ? 'checkbox' : 'radio'}
                  name={`criteria-${field.name}`}
                  checked={isChecked}
                  onChange={() => {
                    if (allowMultiple) {
                      const nextValues = isChecked
                        ? selectedValues.filter(value => value !== option.value)
                        : [...selectedValues, option.value]
                      handleAttributeFilterChange(field.name, nextValues)
                    } else {
                      handleAttributeFilterChange(field.name, option.value)
                    }
                  }}
                />
                <span>{option.label}</span>
              </label>
            )
          })}
          {filteredOptions.length === 0 ? (
            <p className="search-page__filter-hint">{t('search.filters.criteriaSearchEmpty')}</p>
          ) : null}
        </div>
      )
    }

    if (field.type === 'checkbox' || field.type === 'switch') {
      const boolValue =
        rawValue === true || rawValue === 'true'
          ? 'true'
          : rawValue === false || rawValue === 'false'
          ? 'false'
          : ''
      return (
        <div className="search-drawer__choices">
          {['true', 'false'].map(value => (
            <label key={value} className="search-drawer__choice">
              <input
                type="radio"
                name={`criteria-${field.name}`}
                checked={boolValue === value}
                onChange={() =>
                  handleAttributeFilterChange(
                    field.name,
                    value === 'true' ? true : false
                  )
                }
              />
              <span>{value === 'true' ? t('filters.dynamic.yes') : t('filters.dynamic.no')}</span>
            </label>
          ))}
          <label className="search-drawer__choice">
            <input
              type="radio"
              name={`criteria-${field.name}`}
              checked={boolValue === ''}
              onChange={() => handleAttributeFilterChange(field.name, null)}
            />
            <span>{t('filters.dynamic.all')}</span>
          </label>
        </div>
      )
    }

    if (field.type === 'number') {
      const numericValue =
        typeof rawValue === 'number'
          ? rawValue
          : typeof rawValue === 'string' && rawValue.trim() !== ''
          ? Number(rawValue)
          : ''
      return (
        <Input
          type="number"
          value={numericValue}
          placeholder={field.ui?.placeholder ?? field.placeholder ?? ''}
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          onChange={event => {
            const nextValue = event.target.value
            if (!nextValue) {
              handleAttributeFilterChange(field.name, null)
              return
            }
            const numeric = Number(nextValue)
            handleAttributeFilterChange(field.name, Number.isFinite(numeric) ? numeric : nextValue)
          }}
        />
      )
    }

    return (
      <Input
        type="text"
        value={selectedValues[0] ?? ''}
        placeholder={field.ui?.placeholder ?? field.placeholder ?? ''}
        onChange={event => handleAttributeFilterChange(field.name, event.target.value)}
      />
    )
  }

  const renderDrawerCriteriaOptions = (
    <section className="search-drawer__section search-drawer__section--criteria">
      {renderCriteriaOptions()}
    </section>
  )

  return (
    <MainLayout>
      <div className="search-page">
        <SearchResultsHeader
          t={t}
          term={term}
          city={city}
          page={page}
          hasResults={Boolean(results)}
          headerCountLabel={headerCountLabel}
          filtersOpen={filtersOpen}
          isCreatingAlert={isCreatingAlert}
          viewMode={viewMode}
          hasLocationSelection={hasLocationSelection}
          selectedRadius={preferences.radius}
          locationQuery={locationQuery}
          locationOpen={locationOpen}
          locationSuggestions={locationSuggestions}
          locationLoading={locationLoading}
          locationError={locationError}
          locationWrapperRef={locationWrapperRef}
          locationInputRef={locationInputRef}
          onLocationQueryChange={setLocationQuery}
          onLocationOpenChange={setLocationOpen}
          onLocationCommit={commitManualLocation}
          onLocationClear={handleLocationClear}
          onLocationSelect={handleLocationSelect}
          onRadiusChange={handleRadiusChange}
          onViewModeChange={handleViewModeChange}
          onOpenFilters={() => {
            setDrawerView('main')
            setFiltersOpen(true)
          }}
          onCreateAlert={handleCreateAlert}
        />

        <SearchFiltersDrawer
          t={t}
          isOpen={filtersOpen}
          view={drawerView}
          title={drawerTitle}
          main={renderDrawerMain}
          categoryParents={renderDrawerCategoryParents}
          categoryChildren={renderDrawerCategoryChildren}
          criteriaList={renderDrawerCriteriaList}
          criteriaOptions={renderDrawerCriteriaOptions}
          onBack={handleDrawerBack}
          onClose={closeFilters}
        />

        <SearchResultsList
          t={t}
          listings={listings}
          isLoading={isLoading}
          error={error}
          viewMode={viewMode}
          page={page}
          totalPages={totalPages}
          formatPrice={formatPrice}
          getSellerType={getSellerType}
          getListingLocation={getListingLocation}
          getOwnerProfileUrl={getOwnerProfileUrl}
          getOwnerName={getOwnerName}
          formatListingDate={formatListingDate}
          onOwnerNavigate={url => navigate(url)}
          onPageChange={handlePageChange}
        />
      </div>
    </MainLayout>
  )
}
