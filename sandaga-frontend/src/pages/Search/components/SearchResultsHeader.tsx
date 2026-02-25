import type { RefObject } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { LocationPinIcon } from '../../../components/ui/LocationPinIcon'
import { RADIUS_OPTIONS } from '../../../constants/filters'
import type { LocationSuggestion, SearchViewMode } from '../types'

type Translate = (key: string, params?: Record<string, string | number>) => string

type SearchResultsHeaderProps = {
  t: Translate
  term: string
  city: string
  page: number
  hasResults: boolean
  headerCountLabel: string
  filtersOpen: boolean
  isCreatingAlert: boolean
  viewMode: SearchViewMode
  hasLocationSelection: boolean
  selectedRadius: string
  locationQuery: string
  locationOpen: boolean
  locationSuggestions: LocationSuggestion[]
  locationLoading: boolean
  locationError: string | null
  locationWrapperRef: RefObject<HTMLDivElement>
  locationInputRef: RefObject<HTMLInputElement>
  onLocationQueryChange: (value: string) => void
  onLocationOpenChange: (open: boolean) => void
  onLocationCommit: () => void
  onLocationClear: () => void
  onLocationSelect: (suggestion: LocationSuggestion) => void
  onRadiusChange: (value: string) => void
  onViewModeChange: (mode: SearchViewMode) => void
  onOpenFilters: () => void
  onCreateAlert: () => void
}

export function SearchResultsHeader({
  t,
  term,
  city,
  page,
  hasResults,
  headerCountLabel,
  filtersOpen,
  isCreatingAlert,
  viewMode,
  hasLocationSelection,
  selectedRadius,
  locationQuery,
  locationOpen,
  locationSuggestions,
  locationLoading,
  locationError,
  locationWrapperRef,
  locationInputRef,
  onLocationQueryChange,
  onLocationOpenChange,
  onLocationCommit,
  onLocationClear,
  onLocationSelect,
  onRadiusChange,
  onViewModeChange,
  onOpenFilters,
  onCreateAlert
}: SearchResultsHeaderProps) {
  return (
    <header className="search-page__header">
      <div className="search-page__header-actions">
        <div className="search-page__location">
          <div className="search-location" ref={locationWrapperRef}>
            <span className="search-location__icon" aria-hidden="true">
              <LocationPinIcon />
            </span>
            <Input
              id="search-location-input"
              ref={locationInputRef}
              className="input search-location__input"
              type="search"
              value={locationQuery}
              placeholder={t('search.location.placeholder')}
              onChange={event => {
                onLocationQueryChange(event.target.value)
                if (!locationOpen) {
                  onLocationOpenChange(true)
                }
              }}
              onFocus={() => onLocationOpenChange(true)}
              onBlur={event => {
                const nextTarget = event.relatedTarget as Node | null
                if (nextTarget && locationWrapperRef.current?.contains(nextTarget)) {
                  return
                }
                if (!locationQuery.trim()) {
                  return
                }
                onLocationCommit()
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onLocationCommit()
                }
              }}
            />
            {locationQuery ? (
              <button
                type="button"
                className="search-location__clear"
                onClick={onLocationClear}
                aria-label={t('search.location.clear')}
              >
                ×
              </button>
            ) : null}
            {locationOpen ? (
              <div className="search-location__panel">
                <span className="search-location__title">{t('search.location.suggestions')}</span>
                {locationLoading ? (
                  <p className="search-location__hint">{t('search.location.loading')}</p>
                ) : null}
                {locationError ? (
                  <p className="search-location__error" role="alert">
                    {locationError}
                  </p>
                ) : null}
                {!locationLoading &&
                !locationError &&
                locationSuggestions.length === 0 &&
                locationQuery.trim().length >= 3 ? (
                  <p className="search-location__hint">{t('search.location.empty')}</p>
                ) : null}
                {locationSuggestions.map(suggestion => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="search-location__item"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => onLocationSelect(suggestion)}
                  >
                    <span className="search-location__marker" aria-hidden="true">
                      <LocationPinIcon />
                    </span>
                    <span className="search-location__text">
                      <span className="search-location__label">{suggestion.label}</span>
                      {suggestion.context ? (
                        <span className="search-location__meta">{suggestion.context}</span>
                      ) : null}
                    </span>
                    <span className="search-location__arrow" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {hasLocationSelection ? (
            <div className="search-location__radius">
              <span className="search-location__radius-title">{t('filters.radius.label')}</span>
              <div className="lbc-filter-chips" role="group" aria-label={t('filters.radius.aria')}>
                {RADIUS_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`lbc-chip ${selectedRadius === option.value ? 'lbc-chip--active' : ''}`}
                    onClick={() => onRadiusChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="search-page__header-buttons">
          <div className="search-view-toggle" role="group" aria-label={t('search.view.aria')}>
            <button
              type="button"
              className={`btn btn--ghost search-view-toggle__btn ${viewMode === 'list' ? 'is-active' : ''}`}
              onClick={() => onViewModeChange('list')}
              aria-pressed={viewMode === 'list'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span>{t('search.view.list')}</span>
            </button>
            <button
              type="button"
              className={`btn btn--ghost search-view-toggle__btn ${viewMode === 'grid' ? 'is-active' : ''}`}
              onClick={() => onViewModeChange('grid')}
              aria-pressed={viewMode === 'grid'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h7v7H4zM13 5h7v7h-7zM4 12h7v7H4zM13 12h7v7h-7z" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>{t('search.view.grid')}</span>
            </button>
          </div>
          <div className="search-page__quick-actions">
            <Button
              type="button"
              variant="ghost"
              className="search-page__filters-toggle"
              onClick={onOpenFilters}
              aria-expanded={filtersOpen}
              aria-controls="search-filters-drawer"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              {t('search.filters.button')}
            </Button>
            <Button
              variant="outline"
              className="search-page__alert-button"
              onClick={onCreateAlert}
              disabled={isCreatingAlert}
            >
              {isCreatingAlert ? t('search.alert.saving') : t('search.alert.create')}
            </Button>
          </div>
        </div>
      </div>
      <div className="search-page__header-content">
        <h1>{t('search.header.title')}</h1>
        <p>
          {term ? (
            <>
              <strong>{term}</strong> —
            </>
          ) : null}{' '}
          {headerCountLabel}
          {city ? (
            <>
              {' '}
              {t('search.header.near')} <strong>{city}</strong>
            </>
          ) : null}
          {hasResults ? <> {t('search.header.page', { page })}</> : null}
        </p>
      </div>
    </header>
  )
}
