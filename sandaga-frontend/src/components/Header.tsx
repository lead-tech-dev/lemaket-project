import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { SwitchTheme } from './ui/SwitchTheme'
import { LocaleSwitcher } from './ui/LocaleSwitcher'
import { useMessageNotifications } from '../hooks/useMessageNotifications'
import { useFeatureFlagsContext } from '../contexts/FeatureFlagContext'
import { useCategories } from '../hooks/useCategories'
import { useI18n } from '../contexts/I18nContext'
import lemaketIcon from '../assets/icons/lemaket-icon.svg'

type RecentSearchItem = {
  label: string
  subtitle: string
  to: string
}

export default function Header(){
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isPro, isAdmin } = useAuth()
  const unreadTotal = useMessageNotifications()
  const { isEnabled } = useFeatureFlagsContext()
  const messagingEnabled = isEnabled('proMessaging')
  const proPortalEnabled = isEnabled('proPortal')
  const { categories, isLoading: categoriesLoading, error: categoriesError } = useCategories({ activeOnly: false })
  const { t } = useI18n()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [searchTitleOnly, setSearchTitleOnly] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileExpandedCategory, setMobileExpandedCategory] = useState<string | null>(null)
  const headerRef = useRef<HTMLElement | null>(null)
  const searchBarRef = useRef<HTMLDivElement | null>(null)
  const searchToggleRef = useRef<HTMLButtonElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const mobileMenuToggleRef = useRef<HTMLButtonElement | null>(null)
  const mobileMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const unreadLabel =
    unreadTotal === 1
      ? t('header.unread.single', { count: unreadTotal })
      : t('header.unread.multiple', { count: unreadTotal })

const navLinks = useMemo(() => {
    if (categoriesLoading || categoriesError) {
      return []
    }
    const rootCategories = categories.filter(
      category => !category.parentId
    )

    const source = rootCategories.length ? rootCategories : categories

  return source.map(category => ({
    label: category.name,
    to: `/search?category=${category.slug ?? category.id}`,
    children: (category.children ?? [])
        .map(child => ({
          label: child.name,
          to: `/search?category=${child.slug ?? child.id}`
        }))
    }))
  }, [categories, categoriesError, categoriesLoading])

  const primaryNavLinks = navLinks.slice(0, 8)
  const overflowNavLinks = navLinks.slice(8)

  const isSearchLinkActive = useCallback((to: string) => {
    const [targetPath, targetQuery = ''] = to.split('?')
    if (location.pathname !== targetPath) {
      return false
    }
    const targetCategory = new URLSearchParams(targetQuery).get('category')
    const currentCategory = new URLSearchParams(location.search).get('category')
    if (targetCategory) {
      return currentCategory === targetCategory
    }
    return !currentCategory
  }, [location.pathname, location.search])

  const isMobileLinkActive = useCallback((to: string) => {
    if (to === '/') {
      return location.pathname === '/'
    }
    if (to.startsWith('/search')) {
      return isSearchLinkActive(to)
    }
    if (to === '/dashboard') {
      return location.pathname.startsWith('/dashboard')
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }, [isSearchLinkActive, location.pathname])

  const activeMobileCategoryLabel = useMemo(() => {
    for (const link of navLinks) {
      if (isMobileLinkActive(link.to) || link.children.some(child => isMobileLinkActive(child.to))) {
        return link.label
      }
    }
    return null
  }, [isMobileLinkActive, navLinks])

  const MAX_SUGGESTIONS = 7
  const RECENT_SEARCHES_KEY = 'lemaket.recentSearches.v2'
  const MAX_RECENT_SEARCHES = 6
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([])

  const categoryLabelBySlug = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(category => {
      map.set(category.slug, category.name)
      ;(category.children ?? []).forEach(child => {
        map.set(child.slug, child.name)
      })
    })
    return map
  }, [categories])

  const buildRecentSearchItem = useCallback(
    (to: string, fallbackLabel?: string): RecentSearchItem => {
      const queryString = to.includes('?') ? to.split('?')[1] ?? '' : ''
      const params = new URLSearchParams(queryString)
      const term = params.get('q')?.trim() ?? ''
      const categorySlug = params.get('category')?.trim() ?? ''
      const city = params.get('l')?.trim() ?? ''
      const radius = params.get('radius')?.trim() ?? params.get('radiusKm')?.trim() ?? ''

      let label = fallbackLabel?.trim() ?? ''
      if (!label) {
        if (term) {
          label = term
        } else if (categorySlug) {
          label = categoryLabelBySlug.get(categorySlug) ?? t('header.allCategories')
        } else {
          label = t('header.allCategories')
        }
      }

      let subtitle = t('header.search.recentEverywhere')
      if (city && radius) {
        subtitle = t('header.search.recentAroundWithRadius', {
          location: city,
          radius
        })
      } else if (city) {
        subtitle = t('header.search.recentAround', { location: city })
      }

      return { label, subtitle, to }
    },
    [categoryLabelBySlug, t]
  )

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY)
      if (!raw) {
        return
      }
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        return
      }
      const normalized = parsed
        .filter((item): item is RecentSearchItem =>
          Boolean(
            item &&
            typeof item === 'object' &&
            typeof item.label === 'string' &&
            typeof item.subtitle === 'string' &&
            typeof item.to === 'string'
          )
        )
        .slice(0, MAX_RECENT_SEARCHES)
      setRecentSearches(normalized)
    } catch {
      setRecentSearches([])
    }
  }, [])

  const persistRecentSearches = useCallback((items: RecentSearchItem[]) => {
    setRecentSearches(items)
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items))
    } catch {
      // ignore storage errors
    }
  }, [])

  const addRecentSearch = useCallback(
    (to: string, fallbackLabel?: string) => {
      if (!to || to === '/search') {
        return
      }
      const item = buildRecentSearchItem(to, fallbackLabel)
      const next = [item, ...recentSearches.filter(entry => entry.to !== to)].slice(
        0,
        MAX_RECENT_SEARCHES
      )
      persistRecentSearches(next)
    },
    [buildRecentSearchItem, persistRecentSearches, recentSearches]
  )

  const removeRecentSearch = useCallback(
    (to: string) => {
      const next = recentSearches.filter(item => item.to !== to)
      persistRecentSearches(next)
    },
    [persistRecentSearches, recentSearches]
  )

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
    setMobileExpandedCategory(null)
  }, [])

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(previous => {
      const next = !previous
      if (next) {
        setSearchOpen(false)
        setMobileExpandedCategory(activeMobileCategoryLabel)
      }
      return next
    })
  }, [activeMobileCategoryLabel])

  useEffect(() => {
    setMobileMenuOpen(false)
    setMobileExpandedCategory(null)
  }, [location.hash, location.pathname, location.search])

  useEffect(() => {
    if (!mobileMenuOpen) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!mobileMenuOpen) {
      mobileMenuToggleRef.current?.focus()
      return
    }

    const panel = mobileMenuPanelRef.current
    if (!panel) {
      return
    }

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',')

    const focusableElements = Array.from(
      panel.querySelectorAll<HTMLElement>(focusableSelector)
    ).filter(element => !element.hasAttribute('disabled'))

    focusableElements[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return
      }
      if (!focusableElements.length) {
        event.preventDefault()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    panel.addEventListener('keydown', handleKeyDown)

    return () => {
      panel.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 960) {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const value = params.get('titleOnly')
    setSearchTitleOnly(value === '1' || value === 'true')
  }, [location.search])

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) {
        setSearchOpen(false)
        return
      }
      const withinSearch =
        Boolean(searchBarRef.current?.contains(target)) ||
        Boolean(searchToggleRef.current?.contains(target))
      if (withinSearch) {
        return
      }
      if (headerRef.current?.contains(target)) {
        setSearchOpen(false)
        return
      }
      setSearchOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [searchOpen])

  const buildSearchUrl = (queryTerm?: string, categorySlug?: string) => {
    const params = new URLSearchParams()
    const trimmed = queryTerm?.trim() ?? ''
    if (trimmed) {
      params.set('q', trimmed)
    }
    if (categorySlug) {
      params.set('category', categorySlug)
    }
    if (searchTitleOnly) {
      params.set('titleOnly', '1')
    }
    const queryString = params.toString()
    return queryString ? `/search?${queryString}` : '/search'
  }

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const target = buildSearchUrl(searchValue)
    addRecentSearch(target, searchValue.trim())
    navigate(target)
    setSearchOpen(false)
  }

  const handleClearSearch = () => {
    setSearchValue('')
    searchInputRef.current?.focus()
  }

  const normalizedQuery = searchValue.trim().toLowerCase()
  const categorySuggestions = useMemo<
    Array<{ id: string; slug: string; label: string; parentLabel: string | null }>
  >(() => {
    if (categoriesLoading || categoriesError || !categories.length) {
      return []
    }

    if (!normalizedQuery) {
      return []
    }

    const bySlug = new Map<string, { id: string; slug: string; label: string; parentLabel: string | null }>()

    categories.forEach(category => {
      bySlug.set(category.slug, {
        id: category.id,
        slug: category.slug,
        label: category.name,
        parentLabel: null
      })
      ;(category.children ?? []).forEach(child => {
        bySlug.set(child.slug, {
          id: child.id,
          slug: child.slug,
          label: child.name,
          parentLabel: category.name
        })
      })
    })

    return Array.from(bySlug.values())
      .filter(category =>
        category.label.toLowerCase().includes(normalizedQuery) ||
        (category.parentLabel ?? '').toLowerCase().includes(normalizedQuery)
      )
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, MAX_SUGGESTIONS)
  }, [categories, categoriesError, categoriesLoading, normalizedQuery])

  const showPanel = searchOpen

  const handleCategorySuggestionClick = (
    categorySlug: string,
    categoryLabel: string
  ) => {
    const target = buildSearchUrl(searchValue, categorySlug)
    addRecentSearch(target, searchValue.trim() || categoryLabel)
    navigate(target)
    setSearchOpen(false)
  }

  return (
    <header className="lbc-header" ref={headerRef}>
      <div className="container lbc-header__inner">
        <div className="lbc-header__brand">
          <Link to="/" className="lbc-logo">
            <img src={lemaketIcon} alt="" aria-hidden className="lbc-logo__icon" />
            <span className="lbc-logo__text">LEMAKET</span>
          </Link>
          <span className="lbc-header__tag">{t('header.tagline')}</span>
        </div>
        <div className="lbc-header__center">
          <button
            type="button"
            className="lbc-header__search-trigger"
            ref={searchToggleRef}
            onClick={() => setSearchOpen(prev => !prev)}
            aria-expanded={searchOpen}
            aria-controls="header-search-input"
          >
            <span aria-hidden className="lbc-header__search-trigger-icon">🔎</span>
            <span className="lbc-header__search-trigger-label">{t('header.searchPlaceholder')}</span>
          </button>
        </div>

        <div className="lbc-header__actions">
          <div className="lbc-header__actions-main">
            <Link to="/listings/new" className="btn btn--primary">{t('header.postListing')}</Link>
            <Link to="/dashboard/favorites" className="lbc-header__pill">
              <span aria-hidden>⭐</span>
              <span>{t('header.favorites')}</span>
            </Link>
            {messagingEnabled && isPro ? (
              <Link to="/dashboard/messages" className="lbc-header__pill">
                <span aria-hidden>💬</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {t('header.messages')}
                  {unreadTotal ? (
                    <span
                      className="lbc-header__badge lbc-header__badge--alert"
                      aria-label={unreadLabel}
                    >
                      {unreadTotal > 99 ? '99+' : unreadTotal}
                    </span>
                  ) : null}
                </span>
              </Link>
            ) : null}
            {user ? (
              <Link to="/dashboard" className="lbc-header__pill lbc-header__pill--user">
                <span aria-hidden>👤</span>
                <span>
                  {user.firstName}
                  {isAdmin ? (
                    <span className="lbc-header__badge">{t('header.badge.admin')}</span>
                  ) : isPro ? (
                    <span className="lbc-header__badge">{t('header.badge.pro')}</span>
                  ) : null}
                </span>
              </Link>
            ) : (
              <Link to="/login" className="lbc-header__pill">
                <span aria-hidden>👤</span>
                <span>{t('header.login')}</span>
              </Link>
            )}
          </div>
          <div className="lbc-header__actions-preferences">
            <LocaleSwitcher />
            <SwitchTheme />
          </div>
        </div>

        <button
          type="button"
          className="lbc-header__search-mobile-toggle"
          onClick={() => setSearchOpen(prev => !prev)}
          aria-expanded={searchOpen}
          aria-controls="header-search-input"
          aria-label={t('header.search')}
        >
          <span aria-hidden="true">🔎</span>
        </button>
        <button
          type="button"
          className={`lbc-header__menu-toggle${mobileMenuOpen ? ' is-open' : ''}`}
          aria-expanded={mobileMenuOpen}
          aria-controls="header-mobile-menu"
          aria-label={mobileMenuOpen ? t('header.mobile.close') : t('header.mobile.open')}
          onClick={toggleMobileMenu}
          ref={mobileMenuToggleRef}
        >
          <span className="lbc-header__menu-line" aria-hidden="true" />
          <span className="lbc-header__menu-line" aria-hidden="true" />
          <span className="lbc-header__menu-line" aria-hidden="true" />
        </button>
      </div>

      <div className={`lbc-header__search-bar${searchOpen ? ' is-open' : ''}`} ref={searchBarRef}>
        <div className="container lbc-header__search-inner">
          <form onSubmit={handleSearchSubmit} className="lbc-header__search-form">
            <div className="lbc-header__search-control">
              <input
                ref={searchInputRef}
                id="header-search-input"
                className="input lbc-header__search-input"
                type="search"
                value={searchValue}
                onChange={event => setSearchValue(event.target.value)}
                placeholder={t('header.searchPlaceholder')}
                aria-label={t('header.search')}
              />
              {searchValue ? (
                <button
                  type="button"
                  className="lbc-header__search-clear"
                  aria-label={t('header.search.clear')}
                  onClick={handleClearSearch}
                >
                  ×
                </button>
              ) : null}
              <button
                type="submit"
                className="lbc-header__search-submit"
                aria-label={t('header.search')}
              >
                <span aria-hidden="true">⌕</span>
              </button>
            </div>
          </form>
          {showPanel ? (
            <div className="lbc-header__search-panel lbc-header__search-panel--modern">
              {normalizedQuery ? (
                <>
                  <label className="lbc-search-panel__toggle">
                    <input
                      type="checkbox"
                      checked={searchTitleOnly}
                      onChange={event => setSearchTitleOnly(event.target.checked)}
                    />
                    <span>{t('header.search.titleOnly')}</span>
                  </label>

                  <div className="lbc-search-panel__divider" />

                  <div className="lbc-search-panel__section">
                    <span className="lbc-search-panel__title">{t('header.search.suggestions')}</span>

                    {categorySuggestions.length ? (
                      categorySuggestions.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          className="lbc-search-panel__item lbc-search-panel__item--query"
                          onClick={() => handleCategorySuggestionClick(item.slug, item.label)}
                        >
                          <span className="lbc-search-panel__icon" aria-hidden>⌕</span>
                          <span className="lbc-search-panel__label">
                            <strong>{searchValue.trim()}</strong>
                            <span className="lbc-search-panel__in">{t('header.search.in')}</span>
                            <em>{item.label}</em>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="lbc-search-panel__empty">{t('header.search.empty')}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="lbc-search-panel__section">
                  <span className="lbc-search-panel__title">{t('header.search.recent')}</span>
                  {recentSearches.length ? (
                    recentSearches.map(item => (
                      <div key={item.to} className="lbc-search-panel__item-wrap">
                        <button
                          type="button"
                          className="lbc-search-panel__item lbc-search-panel__item--recent"
                          onClick={() => {
                            navigate(item.to)
                            setSearchOpen(false)
                          }}
                        >
                          <span className="lbc-search-panel__icon" aria-hidden>◷</span>
                          <span className="lbc-search-panel__label lbc-search-panel__label--stacked">
                            <strong>{item.label}</strong>
                            <small>{item.subtitle}</small>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="lbc-search-panel__remove"
                          aria-label={t('header.search.removeRecent')}
                          onClick={() => removeRecentSearch(item.to)}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="lbc-search-panel__empty">{t('header.search.noRecent')}</p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="lbc-header__nav-bar">
        <div className="container lbc-header__nav-container">
          <nav className="lbc-header__nav">
            {primaryNavLinks.map(link => (
              <div key={link.label} className="lbc-header__nav-item">
                <Link to={link.to} className="lbc-header__nav-link">{link.label}</Link>
                {link.children.length ? (
                  <div className="lbc-header__nav-dropdown">
                    {link.children.map(child => (
                      <Link key={child.label} to={child.to} className="lbc-header__nav-sublink">
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {overflowNavLinks.length ? (
              <div className="lbc-header__nav-item">
                <button type="button" className="lbc-header__nav-link lbc-header__nav-link--more">
                  {t('header.more')}
                </button>
                <div className="lbc-header__nav-dropdown">
                  {overflowNavLinks.map(link => (
                    <Link key={link.label} to={link.to} className="lbc-header__nav-sublink">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <Link to="/search" className="lbc-header__nav-link lbc-header__nav-link--cta">
              {t('header.allCategories')}
            </Link>
          </nav>
          {proPortalEnabled && isPro ? (
            <Link to="/dashboard/pro" className="lbc-header__cta">{t('header.proSpace')}</Link>
          ) : null}
        </div>
      </div>
      {mobileMenuOpen ? (
        <div className="lbc-header__mobile-drawer" role="presentation">
          <button
            type="button"
            className="lbc-header__mobile-backdrop"
            aria-label={t('header.mobile.close')}
            onClick={closeMobileMenu}
          />
          <div
            id="header-mobile-menu"
            className="lbc-header__mobile-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('header.mobile.menu')}
            ref={mobileMenuPanelRef}
          >
            <div className="lbc-header__mobile-header">
              <strong>{t('header.mobile.menu')}</strong>
              <button
                type="button"
                className="lbc-header__mobile-close"
                aria-label={t('header.mobile.close')}
                onClick={closeMobileMenu}
              >
                ✕
              </button>
            </div>
            <div className="lbc-header__mobile-body">
              <section className="lbc-header__mobile-section">
                <span className="lbc-header__mobile-section-title">{t('header.mobile.actions')}</span>
                {messagingEnabled && isPro ? (
                  <Link
                    to="/dashboard/messages"
                    className={`lbc-header__mobile-link${isMobileLinkActive('/dashboard/messages') ? ' is-active' : ''}`}
                    aria-current={isMobileLinkActive('/dashboard/messages') ? 'page' : undefined}
                    onClick={closeMobileMenu}
                  >
                    <span aria-hidden>💬</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {t('header.messages')}
                      {unreadTotal ? (
                        <span
                          className="lbc-header__badge lbc-header__badge--alert"
                          aria-label={unreadLabel}
                        >
                          {unreadTotal > 99 ? '99+' : unreadTotal}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ) : null}
                <Link
                  to="/dashboard/favorites"
                  className={`lbc-header__mobile-link${isMobileLinkActive('/dashboard/favorites') ? ' is-active' : ''}`}
                  aria-current={isMobileLinkActive('/dashboard/favorites') ? 'page' : undefined}
                  onClick={closeMobileMenu}
                >
                  <span aria-hidden>⭐</span>
                  <span>{t('header.favorites')}</span>
                </Link>
                {user ? (
                  <Link
                    to="/dashboard"
                    className={`lbc-header__mobile-link${isMobileLinkActive('/dashboard') ? ' is-active' : ''}`}
                    aria-current={isMobileLinkActive('/dashboard') ? 'page' : undefined}
                    onClick={closeMobileMenu}
                  >
                    <span aria-hidden>👤</span>
                    <span>
                      {user.firstName}
                      {isAdmin ? (
                        <span className="lbc-header__badge">{t('header.badge.admin')}</span>
                      ) : isPro ? (
                        <span className="lbc-header__badge">{t('header.badge.pro')}</span>
                      ) : null}
                    </span>
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className={`lbc-header__mobile-link${isMobileLinkActive('/login') ? ' is-active' : ''}`}
                    aria-current={isMobileLinkActive('/login') ? 'page' : undefined}
                    onClick={closeMobileMenu}
                  >
                    <span aria-hidden>👤</span>
                    <span>{t('header.login')}</span>
                  </Link>
                )}
                <Link
                  to="/listings/new"
                  className="btn btn--primary lbc-header__mobile-post"
                  aria-current={isMobileLinkActive('/listings/new') ? 'page' : undefined}
                  onClick={closeMobileMenu}
                >
                  {t('header.postListing')}
                </Link>
                {proPortalEnabled && isPro ? (
                  <Link
                    to="/dashboard/pro"
                    className={`lbc-header__mobile-link${isMobileLinkActive('/dashboard/pro') ? ' is-active' : ''}`}
                    aria-current={isMobileLinkActive('/dashboard/pro') ? 'page' : undefined}
                    onClick={closeMobileMenu}
                  >
                    <span aria-hidden>📈</span>
                    <span>{t('header.proSpace')}</span>
                  </Link>
                ) : null}
                <div className="lbc-header__mobile-preferences">
                  <LocaleSwitcher />
                  <SwitchTheme />
                </div>
              </section>
              <nav className="lbc-header__mobile-section" aria-label={t('header.mobile.navigation')}>
                <span className="lbc-header__mobile-section-title">{t('header.mobile.navigation')}</span>
                <Link
                  to="/"
                  className={`lbc-header__mobile-link lbc-header__mobile-link--category${isMobileLinkActive('/') ? ' is-active' : ''}`}
                  aria-current={isMobileLinkActive('/') ? 'page' : undefined}
                  onClick={closeMobileMenu}
                >
                  {t('header.mobile.home')}
                </Link>
                {navLinks.map(link => {
                  const hasActiveChild = link.children.some(child => isMobileLinkActive(child.to))
                  const parentIsActive = isMobileLinkActive(link.to) || hasActiveChild
                  if (!link.children.length) {
                    return (
                      <div key={link.label} className="lbc-header__mobile-nav-item">
                        <Link
                          to={link.to}
                          className={`lbc-header__mobile-link lbc-header__mobile-link--category${parentIsActive ? ' is-active' : ''}`}
                          aria-current={parentIsActive ? 'page' : undefined}
                          onClick={closeMobileMenu}
                        >
                          {link.label}
                        </Link>
                      </div>
                    )
                  }

                  return (
                    <div key={link.label} className="lbc-header__mobile-nav-item">
                      <button
                        type="button"
                        className={`lbc-header__mobile-link lbc-header__mobile-link--category lbc-header__mobile-accordion-trigger${parentIsActive ? ' is-active' : ''}`}
                        aria-expanded={mobileExpandedCategory === link.label}
                        onClick={() => setMobileExpandedCategory(previous => previous === link.label ? null : link.label)}
                      >
                        <span>{link.label}</span>
                        <span className="lbc-header__mobile-chevron" aria-hidden>▾</span>
                      </button>
                      <div className={`lbc-header__mobile-subnav-wrap${mobileExpandedCategory === link.label ? ' is-open' : ''}`}>
                        <div className="lbc-header__mobile-subnav">
                          <Link
                            to={link.to}
                            className={`lbc-header__mobile-sublink lbc-header__mobile-sublink--all${isMobileLinkActive(link.to) ? ' is-active' : ''}`}
                            aria-current={isMobileLinkActive(link.to) ? 'page' : undefined}
                            onClick={closeMobileMenu}
                          >
                            {t('header.mobile.viewCategory', { name: link.label })}
                          </Link>
                          {link.children.map(child => (
                            <Link
                              key={child.label}
                              to={child.to}
                              className={`lbc-header__mobile-sublink${isMobileLinkActive(child.to) ? ' is-active' : ''}`}
                              aria-current={isMobileLinkActive(child.to) ? 'page' : undefined}
                              onClick={closeMobileMenu}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <Link
                  to="/search"
                  className={`lbc-header__mobile-link lbc-header__mobile-link--category${isMobileLinkActive('/search') ? ' is-active' : ''}`}
                  aria-current={isMobileLinkActive('/search') ? 'page' : undefined}
                  onClick={closeMobileMenu}
                >
                  {t('header.allCategories')}
                </Link>
              </nav>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
