import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import DashboardLayout from '../../layouts/DashboardLayout'
import { FavoriteButton } from '../../components/ui/FavoriteButton'
import { Button, ListingCard, type ListingCardItem } from '../../components/ds'
import { apiGet } from '../../utils/api'
import type { Listing } from '../../types/listing'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import { formatListingLocation } from '../../utils/location'
import { resolveMediaUrl } from '../../utils/media'

type FavoriteItem = {
  id: string
  listing: Listing
}

const Page = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 8px 0 40px;
`

const Head = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  h1 {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 800;
    font-size: ${({ theme }) => theme.typography.h2}px;
    color: ${({ theme }) => theme.text};
    margin: 0 0 4px;
  }
  p {
    color: ${({ theme }) => theme.textSec};
    font-size: 14px;
    margin: 0;
  }
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
`

const Empty = styled.div`
  text-align: center;
  padding: 60px 20px;
  .emoji {
    font-size: 48px;
  }
  h2 {
    font-family: ${({ theme }) => theme.fonts.display};
    color: ${({ theme }) => theme.text};
    margin: 14px 0 6px;
  }
  p {
    color: ${({ theme }) => theme.textSec};
    margin: 0 0 20px;
  }
`

const Feedback = styled.p`
  color: ${({ theme }) => theme.textSec};
  padding: 24px 0;
`

const toCardItem = (listing: Listing, locale: string, fallbackCity: string): ListingCardItem => {
  const numericPrice = Number(listing.price)
  const price = Number.isFinite(numericPrice)
    ? new Intl.NumberFormat(locale).format(numericPrice)
    : String(listing.price)
  const cover = listing.images?.find((img) => img.isCover) ?? listing.images?.[0]
  return {
    id: listing.id,
    title: listing.title,
    price,
    cat: listing.category?.name ?? '',
    city: formatListingLocation(listing.location as never, listing.city || fallbackCity),
    verified: Boolean(listing.owner?.isCompanyVerified),
    boosted: Boolean(listing.isFeatured),
    pro: Boolean(listing.owner?.isPro),
    imageUrl: cover ? resolveMediaUrl(cover.url) : null,
  }
}

export default function Favorites() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiGet<FavoriteItem[]>('/favorites', { signal: controller.signal })
      .then((data) => {
        setItems(data)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        console.error('Unable to load favorites', err)
        setError(err instanceof Error ? err.message : t('favorites.loadError'))
      })
      .finally(() => {
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [t])

  const removeFromList = (listingId: string) => {
    setItems((prev) => prev.filter((item) => item.listing.id !== listingId))
    addToast({
      variant: 'info',
      title: t('favorites.toast.removedTitle'),
      message: t('favorites.toast.removedMessage'),
    })
  }

  return (
    <DashboardLayout>
      <Page className="dashboard-page">
        <Head>
          <div>
            <h1>{t('favorites.title')}</h1>
            <p>{t('favorites.subtitle')}</p>
          </div>
          <Button $kind="ghost" onClick={() => navigate('/dashboard/alerts')}>
            {t('favorites.cta.alerts')}
          </Button>
        </Head>

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading ? <Feedback>{t('favorites.loading')}</Feedback> : null}

        {!isLoading && !items.length ? (
          <Empty>
            <div className="emoji">🤍</div>
            <h2>{t('favorites.empty.title')}</h2>
            <p>{t('favorites.empty.description')}</p>
            <Button onClick={() => navigate('/search')}>{t('favorites.empty.cta')}</Button>
          </Empty>
        ) : null}

        {items.length ? (
          <Grid>
            {items.map((favorite) => (
              <ListingCard
                key={favorite.id}
                item={toCardItem(favorite.listing, numberLocale, t('listing.locationUnavailable'))}
                onOpen={(it) => navigate(`/listing/${it.id}`)}
                favoriteSlot={
                  <FavoriteButton
                    listingId={favorite.listing.id}
                    initial
                    className="favorite-toggle--overlay"
                    onChange={(isFavorite) => {
                      if (!isFavorite) {
                        removeFromList(favorite.listing.id)
                      }
                    }}
                  />
                }
              />
            ))}
          </Grid>
        ) : null}
      </Page>
    </DashboardLayout>
  )
}
