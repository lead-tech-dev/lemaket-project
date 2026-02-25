import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { FavoriteButton } from '../../../components/ui/FavoriteButton'
import type { Listing } from '../../../types/listing'
import type { SearchViewMode } from '../types'

type Translate = (key: string, params?: Record<string, string | number>) => string

type SearchResultsListProps = {
  t: Translate
  listings: Listing[]
  isLoading: boolean
  error: string | null
  viewMode: SearchViewMode
  page: number
  totalPages: number
  formatPrice: (listing: Listing) => string
  getSellerType: (listing: Listing) => string
  getListingLocation: (listing: Listing) => string
  getOwnerProfileUrl: (listing: Listing) => string | null
  getOwnerName: (listing: Listing) => string
  formatListingDate: (value: string | null | undefined) => string | null
  onOwnerNavigate: (url: string) => void
  onPageChange: (page: number) => void
}

export function SearchResultsList({
  t,
  listings,
  isLoading,
  error,
  viewMode,
  page,
  totalPages,
  formatPrice,
  getSellerType,
  getListingLocation,
  getOwnerProfileUrl,
  getOwnerName,
  formatListingDate,
  onOwnerNavigate,
  onPageChange
}: SearchResultsListProps) {
  return (
    <>
      <section className={`search-page__results ${viewMode === 'grid' ? 'search-page__results--grid' : 'search-page__results--list'}`}>
        {isLoading && !listings.length ? (
          <p className="ui-feedback ui-feedback--padded">{t('search.results.loading')}</p>
        ) : null}

        {error ? (
          <p role="alert" className="ui-feedback ui-feedback--padded ui-feedback--danger">
            {error}
          </p>
        ) : null}

        {!isLoading && !error && listings.length === 0 ? (
          <div className="search-result search-result--empty">
            <div className="search-result__body">
              <h2>{t('search.results.emptyTitle')}</h2>
              <p>{t('search.results.emptyMessage')}</p>
              <Button variant="outline">{t('search.alert.create')}</Button>
            </div>
          </div>
        ) : null}

        {listings.map(listing => {
          const cover = listing.images?.find(image => image.isCover) ?? listing.images?.[0]
          const coverUrl = cover?.url?.trim() ?? ''
          const hasCover = Boolean(coverUrl)
          const ownerProfileUrl = getOwnerProfileUrl(listing)
          const ownerName = getOwnerName(listing)

          return (
            <Link key={listing.id} to={`/listing/${listing.id}`} className="search-result-link">
              <Card className="search-result">
                <div
                  className={`search-result__media${hasCover ? '' : ' is-placeholder'}`}
                  style={hasCover ? { backgroundImage: `url(${coverUrl})` } : undefined}
                >
                  <FavoriteButton listingId={listing.id} className="favorite-toggle--overlay" />
                </div>
                <div className="search-result__body">
                  <header className="search-result__header">
                    <div className="search-result__badges">
                      {listing.isFeatured ? (
                        <span className="search-result__badge search-result__badge--featured">
                          {t('listings.detail.badges.featured')}
                        </span>
                      ) : null}
                      {listing.isBoosted ? (
                        <span className="search-result__badge search-result__badge--boosted">
                          {t('listings.detail.badges.boosted')}
                        </span>
                      ) : null}
                      {listing.owner?.isCompanyVerified ? (
                        <span className="search-result__badge search-result__badge--verified">
                          {t('listings.badge.companyVerified')}
                        </span>
                      ) : null}
                      <span className="search-result__badge search-result__badge--seller">
                        {getSellerType(listing)}
                      </span>
                    </div>
                    <span className="search-result__category">{listing.category?.name ?? t('listing.fallbackCategory')}</span>
                  </header>
                  <h2>{listing.title}</h2>
                  {ownerProfileUrl && ownerName ? (
                    <button
                      type="button"
                      className="listing-seller-link"
                      onClick={event => {
                        event.preventDefault()
                        event.stopPropagation()
                        onOwnerNavigate(ownerProfileUrl)
                      }}
                    >
                      {ownerName}
                    </button>
                  ) : null}
                  {listing.publishedAt ? (
                    <p className="search-result__date">{formatListingDate(listing.publishedAt)}</p>
                  ) : null}
                  <p>{getListingLocation(listing)}</p>
                  <strong>{formatPrice(listing)}</strong>
                </div>
              </Card>
            </Link>
          )
        })}
      </section>

      {totalPages > 1 ? (
        <div className="search-page__pagination">
          <div className="listings-pagination">
            <Button variant="ghost" onClick={() => onPageChange(page - 1)} disabled={page <= 1 || isLoading}>
              {t('pagination.previous')}
            </Button>
            <span>{t('pagination.pageIndicator', { page, total: totalPages })}</span>
            <Button
              variant="ghost"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
