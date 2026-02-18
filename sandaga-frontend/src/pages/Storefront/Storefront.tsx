import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { RetryBanner } from '../../components/ui/RetryBanner'
import { apiGet } from '../../utils/api'
import type { Listing } from '../../types/listing'
import type { Paginated } from '../../types/pagination'
import type { Review, SellerReviewsResponse } from '../../types/review'
import type { Storefront, StorefrontCategory } from '../../types/storefront'
import { useI18n } from '../../contexts/I18nContext'
import { FavoriteButton } from '../../components/ui/FavoriteButton'
import { resolveMediaUrl } from '../../utils/media'
import { formatListingLocation } from '../../utils/location'
import { useAuth } from '../../hooks/useAuth'
import { useFollowedSellers } from '../../hooks/useFollowedSellers'

const LISTINGS_LIMIT = 12
const REVIEWS_LIMIT = 6

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

const getListingLocation = (listing: Listing, fallback: string) => {
  return formatListingLocation(listing.location as any, listing.city || fallback)
}

export default function StorefrontPage() {
  const { slug } = useParams<{ slug: string }>()
  const { t, locale } = useI18n()
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { isFollowing, followSeller, unfollowSeller } = useFollowedSellers()

  const [storefront, setStorefront] = useState<Storefront | null>(null)
  const [storefrontLoading, setStorefrontLoading] = useState(true)
  const [storefrontError, setStorefrontError] = useState<string | null>(null)

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [listingSort, setListingSort] = useState<'recent' | 'priceAsc' | 'popular'>('recent')
  const [listings, setListings] = useState<Listing[]>([])
  const [listingsTotal, setListingsTotal] = useState(0)
  const [listingsLoading, setListingsLoading] = useState(false)
  const [listingsError, setListingsError] = useState<string | null>(null)

  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsSummary, setReviewsSummary] = useState<SellerReviewsResponse['summary'] | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)

  useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    setStorefrontLoading(true)
    setStorefrontError(null)
    setStorefront(null)
    setListings([])
    setListingsTotal(0)
    apiGet<Storefront>(`/storefronts/${slug}`, { signal: controller.signal })
      .then(data => {
        setStorefront(data)
        setSelectedCategory(null)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('Unable to load storefront', err)
        setStorefrontError(
          err instanceof Error ? err.message : t('storefront.error')
        )
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setStorefrontLoading(false)
      })

    return () => controller.abort()
  }, [slug, t])

  useEffect(() => {
    if (!storefront?.slug) return
    const controller = new AbortController()
    const params = new URLSearchParams()
    params.set('limit', String(LISTINGS_LIMIT))
    if (selectedCategory) {
      params.set('categorySlug', selectedCategory)
    }
    if (listingSort !== 'recent') {
      params.set('sort', listingSort)
    }

    setListingsLoading(true)
    setListingsError(null)

    apiGet<Paginated<Listing>>(
      `/storefronts/${storefront.slug}/listings?${params.toString()}`,
      { signal: controller.signal }
    )
      .then(data => {
        setListings(data.data ?? [])
        setListingsTotal(data.total ?? 0)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('Unable to load storefront listings', err)
        setListingsError(
          err instanceof Error ? err.message : t('storefront.listings.error')
        )
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setListingsLoading(false)
      })

    return () => controller.abort()
  }, [storefront?.slug, selectedCategory, listingSort, t])

  useEffect(() => {
    if (!storefront?.storefrontShowReviews) {
      setReviews([])
      setReviewsSummary(null)
      return
    }
    const controller = new AbortController()
    setReviewsLoading(true)
    apiGet<SellerReviewsResponse>(
      `/reviews/sellers/${storefront.id}?limit=${REVIEWS_LIMIT}`,
      { signal: controller.signal }
    )
      .then(data => {
        setReviews(data.items ?? [])
        setReviewsSummary(data.summary ?? null)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('Unable to load storefront reviews', err)
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setReviewsLoading(false)
      })

    return () => controller.abort()
  }, [storefront?.id, storefront?.storefrontShowReviews])

  const formatPrice = (listing: Listing) => {
    const numeric = Number(listing.price ?? 0)
    if (Number.isFinite(numeric) && numeric > 0) {
      return `${numberFormatter.format(numeric)} ${listing.currency ?? ''}`.trim()
    }
    return [listing.price, listing.currency].filter(Boolean).join(' ')
  }

  const whatsappLink = useMemo(() => {
    if (!storefront?.phoneNumber) return null
    const digits = storefront.phoneNumber.replace(/[^\d]/g, '')
    return digits ? `https://wa.me/${digits}` : null
  }, [storefront?.phoneNumber])

  const heroStyle = useMemo(() => {
    if (!storefront?.heroUrl) return undefined
    return { backgroundImage: `url(${resolveMediaUrl(storefront.heroUrl)})` }
  }, [storefront?.heroUrl])

  const categories: StorefrontCategory[] = storefront?.categories ?? []
  const isPopularListing = (listing: Listing) =>
    (listing.views ?? 0) >= 50 || (listing.messagesCount ?? 0) >= 5
  const identityLabel = useMemo(() => {
    const status = storefront?.identityStatus
    if (status === 'approved') return t('storefront.trust.identityVerified')
    if (status === 'pending') return t('storefront.trust.identityPending')
    if (status === 'rejected') return t('storefront.trust.identityRejected')
    return t('storefront.trust.identityUnverified')
  }, [storefront?.identityStatus, t])
  const addressLabel = useMemo(() => {
    if (storefront?.isVerified && storefront.location) {
      return t('storefront.trust.addressVerified')
    }
    return t('storefront.trust.addressUnverified')
  }, [storefront?.isVerified, storefront?.location, t])
  const phoneLabel = useMemo(() => {
    return storefront?.phoneNumber
      ? t('storefront.trust.phoneAvailable')
      : t('storefront.trust.phoneMissing')
  }, [storefront?.phoneNumber, t])
  const reviewStats = useMemo(() => {
    if (!reviewsSummary) return null
    return {
      averageRating: reviewsSummary.averageRating.toFixed(1),
      positiveCount: reviewsSummary.positiveCount ?? 0,
      negativeCount: reviewsSummary.negativeCount ?? 0,
      successfulSales: reviewsSummary.successfulSales ?? reviewsSummary.totalReviews ?? 0
    }
  }, [reviewsSummary])

  const followersLabel = locale === 'fr' ? 'abonnés' : 'followers'
  const isFollowed =
    typeof storefront?.isFollowed === 'boolean'
      ? storefront.isFollowed
      : storefront?.id
      ? isFollowing(storefront.id)
      : false
  const handleFollowClick = async () => {
    if (!storefront?.id) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (isFollowed) {
      await unfollowSeller(storefront.id)
      setStorefront(prev =>
        prev
          ? { ...prev, followersCount: Math.max(0, (prev.followersCount ?? 0) - 1), isFollowed: false }
          : prev
      )
    } else {
      await followSeller(storefront.id)
      setStorefront(prev =>
        prev ? { ...prev, followersCount: (prev.followersCount ?? 0) + 1, isFollowed: true } : prev
      )
    }
  }

  if (!slug) {
    return (
      <MainLayout>
        <RetryBanner
          title={t('storefront.errorTitle')}
          message={t('storefront.missing')}
          accessory="⚠️"
          onRetry={() => window.location.assign('/')}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      {storefrontLoading ? (
        <div className="storefront-page">
          <Card className="storefront-hero">
            <Skeleton height="220px" />
          </Card>
          <div className="storefront-body">
            <div className="storefront-body__main">
              <Card className="storefront-card">
                <Skeleton height="24px" width="220px" />
                <Skeleton height="16px" width="100%" />
                <Skeleton height="16px" width="90%" />
              </Card>
              <Card className="storefront-card">
                <Skeleton height="24px" width="200px" />
                <Skeleton height="180px" width="100%" />
              </Card>
            </div>
            <div className="storefront-body__sidebar">
              <Card className="storefront-card">
                <Skeleton height="24px" width="160px" />
                <Skeleton height="16px" width="80%" />
                <Skeleton height="16px" width="70%" />
              </Card>
            </div>
          </div>
        </div>
      ) : storefrontError ? (
        <RetryBanner
          title={t('storefront.errorTitle')}
          message={storefrontError}
          accessory="⚠️"
          onRetry={() => window.location.reload()}
        />
      ) : !storefront ? (
        <RetryBanner
          title={t('storefront.notFoundTitle')}
          message={t('storefront.notFoundMessage')}
          accessory="🔎"
          onRetry={() => window.location.assign('/')}
        />
      ) : (
        <div className={`storefront-page storefront-theme--${storefront.theme ?? 'classic'}`}>
          <section className="storefront-hero">
            <div className="storefront-hero__media" style={heroStyle} />
            <div className="storefront-hero__content">
              <div
                className="storefront-avatar"
                style={
                  storefront.avatarUrl
                    ? { backgroundImage: `url(${resolveMediaUrl(storefront.avatarUrl)})` }
                    : undefined
                }
              />
              <div className="storefront-title">
                <div className="storefront-title__row">
                  <h1>{storefront.name}</h1>
                  {storefront.isPro ? (
                    <span className="storefront-badge">{t('storefront.badge.pro')}</span>
                  ) : null}
                  {storefront.isCompanyVerified ? (
                    <span className="storefront-badge storefront-badge--verified">
                      {t('storefront.badge.companyVerified')}
                    </span>
                  ) : null}
                </div>
                {storefront.tagline ? (
                  <p className="storefront-tagline">{storefront.tagline}</p>
                ) : null}
                <div className="storefront-meta">
                  <span>{storefront.location || t('storefront.locationFallback')}</span>
                  <span>
                    {t('storefront.stats.listings')} ·{' '}
                    {numberFormatter.format(storefront.stats.listingCount)}
                  </span>
                  <span>
                    {numberFormatter.format(storefront.followersCount ?? 0)} {followersLabel}
                  </span>
                </div>
              </div>
              <div className="storefront-actions">
                <Button
                  variant={isFollowed ? 'ghost' : 'outline'}
                  type="button"
                  onClick={handleFollowClick}
                >
                  {isFollowed ? (locale === 'fr' ? 'Suivi' : 'Following') : (locale === 'fr' ? 'Suivre' : 'Follow')}
                </Button>
                {whatsappLink ? (
                  <a href={whatsappLink} target="_blank" rel="noreferrer" className="btn btn--primary">
                    {t('storefront.actions.whatsapp')}
                  </a>
                ) : (
                  <Button variant="outline" disabled type="button">
                    {t('storefront.actions.whatsapp')}
                  </Button>
                )}
                {storefront.website ? (
                  <a
                    href={storefront.website.startsWith('http') ? storefront.website : `https://${storefront.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn--outline"
                  >
                    {t('storefront.actions.website')}
                  </a>
                ) : null}
                <Link to="/search" className="btn btn--ghost">
                  {t('storefront.actions.search')}
                </Link>
              </div>
            </div>
          </section>

          <div className="storefront-body">
            <div className="storefront-body__main">
              <Card className="storefront-card">
                <div className="storefront-card__head">
                  <h2>{t('storefront.section.about')}</h2>
                </div>
                <div className="storefront-about__layout">
                  <div className="storefront-about__facts">
                    <div className="storefront-about__fact">
                      <span className="storefront-about__icon" aria-hidden>📍</span>
                      <div>
                        <span className="storefront-about__label">{t('storefront.about.location')}</span>
                        <strong className="storefront-about__value">
                          {storefront.location || t('storefront.locationFallback')}
                        </strong>
                      </div>
                    </div>
                    <div className="storefront-about__fact">
                      <span className="storefront-about__icon" aria-hidden>🌐</span>
                      <div>
                        <span className="storefront-about__label">{t('storefront.about.website')}</span>
                        {storefront.website ? (
                          <a
                            className="storefront-about__link"
                            href={
                              storefront.website.startsWith('http')
                                ? storefront.website
                                : `https://${storefront.website}`
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            {storefront.website}
                          </a>
                        ) : (
                          <strong className="storefront-about__value">
                            {t('storefront.about.missing')}
                          </strong>
                        )}
                      </div>
                    </div>
                    <div className="storefront-about__fact">
                      <span className="storefront-about__icon" aria-hidden>🏷️</span>
                      <div>
                        <span className="storefront-about__label">{t('storefront.about.companyId')}</span>
                        <strong className="storefront-about__value">
                          {storefront.companyId || t('storefront.about.missing')}
                        </strong>
                      </div>
                    </div>
                    <div className="storefront-about__fact">
                      <span className="storefront-about__icon" aria-hidden>📞</span>
                      <div>
                        <span className="storefront-about__label">{t('storefront.about.phone')}</span>
                        {storefront.phoneNumber ? (
                          <a className="storefront-about__link" href={`tel:${storefront.phoneNumber}`}>
                            {storefront.phoneNumber}
                          </a>
                        ) : (
                          <strong className="storefront-about__value">
                            {t('storefront.about.missing')}
                          </strong>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="storefront-about__summary">
                    <p className="storefront-about__text">
                      {storefront.description || t('storefront.aboutEmpty')}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="storefront-card storefront-card--listings">
                <div className="storefront-card__head">
                  <div>
                    <h2>{t('storefront.section.listings')}</h2>
                    <p>
                      {t('storefront.listings.count', {
                        count: numberFormatter.format(listingsTotal)
                      })}
                    </p>
                  </div>
                </div>
                <div className="storefront-categories">
                  <button
                    type="button"
                    className={`lbc-chip ${!selectedCategory ? 'lbc-chip--active' : ''}`}
                    onClick={() => setSelectedCategory(null)}
                  >
                    {t('storefront.categories.all')}
                  </button>
                  {categories.map(category => (
                    <button
                      key={category.id}
                      type="button"
                      className={`lbc-chip ${selectedCategory === category.slug ? 'lbc-chip--active' : ''}`}
                      onClick={() => setSelectedCategory(category.slug)}
                    >
                      {category.name} · {numberFormatter.format(category.count)}
                    </button>
                  ))}
                </div>
                <div className="storefront-sort">
                  <span className="storefront-sort__label">{t('storefront.sort.label')}</span>
                  <div className="storefront-sort__tabs" role="tablist" aria-label={t('storefront.sort.aria')}>
                    <button
                      type="button"
                      className={`storefront-sort__tab ${listingSort === 'recent' ? 'is-active' : ''}`}
                      onClick={() => setListingSort('recent')}
                      role="tab"
                      aria-selected={listingSort === 'recent'}
                    >
                      {t('storefront.sort.recent')}
                    </button>
                    <button
                      type="button"
                      className={`storefront-sort__tab ${listingSort === 'priceAsc' ? 'is-active' : ''}`}
                      onClick={() => setListingSort('priceAsc')}
                      role="tab"
                      aria-selected={listingSort === 'priceAsc'}
                    >
                      {t('storefront.sort.price')}
                    </button>
                    <button
                      type="button"
                      className={`storefront-sort__tab ${listingSort === 'popular' ? 'is-active' : ''}`}
                      onClick={() => setListingSort('popular')}
                      role="tab"
                      aria-selected={listingSort === 'popular'}
                    >
                      {t('storefront.sort.popular')}
                    </button>
                  </div>
                </div>

                {listingsLoading ? (
                  <div className="storefront-listings-grid">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Card key={index} className="lbc-listing-card is-loading">
                        <Skeleton className="lbc-listing-card__image" />
                        <div className="lbc-listing-card__body">
                          <Skeleton height="18px" width="80%" />
                          <Skeleton height="14px" width="70%" />
                          <Skeleton height="18px" width="40%" />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : listingsError ? (
                  <p style={{ color: '#b91c1c' }}>{listingsError}</p>
                ) : listings.length ? (
                  <div className="storefront-listings-grid">
                    {listings.map(listing => {
                      const cover =
                        listing.images?.find(image => image.isCover) ?? listing.images?.[0]
                      return (
                        <Link key={listing.id} to={`/listing/${listing.id}`} className="lbc-listing-card-link">
                          <Card className="lbc-listing-card">
                          <div
                            className="lbc-listing-card__image"
                            style={cover?.url ? { backgroundImage: `url(${cover.url})` } : undefined}
                          >
                            <div className="lbc-listing-card__badges">
                              {isPopularListing(listing) ? (
                                <span className="lbc-listing-card__badge lbc-listing-card__badge--popular">
                                  🔥 {t('listings.detail.badges.popular')}
                                </span>
                              ) : null}
                              {listing.isBoosted ? (
                                <span className="lbc-listing-card__badge lbc-listing-card__badge--boosted">
                                  ⚡ {t('listings.detail.badges.boosted')}
                                </span>
                              ) : null}
                              {listing.status === 'published' ? (
                                <span className="lbc-listing-card__badge lbc-listing-card__badge--available">
                                  🟢 {t('listings.detail.badges.available')}
                                </span>
                              ) : null}
                            </div>
                            <FavoriteButton listingId={listing.id} className="favorite-toggle--overlay" />
                          </div>
                          <div className="lbc-listing-card__body">
                            <h3>{listing.title}</h3>
                            {listing.publishedAt ? (
                              <p className="lbc-listing-card__meta">
                                {formatListingDate(listing.publishedAt, locale)}
                              </p>
                            ) : null}
                            <p>
                              {getListingLocation(listing, t('listing.locationUnavailable'))} ·{' '}
                              {listing.category?.name ?? t('listing.fallbackCategory')}
                            </p>
                            <p className="lbc-listing-card__price">{formatPrice(listing)}</p>
                          </div>
                          </Card>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#6c757d' }}>{t('storefront.listings.empty')}</p>
                )}
              </Card>

              {storefront.storefrontShowReviews ? (
                <Card className="storefront-card">
                  <div className="storefront-card__head storefront-card__head--stacked">
                    <div>
                      <h2>{t('storefront.reviews.title')}</h2>
                      <span className="storefront-reviews__meta">
                        {t('storefront.reviews.afterChat')}
                      </span>
                    </div>
                    {reviewStats ? (
                      <div className="storefront-reviews__summary">
                        <span className="storefront-reviews__rating">
                          ⭐ {reviewStats.averageRating}
                        </span>
                        <span className="storefront-reviews__sales">
                          {t('storefront.reviews.sales', {
                            count: numberFormatter.format(reviewStats.successfulSales)
                          })}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {reviewStats ? (
                    <div className="storefront-reviews__metrics">
                      <div className="storefront-reviews__metric">
                        <span className="storefront-reviews__metric-icon" aria-hidden>👍</span>
                        <strong>{numberFormatter.format(reviewStats.positiveCount)}</strong>
                        <span>{t('storefront.reviews.positive')}</span>
                      </div>
                      <div className="storefront-reviews__metric">
                        <span className="storefront-reviews__metric-icon" aria-hidden>👎</span>
                        <strong>{numberFormatter.format(reviewStats.negativeCount)}</strong>
                        <span>{t('storefront.reviews.negative')}</span>
                      </div>
                      <div className="storefront-reviews__metric">
                        <span className="storefront-reviews__metric-icon" aria-hidden>✅</span>
                        <strong>{numberFormatter.format(reviewStats.successfulSales)}</strong>
                        <span>{t('storefront.reviews.salesLabel')}</span>
                      </div>
                    </div>
                  ) : null}
                  {reviewsLoading ? (
                    <p style={{ color: '#6c757d' }}>{t('storefront.reviews.loading')}</p>
                  ) : reviews.length ? (
                    <div className="storefront-reviews">
                      {reviews.map(review => (
                        <div key={review.id} className="storefront-review">
                          <div className="storefront-review__header">
                            <strong>{review.reviewer.name}</strong>
                            <span>⭐ {review.rating} / 5</span>
                          </div>
                          {review.location ? (
                            <small>{review.location}</small>
                          ) : null}
                          {review.comment ? <p>{review.comment}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#6c757d' }}>{t('storefront.reviews.empty')}</p>
                  )}
                </Card>
              ) : null}
            </div>

            <aside className="storefront-body__sidebar">
              <Card className="storefront-card storefront-card--stats">
                <h3>{t('storefront.section.stats')}</h3>
                <div className="storefront-stats">
                  <div>
                    <span>{t('storefront.stats.listings')}</span>
                    <strong>{numberFormatter.format(storefront.stats.listingCount)}</strong>
                  </div>
                  <div>
                    <span>{t('storefront.stats.reviews')}</span>
                    <strong>{numberFormatter.format(storefront.stats.totalReviews)}</strong>
                  </div>
                  <div>
                    <span>{t('storefront.stats.rating')}</span>
                    <strong>
                      {storefront.stats.totalReviews
                        ? storefront.stats.averageRating.toFixed(1)
                        : t('storefront.stats.ratingEmpty')}
                    </strong>
                  </div>
                </div>
              </Card>

              <Card className="storefront-card storefront-card--trust">
                <div className="storefront-card__head">
                  <h3>{t('storefront.section.trust')}</h3>
                  <p>{t('storefront.trust.subtitle')}</p>
                </div>
                <div className="storefront-trust">
                  <div className="storefront-trust__item">
                    <span className="storefront-trust__icon" aria-hidden>✅</span>
                    <div>
                      <strong>{identityLabel}</strong>
                      <span>{t('storefront.trust.identityDetail')}</span>
                    </div>
                  </div>
                  <div className="storefront-trust__item">
                    <span className="storefront-trust__icon" aria-hidden>🏪</span>
                    <div>
                      <strong>{addressLabel}</strong>
                      <span>{t('storefront.trust.addressNote')}</span>
                    </div>
                  </div>
                  <div className="storefront-trust__item">
                    <span className="storefront-trust__icon" aria-hidden>📞</span>
                    <div>
                      <strong>{phoneLabel}</strong>
                      <span>{t('storefront.trust.phoneDetail')}</span>
                    </div>
                  </div>
                  <Link to="/faq" className="storefront-trust__link">
                    <span className="storefront-trust__icon" aria-hidden>🛡️</span>
                    <div>
                      <strong>{t('storefront.trust.safetyTitle')}</strong>
                      <span>{t('storefront.trust.safetyNote')}</span>
                    </div>
                    <span className="storefront-trust__arrow" aria-hidden>›</span>
                  </Link>
                </div>
              </Card>
            </aside>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
