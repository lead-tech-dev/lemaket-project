import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { SwitchTheme } from './ui/SwitchTheme'
import { LocaleSwitcher } from './ui/LocaleSwitcher'
import { useMessageNotifications } from '../hooks/useMessageNotifications'
import { useFeatureFlagsContext } from '../contexts/FeatureFlagContext'
import { useCategories } from '../hooks/useCategories'
import { useI18n } from '../contexts/I18nContext'
import { apiGet } from '../utils/api'
import { Logo, Icon } from './ds'
import * as HS from './Header.styles'

type RecentSearchItem = {
  label: string
  subtitle: string
  to: string
}

type QuerySuggestionItem = {
  id: string
  label: string
  query: string
  resultCount: number
  hits: number
}

type QuerySuggestionSource = 'recent' | 'trending' | 'history'

type HeaderQuerySuggestion = {
  id: string
  label: string
  query: string
  resultCount: number
  hits: number
  source: QuerySuggestionSource
}

const normalizeSuggestionKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

const isValidSuggestionQuery = (value: string) =>
  value.trim().length >= 2 && /[a-z]/i.test(value)

export default function Header(){
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const unreadTotal = useMessageNotifications()
  const { isEnabled } = useFeatureFlagsContext()
  const messagingEnabled = isEnabled('proMessaging')
  const { categories, isLoading: categoriesLoading, error: categoriesError } = useCategories({ activeOnly: false })
  const { t, locale, setLocale } = useI18n()
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
  const [trendingSearches, setTrendingSearches] = useState<QuerySuggestionItem[]>([])
  const [historySuggestions, setHistorySuggestions] = useState<QuerySuggestionItem[]>([])
  const [historySuggestionsLoading, setHistorySuggestionsLoading] = useState(false)
  const historyDebounceRef = useRef<number | null>(null)
  const historyAbortRef = useRef<AbortController | null>(null)

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
    if (!searchOpen || trendingSearches.length > 0) {
      return
    }

    const controller = new AbortController()
    apiGet<QuerySuggestionItem[]>('/home/trending-searches', {
      signal: controller.signal,
      silent: true
    })
      .then(items => {
        if (controller.signal.aborted) {
          return
        }
        setTrendingSearches(Array.isArray(items) ? items : [])
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTrendingSearches([])
        }
      })

    return () => {
      controller.abort()
    }
  }, [searchOpen, trendingSearches.length])

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
  useEffect(() => {
    if (!searchOpen || normalizedQuery.length < 2) {
      if (historyDebounceRef.current) {
        window.clearTimeout(historyDebounceRef.current)
        historyDebounceRef.current = null
      }
      if (historyAbortRef.current) {
        historyAbortRef.current.abort()
        historyAbortRef.current = null
      }
      setHistorySuggestions([])
      setHistorySuggestionsLoading(false)
      return
    }

    if (historyDebounceRef.current) {
      window.clearTimeout(historyDebounceRef.current)
    }
    if (historyAbortRef.current) {
      historyAbortRef.current.abort()
    }

    setHistorySuggestionsLoading(true)
    historyDebounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController()
      historyAbortRef.current = controller
      try {
        const items = await apiGet<QuerySuggestionItem[]>(
          `/search/suggestions?q=${encodeURIComponent(normalizedQuery)}&limit=8`,
          {
            signal: controller.signal,
            silent: true
          }
        )
        if (controller.signal.aborted) {
          return
        }
        setHistorySuggestions(Array.isArray(items) ? items : [])
      } catch {
        if (!controller.signal.aborted) {
          setHistorySuggestions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setHistorySuggestionsLoading(false)
        }
      }
    }, 220)

    return () => {
      if (historyDebounceRef.current) {
        window.clearTimeout(historyDebounceRef.current)
        historyDebounceRef.current = null
      }
      if (historyAbortRef.current) {
        historyAbortRef.current.abort()
        historyAbortRef.current = null
      }
    }
  }, [normalizedQuery, searchOpen])

  const querySuggestions = useMemo<HeaderQuerySuggestion[]>(() => {
    const normalizedInput = normalizedQuery
    const recentSuggestions = recentSearches
      .map<HeaderQuerySuggestion | null>(item => {
        const queryString = item.to.includes('?') ? item.to.split('?')[1] ?? '' : ''
        const params = new URLSearchParams(queryString)
        const query = params.get('q')?.trim() ?? ''
        if (!query) {
          return null
        }
        return {
          id: `recent-${query.toLowerCase()}`,
          label: query,
          query,
          resultCount: 0,
          hits: 0,
          source: 'recent'
        }
      })
      .filter((item): item is HeaderQuerySuggestion => Boolean(item?.query))

    const trendingSuggestions: HeaderQuerySuggestion[] = trendingSearches.map(item => ({
      id: `trending-${item.id}`,
      label: item.label,
      query: item.query,
      resultCount: item.resultCount ?? 0,
      hits: item.hits ?? 0,
      source: 'trending'
    }))

    const serverSuggestions: HeaderQuerySuggestion[] = historySuggestions.map(item => ({
      id: `history-${item.id}`,
      label: item.label,
      query: item.query,
      resultCount: item.resultCount ?? 0,
      hits: item.hits ?? 0,
      source: 'history'
    }))

    const candidates = normalizedInput
      ? [...serverSuggestions, ...recentSuggestions, ...trendingSuggestions].filter(item => {
          const normalizedCandidate = item.query.trim().toLowerCase()
          const normalizedLabel = item.label.trim().toLowerCase()
          return (
            normalizedCandidate.includes(normalizedInput) ||
            normalizedLabel.includes(normalizedInput)
          )
        })
      : [...recentSuggestions, ...trendingSuggestions]

    const seen = new Set<string>()
    const scored = candidates
      .map(item => {
        const normalizedCandidate = item.query.trim().toLowerCase()
        let score = 0
        if (normalizedInput) {
          if (normalizedCandidate === normalizedInput) {
            score += 600
          } else if (normalizedCandidate.startsWith(normalizedInput)) {
            score += 340
          } else if (normalizedCandidate.includes(normalizedInput)) {
            score += 180
          }
        }
        if (item.source === 'history') score += 140
        if (item.source === 'recent') score += 120
        if (item.source === 'trending') score += 90
        score += Math.min(item.resultCount, 500) / 10
        score += Math.min(item.hits, 500) / 10

        return { item, score }
      })
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)
      .filter(item => {
        if (!isValidSuggestionQuery(item.query)) {
          return false
        }
        const key = normalizeSuggestionKey(item.query)
        if (!key || seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })

    return scored.slice(0, MAX_SUGGESTIONS)
  }, [historySuggestions, normalizedQuery, recentSearches, trendingSearches])

  const categorySuggestions = useMemo<
    { id: string; slug: string; label: string; parentLabel: string | null }[]
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

  const handleQuerySuggestionClick = (query: string) => {
    const target = buildSearchUrl(query)
    addRecentSearch(target, query)
    navigate(target)
    setSearchOpen(false)
  }

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
    <HS.HeaderEl ref={headerRef}>
      <HS.Bar>
        <HS.Brand to="/" aria-label="Lemaket">
          <Logo size={30} />
        </HS.Brand>

        <HS.SearchBox ref={searchBarRef}>
          <button
            type="button"
            ref={searchToggleRef}
            aria-label={t('header.searchPlaceholder')}
            onClick={() => {
              setSearchOpen(true)
              searchInputRef.current?.focus()
            }}
            style={{ background: 'none', border: 'none', display: 'flex', cursor: 'pointer', padding: 0 }}
          >
            <Icon name="search" size={18} color="#97A199" />
          </button>
          <form onSubmit={handleSearchSubmit} style={{ display: 'contents' }}>
            <input
              ref={searchInputRef}
              id="header-search-input"
              type="search"
              value={searchValue}
              onChange={event => setSearchValue(event.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder={t('header.searchPlaceholder')}
              aria-label={t('header.search')}
            />
          </form>
          {searchValue ? (
            <HS.ClearBtn type="button" aria-label={t('header.search.clear')} onClick={handleClearSearch}>
              ×
            </HS.ClearBtn>
          ) : null}
          <HS.CamBtn
            type="button"
            aria-label={t('header.search')}
            title={t('header.search')}
            onClick={() => navigate('/search/visual')}
          >
            <Icon name="cam" size={17} />
          </HS.CamBtn>

          {showPanel ? (
            <HS.SuggestPanel>
              {normalizedQuery ? (
                <>
                  <HS.SuggestSection>
                    <HS.SuggestTitle>{t('header.search.suggestions')}</HS.SuggestTitle>
                    {historySuggestionsLoading ? (
                      <HS.SuggestEmpty>{t('search.header.loading')}</HS.SuggestEmpty>
                    ) : querySuggestions.length ? (
                      querySuggestions.map(item => (
                        <HS.SuggestItem
                          key={item.id}
                          type="button"
                          onClick={() => handleQuerySuggestionClick(item.query)}
                        >
                          <Icon
                            name={item.source === 'recent' ? 'clock' : item.source === 'trending' ? 'spark' : 'search'}
                            size={16}
                            color="#97A199"
                          />
                          <span>
                            <strong>{item.label}</strong>
                          </span>
                        </HS.SuggestItem>
                      ))
                    ) : (
                      <HS.SuggestEmpty>{t('header.search.empty')}</HS.SuggestEmpty>
                    )}
                  </HS.SuggestSection>
                  {categorySuggestions.length ? (
                    <HS.SuggestSection>
                      <HS.SuggestTitle>{t('header.search.in')}</HS.SuggestTitle>
                      {categorySuggestions.map(item => (
                        <HS.SuggestItem
                          key={item.id}
                          type="button"
                          onClick={() => handleCategorySuggestionClick(item.slug, item.label)}
                        >
                          <Icon name="tag" size={16} color="#97A199" />
                          <span>
                            <strong>{item.label}</strong>
                          </span>
                        </HS.SuggestItem>
                      ))}
                    </HS.SuggestSection>
                  ) : null}
                </>
              ) : (
                <HS.SuggestSection>
                  <HS.SuggestTitle>{t('header.search.recent')}</HS.SuggestTitle>
                  {recentSearches.length ? (
                    recentSearches.map(item => (
                      <HS.SuggestItem
                        key={item.to}
                        type="button"
                        onClick={() => {
                          navigate(item.to)
                          setSearchOpen(false)
                        }}
                      >
                        <Icon name="clock" size={16} color="#97A199" />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.subtitle}</small>
                        </span>
                      </HS.SuggestItem>
                    ))
                  ) : (
                    <HS.SuggestEmpty>{t('header.search.noRecent')}</HS.SuggestEmpty>
                  )}
                </HS.SuggestSection>
              )}
            </HS.SuggestPanel>
          ) : null}
        </HS.SearchBox>

        <HS.Spacer />

        <HS.LangToggle>
          {(['fr', 'en'] as const).map(l => (
            <button key={l} type="button" data-active={locale === l} onClick={() => setLocale(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </HS.LangToggle>

        <SwitchTheme />

        <HS.IconBtn
          type="button"
          aria-label={t('header.notifications')}
          onClick={() => navigate('/dashboard/alerts')}
        >
          <Icon name="bell" size={20} />
          <HS.Dot />
        </HS.IconBtn>

        <HS.ActionLink to="/dashboard">
          <Icon name="grid" size={18} /> {t('header.space')}
        </HS.ActionLink>
        <HS.ActionLink to="/dashboard/favorites">
          <Icon name="heart" size={19} /> {t('header.favorites')}
        </HS.ActionLink>
        {messagingEnabled && Boolean(user) ? (
          <HS.ActionLink to="/dashboard/messages">
            <Icon name="chat" size={19} /> {t('header.messages')}
            {unreadTotal ? (
              <HS.Badge aria-label={unreadLabel}>{unreadTotal > 99 ? '99+' : unreadTotal}</HS.Badge>
            ) : null}
          </HS.ActionLink>
        ) : null}
        {user ? (
          <HS.ActionLink to="/dashboard">
            <Icon name="user" size={19} /> {user.firstName}
            {isAdmin ? <HS.Badge>{t('header.badge.admin')}</HS.Badge> : null}
          </HS.ActionLink>
        ) : (
          <HS.ActionLink to="/login">
            <Icon name="user" size={19} /> {t('header.login')}
          </HS.ActionLink>
        )}

        <HS.PostBtn to="/listings/new">
          <Icon name="plus" size={17} color="#fff" /> {t('header.postListing')}
        </HS.PostBtn>

        <HS.IconToggle
          type="button"
          aria-label={t('header.search')}
          onClick={() => {
            setSearchOpen(true)
            searchInputRef.current?.focus()
          }}
        >
          <Icon name="search" size={20} />
        </HS.IconToggle>
        <HS.IconToggle
          ref={mobileMenuToggleRef}
          type="button"
          data-testid="header-menu-toggle"
          aria-expanded={mobileMenuOpen}
          aria-controls="header-mobile-menu"
          aria-label={mobileMenuOpen ? t('header.mobile.close') : t('header.mobile.open')}
          onClick={toggleMobileMenu}
        >
          <Icon name="menu" size={22} />
        </HS.IconToggle>
      </HS.Bar>

      <HS.NavBar>
        <HS.NavInner>
          {navLinks.map(link => (
            <HS.NavLink key={link.label} to={link.to}>
              {link.label}
            </HS.NavLink>
          ))}
          <HS.NavCta to="/search">
            {t('header.allCategories')} <Icon name="chevR" size={14} />
          </HS.NavCta>
        </HS.NavInner>
      </HS.NavBar>

      <HS.MobilePills>
        {navLinks.map(link => (
          <HS.NavLink key={link.label} to={link.to} style={{ borderBottom: 'none', whiteSpace: 'nowrap' }}>
            {link.label}
          </HS.NavLink>
        ))}
      </HS.MobilePills>

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
                {messagingEnabled && Boolean(user) ? (
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
    </HS.HeaderEl>
  )
}
