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
  getListingLocation: (listing: Listing) => string
  getOwnerProfileUrl: (listing: Listing) => string | null
  getOwnerName: (listing: Listing) => string
  formatListingDate: (value: string | null | undefined) => string | null
  onOwnerNavigate: (url: string) => void
  onPageChange: (page: number) => void
  hasActiveFilters: boolean
  hasLocationSelection: boolean
  didYouMean: { label: string; query: string } | null
  quickSuggestionQueries: { id: string; label: string; query: string }[]
  onApplyDidYouMean: (query: string) => void
  onApplyQuickSuggestion: (query: string) => void
  onResetFilters: () => void
  onClearLocation: () => void
  onCreateAlert: () => void
  isCreatingAlert: boolean
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
  getListingLocation,
  getOwnerProfileUrl,
  getOwnerName,
  formatListingDate,
  onOwnerNavigate,
  onPageChange,
  hasActiveFilters,
  hasLocationSelection,
  didYouMean,
  quickSuggestionQueries,
  onApplyDidYouMean,
  onApplyQuickSuggestion,
  onResetFilters,
  onClearLocation,
  onCreateAlert,
  isCreatingAlert
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
              {didYouMean ? (
                <p className="search-empty__did-you-mean">
                  {t('search.didYouMean.prefix')}{' '}
                  <button
                    type="button"
                    className="search-empty__link"
                    onClick={() => onApplyDidYouMean(didYouMean.query)}
                  >
                    {didYouMean.label}
                  </button>
                  {' ?'}
                </p>
              ) : null}

              {quickSuggestionQueries.length > 0 ? (
                <div className="search-empty__suggestions">
                  <span className="search-empty__suggestions-label">{t('search.results.tryAlso')}</span>
                  <div className="search-empty__suggestions-list">
                    {quickSuggestionQueries.slice(0, 4).map(item => (
                      <Button
                        key={item.id}
                        variant="ghost"
                        className="search-empty__chip"
                        onClick={() => onApplyQuickSuggestion(item.query)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {hasActiveFilters || hasLocationSelection ? (
                <div className="search-empty__actions">
                  {hasLocationSelection ? (
                    <Button variant="ghost" onClick={onClearLocation}>
                      {t('search.results.expandLocation')}
                    </Button>
                  ) : null}
                  {hasActiveFilters ? (
                    <Button variant="outline" onClick={onResetFilters}>
                      {t('search.results.resetFilters')}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <Button variant="outline" onClick={onCreateAlert} disabled={isCreatingAlert}>
                {t('search.alert.create')}
              </Button>
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
                      {listing.isPremium ? (
                        <span className="search-result__badge search-result__badge--featured">
                          Premium
                        </span>
                      ) : null}
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
