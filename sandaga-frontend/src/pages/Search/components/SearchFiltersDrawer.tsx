import type { ReactNode } from 'react'
import type { SearchDrawerView } from '../types'

type Translate = (key: string, params?: Record<string, string | number>) => string

type SearchFiltersDrawerProps = {
  t: Translate
  isOpen: boolean
  view: SearchDrawerView
  title: string
  main: ReactNode
  categoryParents: ReactNode
  categoryChildren: ReactNode
  criteriaList: ReactNode
  criteriaOptions: ReactNode
  onBack: () => void
  onClose: () => void
}

export function SearchFiltersDrawer({
  t,
  isOpen,
  view,
  title,
  main,
  categoryParents,
  categoryChildren,
  criteriaList,
  criteriaOptions,
  onBack,
  onClose
}: SearchFiltersDrawerProps) {
  return (
    <div className={`search-drawer ${isOpen ? 'search-drawer--open' : ''}`} aria-hidden={!isOpen}>
      <button
        type="button"
        className="search-drawer__overlay"
        onClick={onClose}
        aria-label={t('search.filters.close')}
        tabIndex={isOpen ? 0 : -1}
      />
      <div
        className="search-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-filters-title"
        id="search-filters-drawer"
      >
        <div className="search-drawer__header">
          <div className="search-drawer__nav">
            {view !== 'main' ? (
              <button
                type="button"
                className="search-drawer__back"
                onClick={onBack}
                aria-label={t('search.filters.back')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M15 6l-6 6 6 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
            <h2 id="search-filters-title">{title}</h2>
          </div>
          <button
            type="button"
            className="search-drawer__close"
            onClick={onClose}
            aria-label={t('search.filters.close')}
            tabIndex={isOpen ? 0 : -1}
          >
            ×
          </button>
        </div>
        <div className="search-drawer__body">
          {view === 'main' ? main : null}
          {view === 'categoryParents' ? categoryParents : null}
          {view === 'categoryChildren' ? categoryChildren : null}
          {view === 'criteriaList' ? criteriaList : null}
          {view === 'criteriaOptions' ? criteriaOptions : null}
        </div>
      </div>
    </div>
  )
}
