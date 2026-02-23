import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
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
import { resolveMediaUrl } from '../../utils/media'
import { formatListingLocation } from '../../utils/location'
import { useFollowedSellers } from '../../hooks/useFollowedSellers'
import { useAuth } from '../../hooks/useAuth'

 
const RESULTS_PER_TREND = 999

const formatListingPrice = (listing: HomeListing, locale: string): string => {
  const numericPrice = Number(listing.price)
  const currency = listing.currency || 'EUR'

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
  const { isAuthenticated } = useAuth()
  const { isFollowing, followSeller, unfollowSeller } = useFollowedSellers()
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
  }, [addToast, locale])

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
  }, [addToast, t])

 
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
        <section className="lbc-hero">
          <div className="lbc-hero__inner">
            <div className="lbc-hero__content">
              {heroData ? (
                <>
                  <span className="lbc-hero__eyebrow">{heroData.eyebrow}</span>
                  <h1>{heroData.title}</h1>
                  <p>{heroData.subtitle}</p>
                </>
              ) : (
                <div>
                  <Skeleton className="skeleton-line skeleton-line--short" />
                  <Skeleton className="skeleton-line skeleton-line--wide" />
                  <Skeleton className="skeleton-line" />
                </div>
              )}
              <form className="lbc-search" role="search" onSubmit={handleSearch}>
                <div className="lbc-search__field">
                  <label>{t('home.search.queryLabel')}</label>
                  <input
                    className="input"
                    placeholder={t('home.search.queryPlaceholder')}
                    value={query.term}
                    onChange={event =>
                      setQuery(prev => ({ ...prev, term: event.target.value }))
                    }
                  />
                </div>
                <div className="lbc-search__field">
                  <label>{t('home.search.locationLabel')}</label>
                  <input
                    className="input"
                    placeholder={t('home.search.locationPlaceholder')}
                    value={query.location}
                    onChange={event =>
                      setQuery(prev => ({
                        ...prev,
                        location: event.target.value
                      }))
                    }
                  />
                </div>
                <button type="submit" className="btn btn--primary lbc-search__submit">
                  {t('home.search.submit')}
                </button>
              </form>
              {heroTags.length ? (
                <div className="lbc-hero__tags">
                  {heroTags.map(tag => (
                    <Link
                      key={tag}
                      to={`/search?category=${encodeURIComponent(tag.toLowerCase())}`}
                      className="lbc-tag"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="lbc-hero__cta">
                <Button
                  variant="outline"
                  onClick={handleCreateAlert}
                  disabled={isCreatingAlert}
                >
                  {isCreatingAlert ? t('home.search.alertSaving') : t('home.search.alertCreate')}
                </Button>
                <Link to="/search" className="lbc-link">
                  {t('home.search.viewAllListings')}
                </Link>
              </div>
              {heroLoading ? (
                <p
                  style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6c757d' }}
                  aria-live="polite"
                >
                  {t('home.search.loadingRecommendations')}
                </p>
              ) : null}
            </div>
            <div className="lbc-hero__visual">
              <div className="lbc-hero__stats">
                {primaryStat ? (
                  <>
                    <strong>{primaryStat.value}</strong>
                    <span>{primaryStat.label}</span>
                    {primaryStat.detail ? <small>{primaryStat.detail}</small> : null}
                  </>
                ) : (
                  <>
                    <Skeleton className="skeleton-line skeleton-line--short" />
                    <Skeleton className="skeleton-line skeleton-line--wide" />
                  </>
                )}
              </div>
              {heroTestimonial ? (
                <div className="lbc-hero__card">
                  <p>« {heroTestimonial.quote} »</p>
                  <span>
                    {heroTestimonial.author}
                    {heroTestimonial.location ? ` • ${heroTestimonial.location}` : ''}
                  </span>
                </div>
              ) : null}
              {heroBadge ? <div className="lbc-hero__badge">{heroBadge}</div> : null}
            </div>
          </div>
        </section>

        <section className="lbc-section">
          <div className="lbc-section__head">
            <h2>{t('home.section.popularCategories')}</h2>
            <Link to="/search" className="lbc-link">
              {t('home.section.allCategories')}
            </Link>
          </div>
          {categoriesSkeleton ?? (
            categoriesToDisplay.length ? (
              <div className="lbc-categories">
                {categoriesToDisplay.map(category => {
                  const style: CSSProperties | undefined = category.gradient
                    ? { background: category.gradient }
                    : category.color
                    ? { backgroundColor: category.color }
                    : undefined
                  const subcategoryText =
                    category.children && category.children.length
                      ? category.children.slice(0, 4).map(child => child.name).join(', ')
                      : null
                  const descriptionText =
                    subcategoryText ||
                    category.description ||
                    t('home.category.fallbackDescription')
                  return (
                    <Card key={category.id} className="lbc-category-card" style={style}>
                      <div className="lbc-category-card__icon">{category.icon ?? '🛒'}</div>
                      <div className="lbc-category-card__body">
                        <h3>{category.name}</h3>
                        <p>{descriptionText}</p>
                        <span>{t('home.category.listingCount', { count: numberFormatter.format(category.listingCount) })}</span>
                      </div>
                      <Link
                        to={`/search?category=${encodeURIComponent(category.slug)}`}
                        className="lbc-link"
                      >
                        {t('home.category.viewListings')}
                      </Link>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <p style={{ padding: '1rem', color: '#6c757d' }}>
                {t('home.categories.empty')}
              </p>
            )
          )}
        </section>

        <section className="lbc-section lbc-section--storefronts">
          <div className="lbc-section__head">
            <div>
              <h2>{t('home.section.storefronts')}</h2>
              <p>{t('home.section.storefrontsSubtitle')}</p>
            </div>
            <Link to="/stores" className="lbc-link">
              {t('home.section.storefrontsAll')}
            </Link>
          </div>
          {storefrontsSkeleton ?? (
            storefrontsError ? (
              <p style={{ padding: '0.75rem 0', color: '#b91c1c' }}>
                {storefrontsError}
              </p>
            ) : storefronts.length ? (
              <div className="lbc-storefronts">
                {storefronts.map(storefront => {
                  const initials = storefront.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(part => part[0]?.toUpperCase())
                    .join('')
                  const ratingText = storefront.totalReviews
                    ? `(${numberFormatter.format(storefront.totalReviews)})`
                    : ''
                  return (
                    <Card key={storefront.id} className="lbc-storefront-card">
                      <div
                        className="lbc-storefront-card__cover"
                        style={
                          storefront.heroUrl
                            ? { backgroundImage: `url(${resolveMediaUrl(storefront.heroUrl)})` }
                            : undefined
                        }
                      >
                          {storefront.isCompanyVerified ? (
                            <span className="lbc-storefront-card__badge">
                              ✅ {t('home.storefronts.companyVerified')}
                            </span>
                          ) : null}
                      </div>
                      <div className="lbc-storefront-card__body">
                        <div className="lbc-storefront-card__header">
                          <div className="lbc-storefront-card__avatar">
                            {storefront.avatarUrl ? (
                              <img src={resolveMediaUrl(storefront.avatarUrl)} alt={storefront.name} />
                            ) : (
                              <span>{initials || 'LB'}</span>
                            )}
                          </div>
                          <div className="lbc-storefront-card__identity">
                            <h3>{storefront.name}</h3>
                            <p>
                              {storefront.tagline ||
                                storefront.location ||
                                t('home.storefronts.locationFallback')}
                            </p>
                          </div>
                        </div>
                        <div className="lbc-storefront-card__meta">
                          <span>
                            ⭐ {storefront.averageRating.toFixed(1)} {ratingText}
                          </span>
                          <span>
                            {t('home.storefronts.listings', {
                              count: numberFormatter.format(storefront.listingCount)
                            })}
                          </span>
                        </div>
                        <Link
                          to={`/store/${storefront.slug}`}
                          className="lbc-link lbc-link--bold"
                        >
                          {t('home.storefronts.view')}
                        </Link>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <p style={{ padding: '0.75rem 0', color: '#6c757d' }}>
                {t('home.storefronts.empty')}
              </p>
            )
          )}
        </section>

        <section className="lbc-section lbc-section--trending">
          <div className="lbc-section__head">
            <h2>{t('home.section.trending')}</h2>
            <Link to="/search" className="lbc-link">
              {t('home.section.trendingAll')}
            </Link>
          </div>
          <div className="lbc-trending">
            {trendingLoading && !trendingSearches.length
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="lbc-trending-card is-loading">
                    <Skeleton className="skeleton-line skeleton-line--wide" />
                    <Skeleton className="skeleton-line skeleton-line--short" />
                  </div>
                ))
              : trendingToDisplay.length ? (
                  trendingToDisplay.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className="lbc-trending-card"
                      onClick={() => handleQuickSearch(item)}
                    >
                      <span className="lbc-trending-card__label">{item.label}</span>
                      <small>
                        {item.resultCount
                          ? t('home.trending.results', { count: numberFormatter.format(item.resultCount) })
                          : t('home.trending.resultsMore', { count: RESULTS_PER_TREND })}
                      </small>
                    </button>
                  ))
                ) : (
                  <p style={{ padding: '0.5rem', color: '#6c757d' }}>
                    {t('home.trending.empty')}
                  </p>
                )}
          </div>
        </section>

        <section className="lbc-section lbc-section--featured">
          <div className="lbc-section__head">
            <h2>{t('home.section.featured')}</h2>
            <Link to="/search?featured=true" className="lbc-link">
              {t('home.section.featuredAll')}
            </Link>
          </div>
          {featuredLoading && !featuredBase.length ? (
            <ListingSkeletonGrid count={4} />
          ) : featuredListings.length ? (
            <div className="lbc-listings lbc-listings--featured">
              {featuredListings.map(listing => (
                <Link key={listing.id} to={`/listing/${listing.id}`} className="lbc-listing-card-link">
                  <Card className="lbc-listing-card">
                  <div
                    className="lbc-listing-card__image"
                    style={
                      listing.coverImage
                        ? { backgroundImage: `url(${listing.coverImage})` }
                        : undefined
                    }
                  >
                    {listing.owner?.isCompanyVerified ? (
                      <div className="lbc-listing-card__badges">
                        <span className="lbc-listing-card__badge lbc-listing-card__badge--verified">
                          {t('listings.badge.companyVerified')}
                        </span>
                      </div>
                    ) : null}
                    <span className="lbc-listing-card__ribbon">{listing.ribbon}</span>
                    <FavoriteButton listingId={listing.id} className="favorite-toggle--overlay" />
                  </div>
                  <div className="lbc-listing-card__body">
                    <h3>{listing.title}</h3>
                    {getOwnerProfileUrl(listing) && getOwnerLabel(listing) ? (
                      <button
                        type="button"
                        className="listing-seller-link"
                        onClick={event => {
                          event.preventDefault()
                          event.stopPropagation()
                          navigate(getOwnerProfileUrl(listing)!)
                        }}
                      >
                        {getOwnerLabel(listing)}
                      </button>
                    ) : null}
                    {listing.publishedAt ? (
                      <p className="lbc-listing-card__meta">
                        {formatListingDate(listing.publishedAt, locale)}
                      </p>
                    ) : null}
                    <p>
                      {getListingLocation(listing)} ·{' '}
                      {listing.category?.name ?? listing.tag ?? t('listing.fallbackCategory')}
                    </p>
                    <p className="lbc-listing-card__price">{formatListingPrice(listing, numberLocale)}</p>
                  </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {t('home.featured.empty')}
            </p>
          )}
        </section>

        <section className="lbc-section lbc-section--alt">
          <div className="lbc-section__head">
            <h2>{t('home.section.nearby')}</h2>
            <div className="lbc-section__head-actions">
              <SortSelect value={preferences.sort} onChange={value => setPreference('sort', value)} />
              <Link to="/search" className="lbc-link">
                {t('home.section.nearbyCustomize')}
              </Link>
            </div>
          </div>

          <div className="lbc-quick-filters">
            <div className="lbc-filter-group">
              <span className="lbc-filter-group__label">{t('filters.sellerType.label')}</span>
              <div className="lbc-filter-chips" role="group" aria-label={t('filters.sellerType.aria')}>
                {sellerTypeChips.map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`lbc-chip ${
                      preferences.sellerType === chip.id ? 'lbc-chip--active' : ''
                    }`}
                    onClick={() => setPreference('sellerType', chip.id)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lbc-filter-group">
              <span className="lbc-filter-group__label">{t('filters.price.label')}</span>
              <div className="lbc-filter-chips" role="group" aria-label={t('filters.price.aria')}>
                {PRICE_BANDS.map(band => (
                  <button
                    key={band.id}
                    type="button"
                    className={`lbc-chip ${
                      preferences.priceBand === band.id ? 'lbc-chip--active' : ''
                    }`}
                    onClick={() => setPreference('priceBand', band.id)}
                  >
                    {getPriceBandLabel(t, band.id)}
                  </button>
                ))}
              </div>
            </div>

            <div className="lbc-filter-group">
              <span className="lbc-filter-group__label">{t('filters.radius.label')}</span>
              <div className="lbc-filter-chips" role="group" aria-label={t('filters.radius.aria')}>
                {RADIUS_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`lbc-chip ${
                      preferences.radius === option.value ? 'lbc-chip--active' : ''
                    }`}
                    onClick={() => setPreference('radius', option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {latestLoading && !latestBase.length ? (
            <ListingSkeletonGrid count={6} />
          ) : latestListings.length ? (
            <div className="lbc-listings lbc-listings--grid">
              {latestListings.map(listing => (
                <Link key={listing.id} to={`/listing/${listing.id}`} className="lbc-mini-card lbc-mini-card--with-favorite">
                  <FavoriteButton listingId={listing.id} className="favorite-toggle--overlay" />
                  <div
                    className="lbc-mini-card__image"
                    style={
                      listing.coverImage
                        ? { backgroundImage: `url(${listing.coverImage})` }
                        : undefined
                    }
                  />
                  <div className="lbc-mini-card__body">
                    <h3>{listing.title}</h3>
                    {getOwnerProfileUrl(listing) && getOwnerLabel(listing) ? (
                      <button
                        type="button"
                        className="listing-seller-link"
                        onClick={event => {
                          event.preventDefault()
                          event.stopPropagation()
                          navigate(getOwnerProfileUrl(listing)!)
                        }}
                      >
                        {getOwnerLabel(listing)}
                      </button>
                    ) : null}
                    {listing.publishedAt ? (
                      <p className="lbc-mini-card__date">
                        {formatListingDate(listing.publishedAt, locale)}
                      </p>
                    ) : null}
                    <p>{getListingLocation(listing)}</p>
                    <span>{formatListingPrice(listing, numberLocale)}</span>
                  </div>
                  <span className="lbc-mini-card__category">
                    {listing.category?.name ?? listing.tag ?? t('listing.fallbackCategory')}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {t('home.latest.empty')}
            </p>
          )}
        </section>

        <section className="lbc-section lbc-section--testimonials">
          <div className="lbc-section__head">
            <h2>{t('home.section.testimonials')}</h2>
            <Link to="/search?sellerType=pro" className="lbc-link">
              {t('home.section.proListings')}
            </Link>
          </div>
          <div className="lbc-testimonials">
            {testimonialLoading && !testimonials.length
              ? Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="lbc-testimonial-card is-loading">
                    <Skeleton className="skeleton-line skeleton-line--wide" />
                    <Skeleton className="skeleton-line" />
                    <Skeleton className="skeleton-line skeleton-line--short" />
                  </Card>
                ))
              : testimonialsToDisplay.length ? (
                  testimonialsToDisplay.map(testimonial => (
                    <Card key={testimonial.id} className="lbc-testimonial-card">
                      <p>« {testimonial.quote} »</p>
                      <span>
                        {testimonial.author}
                        {testimonial.location ? ` • ${testimonial.location}` : ''}
                      </span>
                    </Card>
                  ))
                ) : (
                  <p style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('home.testimonials.empty')}
                  </p>
                )}
          </div>
        </section>

        <section className="lbc-section lbc-section--services">
          <div className="lbc-section__head">
            <h2>{t('home.section.services')}</h2>
            <p>{t('home.section.servicesSubtitle')}</p>
          </div>
          {servicesLoading && !services.length ? (
            <div className="lbc-services">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="lbc-service-card is-loading">
                  <Skeleton className="skeleton-line skeleton-line--wide" />
                  <Skeleton className="skeleton-line" />
                  <Skeleton className="skeleton-line skeleton-line--short" />
                </div>
              ))}
            </div>
          ) : servicesToDisplay.length ? (
            <div className="lbc-services">
              {servicesToDisplay.map(service => (
                <div key={service.title} className="lbc-service-card">
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <Link to={service.actionUrl} className="lbc-link">
                    {service.actionLabel}
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {t('home.services.empty')}
            </p>
          )}
        </section>

        <section className="lbc-section">
          <div className="lbc-section__head">
            <h2>{t('home.section.sellerSplit')}</h2>
          </div>
          {sellerSplitLoading && !sellerSplitData ? (
            <div className="lbc-seller-split">
              {Array.from({ length: 2 }).map((_, index) => (
                <Card key={index} className="lbc-seller-card is-loading">
                  <Skeleton className="skeleton-line skeleton-line--wide" />
                  <Skeleton className="skeleton-line" />
                  <Skeleton className="skeleton-line skeleton-line--short" />
                </Card>
              ))}
            </div>
          ) : sellerSplitData ? (
            <>
              <div className="lbc-seller-split">
                <Card className="lbc-seller-card lbc-seller-card--pro">
                  <div className="lbc-seller-card__header">
                    <span className="lbc-seller-card__badge">{t('home.sellerSplit.proBadge')}</span>
                    <strong>{shareFormatter.format(sellerSplitData.proShare)}%</strong>
                  </div>
                  <p className="lbc-seller-card__count">
                    {t('home.sellerSplit.proListings', {
                      count: numberFormatter.format(sellerSplitData.proListings)
                    })}
                  </p>
                  <p className="lbc-seller-card__hint">
                    {t('home.sellerSplit.proHint')}
                  </p>
                </Card>
                <Card className="lbc-seller-card lbc-seller-card--individual">
                  <div className="lbc-seller-card__header">
                    <span className="lbc-seller-card__badge">{t('home.sellerSplit.individualBadge')}</span>
                    <strong>{shareFormatter.format(sellerSplitData.individualShare)}%</strong>
                  </div>
                  <p className="lbc-seller-card__count">
                    {t('home.sellerSplit.individualListings', {
                      count: numberFormatter.format(sellerSplitData.individualListings)
                    })}
                  </p>
                  <p className="lbc-seller-card__hint">
                    {t('home.sellerSplit.individualHint')}
                  </p>
                </Card>
              </div>
              <p className="lbc-seller-split__summary">
                {totalSellerListings
                  ? t('home.sellerSplit.summary', {
                      proShare: shareFormatter.format(sellerSplitData.proShare),
                      individualShare: shareFormatter.format(sellerSplitData.individualShare)
                    })
                  : t('home.sellerSplit.summaryEmpty')}
              </p>
            </>
          ) : (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {t('home.sellerSplit.unavailable')}
            </p>
          )}
        </section>
      </div>
    </MainLayout>
  )
}
