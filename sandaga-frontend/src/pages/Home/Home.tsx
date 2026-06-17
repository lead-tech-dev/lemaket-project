import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { Card } from '../../components/ui/Card'
import { FavoriteButton } from '../../components/ui/FavoriteButton'
import { SortSelect } from '../../components/ui/SortSelect'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { useUserPreferences } from '../../hooks/useUserPreferences'
import { apiGet, apiPost } from '../../utils/api'
import {
  PRICE_BANDS,
  getPriceBandLabel,
  RADIUS_OPTIONS,
  resolvePriceBand
} from '../../constants/filters'
import {
  HomeCategory,
  HomeHero,
  HomeListing,
  HomeSellerSplit,
  HomeService as HomeServiceType,
  HomeStorefront,
  HomeTestimonial,
  HomeTrendingSearch
} from '../../types/home'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import { useFeatureFlagsContext } from '../../contexts/FeatureFlagContext'
import { resolveMediaUrl } from '../../utils/media'
import { formatListingLocation } from '../../utils/location'
import { Icon, Badge, ListingCard, SectionHead, Photo, BoostTag } from '../../components/ds'
import { toCardItem } from '../../utils/listing-card'
import * as S from './Home.styles'

 

const formatListingPrice = (listing: HomeListing, locale: string): string => {
  const numericPrice = Number(listing.price)
  const currency = listing.currency || 'XAF'

  if (Number.isFinite(numericPrice)) {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
      }).format(numericPrice)
    } catch {
      // Ignore and fallback below
    }
  }

  return [listing.price, currency].filter(Boolean).join(' ')
}

const formatListingDate = (value: string | null | undefined, locale: string): string | null => {
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

const getListingLocation = (listing: HomeListing): string => {
  return formatListingLocation(listing.location as any, listing.city || '')
}

const getOwnerProfileUrl = (listing: HomeListing): string | null => {
  if (!listing.owner?.id) return null
  if (listing.owner.isPro) {
    return listing.owner.storefrontSlug ? `/store/${listing.owner.storefrontSlug}` : null
  }
  if (listing.owner.storefrontSlug) {
    return `/u/${listing.owner.storefrontSlug}`
  }
  return `/u/${listing.owner.id}`
}

const getOwnerLabel = (listing: HomeListing): string => {
  return listing.owner?.name?.trim() ?? ''
}

const matchesPriceBand = (listing: HomeListing, priceBand: string) => {
  if (!priceBand || priceBand === 'all') {
    return true
  }
  const band = resolvePriceBand(priceBand)
  if (!band) {
    return true
  }

  const numericPrice = Number(listing.price)
  if (!Number.isFinite(numericPrice)) {
    return true
  }

  if (typeof band.min === 'number' && numericPrice < band.min) {
    return false
  }
  if (typeof band.max === 'number' && numericPrice > band.max) {
    return false
  }

  return true
}

const matchesSellerType = (listing: HomeListing, sellerType: string) => {
  if (!sellerType || sellerType === 'all') {
    return true
  }

  const isPro = Boolean(listing.owner?.isPro)
  return sellerType === 'pro' ? isPro : !isPro
}

const filterListingsByPreferences = (
  listings: HomeListing[],
  priceBand: string,
  sellerType: string
) =>
  listings.filter(
    listing => matchesPriceBand(listing, priceBand) && matchesSellerType(listing, sellerType)
  )

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`skeleton ${className ?? ''}`} aria-hidden="true" />
)

const ListingSkeletonGrid = ({ count }: { count: number }) => (
  <div className="lbc-listings lbc-listings--grid">
    {Array.from({ length: count }).map((_, index) => (
      <Card key={index} className="lbc-listing-card is-loading">
        <Skeleton className="lbc-listing-card__image" />
        <div className="lbc-listing-card__body">
          <Skeleton className="skeleton-line skeleton-line--wide" />
          <Skeleton className="skeleton-line" />
          <Skeleton className="skeleton-line skeleton-line--short" />
        </div>
      </Card>
    ))}
  </div>
)

export default function Home() {
  const navigate = useNavigate()
  const { preferences, setPreference } = useUserPreferences()
  const { addToast } = useToast()
  const { locale, t } = useI18n()
  const { isEnabled } = useFeatureFlagsContext()
  const storefrontsEnabled = isEnabled('homeStorefronts')
  const proHomeSectionsEnabled = isEnabled('proOverview')
  const [query, setQuery] = useState({ term: '', location: '' })
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const numberFormatter = useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale])
  const shareFormatter = useMemo(
    () =>
      new Intl.NumberFormat(numberLocale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }),
    [numberLocale]
  )
  const sellerTypeChips = useMemo(
    () => [
      { id: 'all', label: t('filters.sellerType.all') },
      { id: 'individual', label: t('filters.sellerType.individual') },
      { id: 'pro', label: t('filters.sellerType.pro') }
    ],
    [t]
  )

  const [hero, setHero] = useState<HomeHero | null>(null)
  const [heroLoading, setHeroLoading] = useState(false)
  const [, setHeroError] = useState(false)
  const [categories, setCategories] = useState<HomeCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [, setCategoriesError] = useState(false)
  const [services, setServices] = useState<HomeServiceType[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [, setServicesError] = useState(false)
  const [sellerSplit, setSellerSplit] = useState<HomeSellerSplit | null>(null)
  const [sellerSplitLoading, setSellerSplitLoading] = useState(false)
  const [, setSellerSplitError] = useState(false)
  const [featuredBase, setFeaturedBase] = useState<HomeListing[]>([])
  const [latestBase, setLatestBase] = useState<HomeListing[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(false)
  const [latestLoading, setLatestLoading] = useState(false)
  const [, setFeaturedError] = useState(false)
  const [, setLatestError] = useState(false)
  const [testimonials, setTestimonials] = useState<HomeTestimonial[]>([])
  const [testimonialLoading, setTestimonialLoading] = useState(false)
  const [, setTestimonialError] = useState(false)
  const [trendingSearches, setTrendingSearches] = useState<HomeTrendingSearch[]>([])
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [, setTrendingError] = useState(false)
  const [storefronts, setStorefronts] = useState<HomeStorefront[]>([])
  const [storefrontsLoading, setStorefrontsLoading] = useState(false)
  const [storefrontsError, setStorefrontsError] = useState<string | null>(null)
  const [isCreatingAlert, setIsCreatingAlert] = useState(false)
  const [querySuggestionsOpen, setQuerySuggestionsOpen] = useState(false)
  const queryFieldRef = useRef<HTMLDivElement | null>(null)

  type CategorySuggestion = {
    id: string
    slug: string
    label: string
    parentLabel?: string
  }

  const categorySuggestions = useMemo<CategorySuggestion[]>(() => {
    if (!categories.length) {
      return []
    }

    const normalized = query.term.trim().toLowerCase()
    const suggestionsBySlug = new Map<string, CategorySuggestion>()
    const categoriesById = new Map(categories.map(category => [category.id, category]))

    const addSuggestion = (entry: CategorySuggestion) => {
      if (!entry.slug || suggestionsBySlug.has(entry.slug)) {
        return
      }
      suggestionsBySlug.set(entry.slug, entry)
    }

    categories.forEach(category => {
      const parentLabel = category.parentId
        ? categoriesById.get(category.parentId)?.name
        : undefined
      addSuggestion({
        id: category.id,
        slug: category.slug,
        label: category.name,
        parentLabel
      })

      ;(category.children ?? []).forEach(child => {
        addSuggestion({
          id: child.id,
          slug: child.slug,
          label: child.name,
          parentLabel: category.name
        })
      })
    })

    const list = Array.from(suggestionsBySlug.values())
    if (!normalized) {
      return list.filter(item => !item.parentLabel).slice(0, 6)
    }

    return list
      .filter(item => {
        const label = item.label.toLowerCase()
        const parent = item.parentLabel?.toLowerCase() ?? ''
        return label.includes(normalized) || parent.includes(normalized)
      })
      .sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(normalized) ? 0 : 1
        const bStarts = b.label.toLowerCase().startsWith(normalized) ? 0 : 1
        if (aStarts !== bStarts) {
          return aStarts - bStarts
        }
        return a.label.localeCompare(b.label, locale === 'fr' ? 'fr' : 'en', {
          sensitivity: 'base'
        })
      })
      .slice(0, 8)
  }, [categories, locale, query.term])

  useEffect(() => {
    if (!querySuggestionsOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) {
        setQuerySuggestionsOpen(false)
        return
      }
      if (queryFieldRef.current?.contains(target)) {
        return
      }
      setQuerySuggestionsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setQuerySuggestionsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [querySuggestionsOpen])

  useEffect(() => {
    const controller = new AbortController()
    setHeroLoading(true)
    setHeroError(false)

    apiGet<HomeHero>('/home/hero', { signal: controller.signal })
      .then(data => {
        setHero(data)
        setHeroError(false)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setHeroError(true)
        console.error('Unable to load hero content', err)
        addToast({
          variant: 'error',
          title: t('home.toast.partialTitle'),
          message: t('home.toast.heroMessage')
        })
      })
      .finally(() => setHeroLoading(false))

    return () => controller.abort()
  }, [addToast, locale])

  useEffect(() => {
    const controller = new AbortController()
    setCategoriesLoading(true)
    setCategoriesError(false)

    apiGet<HomeCategory[]>('/home/categories', { signal: controller.signal })
      .then(data => {
        setCategories(data)
        setCategoriesError(false)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setCategoriesError(true)
        console.error('Unable to load categories', err)
        addToast({
          variant: 'error',
          title: t('home.toast.partialTitle'),
          message: t('home.toast.categoriesMessage')
        })
      })
      .finally(() => setCategoriesLoading(false))

    return () => controller.abort()
  }, [addToast, locale])

  useEffect(() => {
    const controller = new AbortController()
    setServicesLoading(true)
    setServicesError(false)

    apiGet<HomeServiceType[]>('/home/services', { signal: controller.signal })
      .then(data => {
        setServices(data)
        setServicesError(false)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setServicesError(true)
        console.error('Unable to load services', err)
        addToast({
          variant: 'error',
          title: t('home.toast.partialTitle'),
          message: t('home.toast.servicesMessage')
        })
      })
      .finally(() => setServicesLoading(false))

    return () => controller.abort()
  }, [addToast, locale])

  useEffect(() => {
    if (!proHomeSectionsEnabled) {
      setSellerSplit(null)
      setSellerSplitLoading(false)
      setSellerSplitError(false)
      return
    }

    const controller = new AbortController()
    setSellerSplitLoading(true)
    setSellerSplitError(false)

    apiGet<HomeSellerSplit>('/home/seller-split', { signal: controller.signal })
      .then(data => {
        setSellerSplit(data)
        setSellerSplitError(false)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setSellerSplitError(true)
        console.error('Unable to load seller split', err)
        addToast({
          variant: 'error',
          title: t('home.toast.partialTitle'),
          message: t('home.toast.sellerSplitMessage')
        })
      })
      .finally(() => setSellerSplitLoading(false))

    return () => controller.abort()
  }, [addToast, locale, proHomeSectionsEnabled])

  useEffect(() => {
    const controller = new AbortController()
    setFeaturedLoading(true)
    setLatestLoading(true)
    setFeaturedError(false)
    setLatestError(false)

    const params = new URLSearchParams()
    if (preferences.sort && preferences.sort !== 'recent') {
      params.set('featuredSort', preferences.sort)
      params.set('latestSort', preferences.sort)
    }
    if (preferences.sellerType && preferences.sellerType !== 'all') {
      params.set('sellerType', preferences.sellerType)
    }

    const endpoint = params.toString() ? `/home/listings?${params.toString()}` : '/home/listings'

    apiGet<{ featured: HomeListing[]; latest: HomeListing[] }>(endpoint, {
      signal: controller.signal
    })
      .then(data => {
        setFeaturedBase(data.featured)
        setLatestBase(data.latest)
        setFeaturedError(false)
        setLatestError(false)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setFeaturedError(true)
        setLatestError(true)
        console.error('Unable to load listings collections', err)
        addToast({
          variant: 'error',
          title: t('home.toast.partialTitle'),
          message: t('home.toast.listingsMessage')
        })
      })
      .finally(() => {
        setFeaturedLoading(false)
        setLatestLoading(false)
      })

    return () => controller.abort()
  }, [preferences.sort, preferences.sellerType, addToast, locale])

  useEffect(() => {
    const controller = new AbortController()
    setTestimonialLoading(true)
    setTestimonialError(false)

    apiGet<HomeTestimonial[]>('/home/testimonials', { signal: controller.signal })
      .then(data => {
        setTestimonials(data)
        setTestimonialError(false)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setTestimonialError(true)
        console.error('Unable to load testimonials', err)
        addToast({
          variant: 'error',
          title: t('home.toast.partialTitle'),
          message: t('home.toast.testimonialsMessage')
        })
      })
      .finally(() => setTestimonialLoading(false))

    return () => controller.abort()
  }, [addToast, locale])

  useEffect(() => {
    const controller = new AbortController()
    setTrendingLoading(true)
    setTrendingError(false)

    apiGet<HomeTrendingSearch[]>('/home/trending-searches', {
      signal: controller.signal
    })
      .then(data => {
        setTrendingSearches(data)
        setTrendingError(false)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setTrendingError(true)
        console.error('Unable to load trending searches', err)
        addToast({
          variant: 'error',
          title: t('home.toast.partialTitle'),
          message: t('home.toast.trendingMessage')
        })
      })
      .finally(() => setTrendingLoading(false))

    return () => controller.abort()
  }, [addToast, locale])

  useEffect(() => {
    if (!storefrontsEnabled) {
      setStorefronts([])
      setStorefrontsLoading(false)
      setStorefrontsError(null)
      return
    }

    const controller = new AbortController()
    setStorefrontsLoading(true)
    setStorefrontsError(null)

    apiGet<HomeStorefront[]>('/home/storefronts?limit=6', {
      signal: controller.signal
    })
      .then(data => {
        setStorefronts(data ?? [])
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        console.error('Unable to load storefronts', err)
        setStorefrontsError(
          err instanceof Error ? err.message : t('home.storefronts.error')
        )
        addToast({
          variant: 'error',
          title: t('home.toast.partialTitle'),
          message: t('home.toast.storefrontsMessage')
        })
      })
      .finally(() => setStorefrontsLoading(false))

    return () => controller.abort()
  }, [addToast, storefrontsEnabled, t])

 
  const heroData = hero
  const categoriesSource = categories
  const categoriesToDisplay = categoriesSource
    .filter(cat => cat.parentId === null || typeof (cat as any).parentId === 'undefined')
    .slice(0, 8)
  const servicesToDisplay = services
  const sellerSplitData = sellerSplit
  const testimonialsToDisplay = testimonials
  const trendingToDisplay = trendingSearches
  const heroTestimonial = testimonialsToDisplay[0]
  const heroTags = heroData?.tags?.length ? heroData.tags : []
  const featuredListings = useMemo(
    () =>
      filterListingsByPreferences(
        featuredBase,
        preferences.priceBand,
        preferences.sellerType
      ),
    [featuredBase, preferences.priceBand, preferences.sellerType]
  )

  const latestListings = useMemo(
    () =>
      filterListingsByPreferences(
        latestBase,
        preferences.priceBand,
        preferences.sellerType
      ),
    [latestBase, preferences.priceBand, preferences.sellerType]
  )

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setQuerySuggestionsOpen(false)
    const params = new URLSearchParams()
    if (query.term.trim()) params.set('q', query.term.trim())
    if (query.location.trim()) params.set('l', query.location.trim())
    if (preferences.priceBand && preferences.priceBand !== 'all') {
      const band = resolvePriceBand(preferences.priceBand)
      if (band?.min !== undefined) params.set('minPrice', String(band.min))
      if (band?.max !== undefined) params.set('maxPrice', String(band.max))
    }
    if (preferences.radius && preferences.radius !== '25') {
      params.set('radius', preferences.radius)
    }
    if (preferences.sellerType && preferences.sellerType !== 'all') {
      params.set('sellerType', preferences.sellerType)
    }
    navigate(`/search?${params.toString()}`)
  }

  const handleCategorySuggestionSelect = (suggestion: CategorySuggestion) => {
    setQuerySuggestionsOpen(false)
    setQuery(prev => ({ ...prev, term: suggestion.label }))
    const params = new URLSearchParams()
    params.set('category', suggestion.slug)
    if (query.location.trim()) {
      params.set('l', query.location.trim())
    }
    navigate(`/search?${params.toString()}`)
  }

  const handleCreateAlert = async () => {
    if (isCreatingAlert) {
      return
    }

    if (!query.term.trim() && !query.location.trim()) {
      addToast({
        variant: 'info',
        title: t('home.alert.missingTitle'),
        message: t('home.alert.missingMessage')
      })
      return
    }

    setIsCreatingAlert(true)
    const payload = {
      term: query.term.trim() || undefined,
      location: query.location.trim() || undefined,
      sellerType: preferences.sellerType,
      priceBand: preferences.priceBand,
      radius: preferences.radius
    }

    try {
      await apiPost('/alerts', payload)
      addToast({
        variant: 'success',
        title: t('home.alert.successTitle'),
        message: t('home.alert.successMessage')
      })
    } catch (err) {
      console.error('Unable to create saved search', err)
      const message = err instanceof Error ? err.message : t('home.alert.errorFallback')
      if (message.includes('401') || message.toLowerCase().includes('unauthorized')) {
        addToast({
          variant: 'info',
          title: t('home.alert.loginTitle'),
          message: t('home.alert.loginMessage')
        })
        navigate('/login')
      } else {
        addToast({
          variant: 'error',
          title: t('home.alert.errorTitle'),
          message
        })
      }
    } finally {
      setIsCreatingAlert(false)
    }
  }

  const handleQuickSearch = (item: HomeTrendingSearch) => {
    const params = new URLSearchParams()
    params.set('q', item.query)
    navigate(`/search?${params.toString()}`)
  }

  const primaryStat = heroData?.stats?.[0]
  const heroBadge =
    heroData?.stats?.[1]?.detail ??
    heroData?.stats?.[1]?.label ??
    primaryStat?.detail ??
    ''

  const totalSellerListings = sellerSplitData
    ? sellerSplitData.proListings + sellerSplitData.individualListings
    : 0

  const categoriesSkeleton =
    categoriesLoading && !categories.length ? (
      <div className="lbc-categories">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="lbc-category-card is-loading">
            <Skeleton className="skeleton-circle" />
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-line skeleton-line--short" />
          </Card>
        ))}
      </div>
    ) : null

  const storefrontsSkeleton =
    storefrontsLoading && !storefronts.length ? (
      <div className="lbc-storefronts">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="lbc-storefront-card is-loading">
            <Skeleton className="lbc-storefront-card__cover" />
            <div className="lbc-storefront-card__body">
              <Skeleton className="skeleton-line skeleton-line--wide" />
              <Skeleton className="skeleton-line" />
              <Skeleton className="skeleton-line skeleton-line--short" />
            </div>
          </Card>
        ))}
      </div>
    ) : null

  return (
    <MainLayout>
      <div className="lbc-home">
        <S.Hero>
          <S.HeroGlowA />
          <S.HeroGlowB />
          <S.HeroInner>
            <div>
              <S.HeroBadge>
                <Icon name="spark" size={14} color="#fff" fill="#fff" sw={1} />{' '}
                {t('home.m.badge')}
              </S.HeroBadge>
              <S.HeroTitle>
                {t('home.m.titleA')}
                <br />
                <span style={{ color: 'var(--color-primary)' }}>{t('home.m.titleB')}</span>
                {t('home.m.titleC')}
              </S.HeroTitle>
              <S.HeroSub>{t('home.m.sub')}</S.HeroSub>

              <S.HeroSearch role="search" onSubmit={handleSearch}>
                <S.HeroField ref={queryFieldRef}>
                  <Icon name="search" size={19} color="#97A199" />
                  <div style={{ flex: 1 }}>
                    <label>{t('home.m.what')}</label>
                    <input
                      placeholder={t('home.m.whatPh')}
                      value={query.term}
                      onFocus={() => setQuerySuggestionsOpen(true)}
                      onBlur={event => {
                        const nextTarget = event.relatedTarget as Node | null
                        if (nextTarget && queryFieldRef.current?.contains(nextTarget)) {
                          return
                        }
                        setQuerySuggestionsOpen(false)
                      }}
                      onChange={event => {
                        setQuery(prev => ({ ...prev, term: event.target.value }))
                        if (!querySuggestionsOpen) {
                          setQuerySuggestionsOpen(true)
                        }
                      }}
                    />
                  </div>
                  {querySuggestionsOpen ? (
                    <S.SuggestBox role="listbox">
                      {categoriesLoading ? (
                        <S.SuggestHint>{t('search.header.loading')}</S.SuggestHint>
                      ) : categorySuggestions.length ? (
                        categorySuggestions.map(suggestion => (
                          <S.SuggestItem
                            key={suggestion.id}
                            type="button"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => handleCategorySuggestionSelect(suggestion)}
                          >
                            <span className="label">{suggestion.label}</span>
                            {suggestion.parentLabel ? (
                              <span className="meta">{suggestion.parentLabel}</span>
                            ) : null}
                          </S.SuggestItem>
                        ))
                      ) : (
                        <S.SuggestHint>{t('header.search.empty')}</S.SuggestHint>
                      )}
                    </S.SuggestBox>
                  ) : null}
                </S.HeroField>
                <S.HeroDivider />
                <S.HeroField>
                  <Icon name="pin" size={19} color="#97A199" />
                  <div style={{ flex: 1 }}>
                    <label>{t('home.m.where')}</label>
                    <input
                      placeholder={t('home.m.wherePh')}
                      value={query.location}
                      onChange={event =>
                        setQuery(prev => ({ ...prev, location: event.target.value }))
                      }
                    />
                  </div>
                </S.HeroField>
                <S.HeroSubmit type="submit">{t('home.m.btn')}</S.HeroSubmit>
              </S.HeroSearch>

              <S.HeroTags>
                <S.HeroTagLabel>{t('home.m.popular')}</S.HeroTagLabel>
                {['Appartements', 'iPhone', 'Toyota', 'Offres d’emploi', 'Terrains'].map(tag => (
                  <S.HeroTag
                    key={tag}
                    type="button"
                    onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)}
                  >
                    {tag}
                  </S.HeroTag>
                ))}
              </S.HeroTags>
            </div>

            <S.HeroAside>
              <S.FloatCollage>
                {[...featuredListings, ...latestListings].slice(0, 3).map((listing, i) => {
                  const card = toCardItem(listing, numberLocale)
                  const pos = [
                    { top: 0, right: 30, width: 230, transform: 'rotate(-4deg)' },
                    { top: 120, left: 0, width: 235, transform: 'rotate(3deg)', zIndex: 2 },
                    { bottom: 0, right: 0, width: 225, transform: 'rotate(5deg)' }
                  ][i]
                  return (
                    <S.FloatCard
                      key={listing.id}
                      style={pos}
                      onClick={() => navigate(`/listing/${listing.id}`)}
                    >
                      <Photo item={card} h={120} fz={40}>
                        {card.boosted ? <BoostTag /> : null}
                      </Photo>
                      <S.FloatBody>
                        <div className="price">
                          {card.price} <span>FCFA{card.unit ?? ''}</span>
                        </div>
                        <div className="title">{card.title}</div>
                      </S.FloatBody>
                    </S.FloatCard>
                  )
                })}
                <S.VerifiedFloat>
                  <div className="circle">
                    <Badge size={20} />
                  </div>
                  <div>
                    <div className="pct">92%</div>
                    <div className="lbl">{t('home.m.verified')}</div>
                  </div>
                </S.VerifiedFloat>
              </S.FloatCollage>
            </S.HeroAside>
          </S.HeroInner>
        </S.Hero>

        <S.Section>
          <SectionHead
            title={t('home.m.cats')}
            action={
              <Link to="/search" className="lbc-link">
                {t('home.m.all')}
              </Link>
            }
          />
          {categoriesToDisplay.length ? (
            <S.Grid4>
              {categoriesToDisplay.map(category => {
                const subcategoryText =
                  category.children && category.children.length
                    ? category.children.slice(0, 4).map(child => child.name).join(', ')
                    : null
                const descriptionText =
                  subcategoryText || category.description || t('home.category.fallbackDescription')
                return (
                  <S.CategoryCard
                    key={category.id}
                    type="button"
                    onClick={() => navigate(`/category/${encodeURIComponent(category.slug)}`)}
                  >
                    <div className="icon">{category.icon ?? '🛒'}</div>
                    <div className="name">{category.name}</div>
                    <div className="sub">{descriptionText}</div>
                    <div className="count">
                      {t('home.category.listingCount', {
                        count: numberFormatter.format(category.listingCount)
                      })}
                    </div>
                  </S.CategoryCard>
                )
              })}
            </S.Grid4>
          ) : categoriesSkeleton ? (
            categoriesSkeleton
          ) : (
            <p className="ui-feedback ui-feedback--compact">{t('home.categories.empty')}</p>
          )}
        </S.Section>

        <section className="lbc-section lbc-section--featured">
          <SectionHead
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {t('home.m.featured')} <Badge size={20} />
              </span>
            }
            sub={t('home.m.featuredSub')}
            action={
              <Link to="/search?featured=true" className="lbc-link">
                {t('home.m.more')}
              </Link>
            }
          />
	          {featuredLoading && !featuredBase.length ? (
	            <ListingSkeletonGrid count={4} />
	          ) : featuredListings.length ? (
	            <S.Grid4>
              {featuredListings.map(listing => (
                <ListingCard
                  key={listing.id}
                  item={toCardItem(listing, numberLocale)}
                  onOpen={() => navigate(`/listing/${listing.id}`)}
                  favoriteSlot={
                    <FavoriteButton listingId={listing.id} className="favorite-toggle--overlay" />
                  }
                />
              ))}
            </S.Grid4>
          ) : (
            <p className="ui-feedback ui-feedback--compact">
              {t('home.featured.empty')}
            </p>
          )}
        </section>

        {latestListings.length ? (
          <S.Section>
            <SectionHead
              title={t('home.m.foryou')}
              sub={t('home.m.foryouSub')}
              action={
                <Link to="/search" className="lbc-link">
                  {t('home.m.more')}
                </Link>
              }
            />
            <S.Grid4>
              {latestListings.slice(0, 4).map(listing => (
                <ListingCard
                  key={listing.id}
                  item={toCardItem(listing, numberLocale)}
                  onOpen={() => navigate(`/listing/${listing.id}`)}
                  favoriteSlot={
                    <FavoriteButton listingId={listing.id} className="favorite-toggle--overlay" />
                  }
                />
              ))}
            </S.Grid4>
          </S.Section>
        ) : null}

        <S.Section>
          <S.BoostStrip>
            <div className="body">
              <S.BoostTagPill>
                <Icon name="bolt" size={13} color="#FFD23F" fill="#FFD23F" sw={1} />{' '}
                {t('home.m.boostTag')}
              </S.BoostTagPill>
              <h3>{t('home.m.boostH')}</h3>
              <p>{t('home.m.boostP')}</p>
            </div>
            <S.BoostCta type="button" onClick={() => navigate('/listings/new')}>
              {t('home.m.boostBtn')} <Icon name="arrowR" size={18} />
            </S.BoostCta>
          </S.BoostStrip>
        </S.Section>

        <S.Section>
          <SectionHead
            title={t('home.m.recent')}
            action={
              <Link to="/search" className="lbc-link">
                {t('home.m.allAds')}
              </Link>
            }
          />
          {latestLoading && !latestBase.length ? (
            <ListingSkeletonGrid count={8} />
          ) : latestListings.length ? (
            <S.Grid4>
              {latestListings.map(listing => (
                <ListingCard
                  key={listing.id}
                  item={toCardItem(listing, numberLocale)}
                  onOpen={() => navigate(`/listing/${listing.id}`)}
                  favoriteSlot={
                    <FavoriteButton listingId={listing.id} className="favorite-toggle--overlay" />
                  }
                />
              ))}
            </S.Grid4>
          ) : (
            <p className="ui-feedback ui-feedback--compact">{t('home.latest.empty')}</p>
          )}
        </S.Section>

        <S.Section style={{ paddingBottom: 8 }}>
          <S.HowHead>
            <h2>{t('home.m.howTitle')}</h2>
            <p>{t('home.m.howSub')}</p>
          </S.HowHead>
          <S.HowGrid>
            {([
              { n: '01', ic: 'cam', t: t('home.m.how1t'), d: t('home.m.how1d') },
              { n: '02', ic: 'spark', t: t('home.m.how2t'), d: t('home.m.how2d') },
              { n: '03', ic: 'chat', t: t('home.m.how3t'), d: t('home.m.how3d') }
            ] as const).map(step => (
              <S.HowCard key={step.n}>
                <div className="top">
                  <div className="ic">
                    <Icon name={step.ic} size={24} />
                  </div>
                  <span className="num">{step.n}</span>
                </div>
                <div className="t">{step.t}</div>
                <div className="d">{step.d}</div>
              </S.HowCard>
            ))}
          </S.HowGrid>
          <S.HowCta>
            <S.BoostCta
              type="button"
              onClick={() => navigate('/listings/new')}
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              {t('home.m.howCta')}
            </S.BoostCta>
          </S.HowCta>
        </S.Section>
      </div>
    </MainLayout>
  )
}
