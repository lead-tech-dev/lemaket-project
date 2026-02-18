import { Link, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { SwitchTheme } from './ui/SwitchTheme'
import { LocaleSwitcher } from './ui/LocaleSwitcher'
import { useMessageNotifications } from '../hooks/useMessageNotifications'
import { useFeatureFlagsContext } from '../contexts/FeatureFlagContext'
import { useCategories } from '../hooks/useCategories'
import { useI18n } from '../contexts/I18nContext'
import { apiGet } from '../utils/api'
import { HomeTrendingSearch } from '../types/home'
import omaketIcon from '../assets/icons/omaket-icon.svg'

export default function Header(){
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
  const [searchFocused, setSearchFocused] = useState(false)
  const headerRef = useRef<HTMLElement | null>(null)
  const searchBarRef = useRef<HTMLDivElement | null>(null)
  const searchToggleRef = useRef<HTMLButtonElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
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

  const RECENT_SEARCHES_KEY = 'lemaket.recentSearches'
  const MAX_RECENT_SEARCHES = 6
  const MAX_SUGGESTIONS = 6
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [trendingSearches, setTrendingSearches] = useState<HomeTrendingSearch[]>([])
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [trendingLoaded, setTrendingLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter(item => typeof item === 'string'))
        }
      }
    } catch {
      setRecentSearches([])
    }
  }, [])

  const storeRecentSearches = useCallback((items: string[]) => {
    setRecentSearches(items)
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items))
    } catch {
      // ignore storage errors
    }
  }, [])

  const addRecentSearch = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }
    const next = [trimmed, ...recentSearches.filter(item => item !== trimmed)].slice(0, MAX_RECENT_SEARCHES)
    storeRecentSearches(next)
  }, [recentSearches, storeRecentSearches])

  const clearRecentSearches = useCallback(() => {
    storeRecentSearches([])
  }, [storeRecentSearches])

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    } else {
      setTrendingLoaded(false)
      setSearchFocused(false)
    }
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen || trendingLoaded || trendingLoading) {
      return
    }

    const controller = new AbortController()
    setTrendingLoading(true)
    setTrendingLoaded(true)

    apiGet<HomeTrendingSearch[]>('/home/trending-searches', { signal: controller.signal })
      .then(data => {
        if (Array.isArray(data)) {
          setTrendingSearches(data)
        }
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        console.error('Unable to load trending searches', err)
      })
      .finally(() => setTrendingLoading(false))

    return () => controller.abort()
  }, [searchOpen, trendingLoading, trendingSearches.length])

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

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = searchValue.trim()
    addRecentSearch(value)
    if (value) {
      navigate(`/search?q=${encodeURIComponent(value)}`)
    } else {
      navigate('/search')
    }
    setSearchOpen(false)
  }

  const normalizedQuery = searchValue.trim().toLowerCase()
  const categorySuggestions = useMemo(() => {
    if (categoriesLoading || categoriesError || !categories.length) {
      return []
    }
    const roots = categories.filter(category => !category.parentId)
    const allCategories = categories.flatMap(category => [
      category,
      ...(category.children ?? [])
    ])
    const source = normalizedQuery ? allCategories : roots
    const filtered = normalizedQuery
      ? source.filter(category => category.name.toLowerCase().includes(normalizedQuery))
      : source
    return filtered.slice(0, MAX_SUGGESTIONS).map(category => ({
      id: category.id,
      label: category.name,
      to: `/search?category=${category.slug ?? category.id}`
    }))
  }, [categories, categoriesError, categoriesLoading, normalizedQuery])

  const trendingSuggestions = useMemo(() => {
    if (!trendingSearches.length) {
      return []
    }
    const filtered = normalizedQuery
      ? trendingSearches.filter(item =>
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.query.toLowerCase().includes(normalizedQuery)
      )
      : trendingSearches
    return filtered.slice(0, MAX_SUGGESTIONS)
  }, [normalizedQuery, trendingSearches])

  const showPanel = searchOpen && (
    searchFocused ||
    recentSearches.length > 0 ||
    categorySuggestions.length > 0 ||
    trendingSuggestions.length > 0 ||
    normalizedQuery.length > 0
  )

  const handleNavigate = (to: string, term?: string) => {
    if (term) {
      addRecentSearch(term)
    }
    navigate(to)
    setSearchOpen(false)
  }

  return (
    <header className="lbc-header" ref={headerRef}>
      <div className="container lbc-header__inner">
        <div className="lbc-header__brand">
          <Link to="/" className="lbc-logo">
            <img src={omaketIcon} alt="" aria-hidden className="lbc-logo__icon" />
            <span className="lbc-logo__text">LEMAKET</span>
          </Link>
          <span className="lbc-header__tag">{t('header.tagline')}</span>
        </div>

        <div className="lbc-header__actions">
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
          <button
            type="button"
            className="lbc-header__pill"
            ref={searchToggleRef}
            onClick={() => setSearchOpen(prev => !prev)}
            aria-expanded={searchOpen}
            aria-controls="header-search-input"
          >
            <span aria-hidden>🔎</span>
            <span>{t('header.search')}</span>
          </button>
          <Link to="/dashboard/favorites" className="lbc-header__pill">
            <span aria-hidden>⭐</span>
            <span>{t('header.favorites')}</span>
          </Link>
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
          <Link to="/listings/new" className="btn btn--primary">{t('header.postListing')}</Link>
          <LocaleSwitcher />
          <SwitchTheme />
        </div>
      </div>

      <div className={`lbc-header__search-bar${searchOpen ? ' is-open' : ''}`} ref={searchBarRef}>
        <div className="container lbc-header__search-inner">
          <form onSubmit={handleSearchSubmit}>
            <input
              ref={searchInputRef}
              id="header-search-input"
              className="input lbc-header__search-input"
              type="search"
              value={searchValue}
              onChange={event => setSearchValue(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder={t('header.searchPlaceholder')}
              aria-label={t('header.search')}
            />
          </form>
          {showPanel ? (
            <div className="lbc-header__search-panel">
              {normalizedQuery ? (
                <div className="lbc-search-panel__section">
                  <span className="lbc-search-panel__title">{t('header.search.suggestions')}</span>
                  <button
                    type="button"
                    className="lbc-search-panel__item"
                    onClick={() => handleNavigate(`/search?q=${encodeURIComponent(normalizedQuery)}`, normalizedQuery)}
                  >
                    <span className="lbc-search-panel__icon" aria-hidden>🔎</span>
                    <span className="lbc-search-panel__label">
                      {t('header.search.submit', { term: normalizedQuery })}
                    </span>
                  </button>
                  {trendingSuggestions.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className="lbc-search-panel__item"
                      onClick={() => handleNavigate(`/search?q=${encodeURIComponent(item.query)}`, item.query)}
                    >
                      <span className="lbc-search-panel__icon" aria-hidden>🔥</span>
                      <span className="lbc-search-panel__label">{item.label}</span>
                    </button>
                  ))}
                  {categorySuggestions.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className="lbc-search-panel__item"
                      onClick={() => handleNavigate(item.to, item.label)}
                    >
                      <span className="lbc-search-panel__icon" aria-hidden>🏷️</span>
                      <span className="lbc-search-panel__label">{item.label}</span>
                    </button>
                  ))}
                  {!trendingSuggestions.length && !categorySuggestions.length ? (
                    <p className="lbc-search-panel__empty">{t('header.search.empty')}</p>
                  ) : null}
                </div>
              ) : (
                <>
                  {recentSearches.length ? (
                    <div className="lbc-search-panel__section">
                      <div className="lbc-search-panel__header">
                        <span className="lbc-search-panel__title">{t('header.search.recent')}</span>
                        <button
                          type="button"
                          className="lbc-search-panel__action"
                          onClick={clearRecentSearches}
                        >
                          {t('header.search.clear')}
                        </button>
                      </div>
                      {recentSearches.map(item => (
                        <button
                          key={item}
                          type="button"
                          className="lbc-search-panel__item"
                          onClick={() => handleNavigate(`/search?q=${encodeURIComponent(item)}`, item)}
                        >
                          <span className="lbc-search-panel__icon" aria-hidden>🕘</span>
                          <span className="lbc-search-panel__label">{item}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {trendingSuggestions.length ? (
                    <div className="lbc-search-panel__section">
                      <span className="lbc-search-panel__title">{t('header.search.trending')}</span>
                      {trendingSuggestions.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          className="lbc-search-panel__item"
                          onClick={() => handleNavigate(`/search?q=${encodeURIComponent(item.query)}`, item.query)}
                        >
                          <span className="lbc-search-panel__icon" aria-hidden>🔥</span>
                          <span className="lbc-search-panel__label">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {categorySuggestions.length ? (
                    <div className="lbc-search-panel__section">
                      <span className="lbc-search-panel__title">{t('header.search.suggestions')}</span>
                      {categorySuggestions.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          className="lbc-search-panel__item"
                          onClick={() => handleNavigate(item.to, item.label)}
                        >
                          <span className="lbc-search-panel__icon" aria-hidden>🏷️</span>
                          <span className="lbc-search-panel__label">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {!recentSearches.length && !trendingSuggestions.length && !categorySuggestions.length ? (
                    <p className="lbc-search-panel__empty">{t('header.search.empty')}</p>
                  ) : null}
                </>
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
    </header>
  )
}
