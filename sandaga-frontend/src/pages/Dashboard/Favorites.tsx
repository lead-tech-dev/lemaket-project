import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { FavoriteButton } from '../../components/ui/FavoriteButton'
import { apiDelete, apiGet } from '../../utils/api'
import type { Listing } from '../../types/listing'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import { formatListingLocation } from '../../utils/location'
import { useFollowedSellers } from '../../hooks/useFollowedSellers'
import { useAuth } from '../../hooks/useAuth'

type FavoriteItem = {
  id: string
  listing: Listing
}

export default function Favorites() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const { isAuthenticated } = useAuth()
  const { isFollowing, followSeller, unfollowSeller } = useFollowedSellers()
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiGet<FavoriteItem[]>('/favorites', { signal: controller.signal })
      .then(data => {
        setItems(data)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        console.error('Unable to load favorites', err)
        setError(
          err instanceof Error
            ? err.message
            : t('favorites.loadError')
        )
      })
      .finally(() => {
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [t])

  const handleRemove = async (listingId: string) => {
    try {
      await apiDelete(`/favorites/${listingId}`)
      setItems(prev => prev.filter(item => item.listing.id !== listingId))
      addToast({
        variant: 'info',
        title: t('favorites.toast.removedTitle'),
        message: t('favorites.toast.removedMessage')
      })
    } catch (err) {
      console.error('Unable to remove favorite', err)
      addToast({
        variant: 'error',
        title: t('favorites.toast.removeErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('favorites.toast.removeErrorMessage')
      })
    }
  }

  const formatLocation = (listing: Listing) => {
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

  const formatPrice = (listing: Listing) => {
    const numericPrice = Number(listing.price)
    if (Number.isFinite(numericPrice)) {
      try {
        return new Intl.NumberFormat(numberLocale, {
          style: 'currency',
          currency: listing.currency || 'XAF'
        }).format(numericPrice)
      } catch {
        // Ignore and fallback below.
      }
    }
    return [listing.price, listing.currency].filter(Boolean).join(' ')
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('favorites.title')}</h1>
            <p>{t('favorites.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard/alerts')}>
            {t('favorites.cta.alerts')}
          </Button>
        </header>

        <section className="dashboard-section">
          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}

          {isLoading ? (
            <p style={{ padding: '1.5rem 0', color: '#6c757d' }}>
              {t('favorites.loading')}
            </p>
          ) : null}

          {!isLoading && !items.length ? (
            <div className="card" style={{ padding: '24px' }}>
              <h2>{t('favorites.empty.title')}</h2>
              <p>{t('favorites.empty.description')}</p>
              <Button
                onClick={() => {
                  navigate('/search')
                }}
              >
                {t('favorites.empty.cta')}
              </Button>
            </div>
          ) : null}

          {items.length ? (
            <div className="favorites-grid">
              {items.map(favorite => (
                <div
                  key={favorite.id}
                  className="card listing-card--compact listing-card--clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/listing/${favorite.listing.id}`)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate(`/listing/${favorite.listing.id}`)
                    }
                  }}
                >
                  <div className="listing-card__thumb">
                    <FavoriteButton
                      listingId={favorite.listing.id}
                      initial
                      className="favorite-toggle--overlay"
                      onChange={isFavorite => {
                        if (!isFavorite) {
                          setItems(prev => prev.filter(item => item.id !== favorite.id))
                        }
                      }}
                    />
                  </div>
                  <div className="listing-card__content">
                    <h3>{favorite.listing.title}</h3>
                    {getOwnerProfileUrl(favorite.listing) && getOwnerName(favorite.listing) ? (
                      <button
                        type="button"
                        className="listing-seller-link"
                        onClick={event => {
                          event.preventDefault()
                          event.stopPropagation()
                          navigate(getOwnerProfileUrl(favorite.listing)!)
                        }}
                      >
                        {getOwnerName(favorite.listing)}
                      </button>
                    ) : null}
                    <p className="listing-card__price">
                      {formatPrice(favorite.listing)}
                    </p>
                    <p className="listing-card__location">{formatLocation(favorite.listing)}</p>
                    <div
                      className="auth-form__actions"
                      style={{ justifyContent: 'flex-start', gap: '12px' }}
                    >
                      <Button
                        variant="ghost"
                        onClick={event => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleRemove(favorite.listing.id)
                        }}
                      >
                        {t('favorites.actions.remove')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </DashboardLayout>
  )
}
