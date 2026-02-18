import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { Card } from '../../components/ui/Card'
import { RetryBanner } from '../../components/ui/RetryBanner'
import { apiGet } from '../../utils/api'
import type { HomeStorefront } from '../../types/home'
import { useI18n } from '../../contexts/I18nContext'
import { resolveMediaUrl } from '../../utils/media'

const LIST_LIMIT = 24

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`skeleton ${className ?? ''}`} aria-hidden="true" />
)

export default function StorefrontsPage() {
  const { t, locale } = useI18n()
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const [storefronts, setStorefronts] = useState<HomeStorefront[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    apiGet<HomeStorefront[]>(`/home/storefronts?limit=${LIST_LIMIT}`, {
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
        setError(err instanceof Error ? err.message : t('storefronts.error'))
      })
      .finally(() => {
        if (controller.signal.aborted) {
          return
        }
        setLoading(false)
      })

    return () => controller.abort()
  }, [t])

  return (
    <MainLayout>
      <div className="lbc-home">
        <section className="lbc-section lbc-section--storefronts">
          <div className="lbc-section__head">
            <div>
              <h1>{t('storefronts.title')}</h1>
              <p>{t('storefronts.subtitle')}</p>
            </div>
          </div>
          {loading ? (
            <div className="lbc-storefronts">
              {Array.from({ length: 6 }).map((_, index) => (
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
          ) : error ? (
            <RetryBanner
              title={t('storefronts.errorTitle')}
              message={error}
              accessory="⚠️"
              onRetry={() => window.location.reload()}
            />
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
                      <Link to={`/store/${storefront.slug}`} className="lbc-link lbc-link--bold">
                        {t('home.storefronts.view')}
                      </Link>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <p style={{ padding: '0.75rem 0', color: '#6c757d' }}>
              {t('storefronts.empty')}
            </p>
          )}
        </section>
      </div>
    </MainLayout>
  )
}
