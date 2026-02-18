import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet } from '../utils/api'
import type { Category } from '../types/category'
import type { HomeCategory } from '../types/home'
import { normalizeCategories } from '../utils/categories'
import { useI18n } from '../contexts/I18nContext'

type CacheKey = 'active' | 'all'

type CacheEntry = {
  data: Category[] | null
  error: string | null
  promise: Promise<Category[]> | null
}

const categoriesCache: Record<CacheKey, CacheEntry> = {
  active: { data: null, error: null, promise: null },
  all: { data: null, error: null, promise: null }
}

type UseCategoriesOptions = {
  activeOnly?: boolean
}

type UseCategoriesResult = {
  categories: Category[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Shared hook to load categories from the API, with a lightweight cache so that
 * multiple consumers (header, search, forms) reuse the same payload.
 */
export function useCategories(options: UseCategoriesOptions = {}): UseCategoriesResult {
  const { t } = useI18n()
  const { activeOnly = true } = options
  const cacheKey: CacheKey = activeOnly ? 'active' : 'all'

  const cachedEntry = categoriesCache[cacheKey]

  const [categories, setCategories] = useState<Category[]>(() => cachedEntry.data ?? [])
  const [error, setError] = useState<string | null>(cachedEntry.error)
  const [isLoading, setIsLoading] = useState<boolean>(() => cachedEntry.data === null)
  const [refreshToken, setRefreshToken] = useState(0)

  const endpoint = useMemo(
    () => (activeOnly ? '/categories?active=true' : '/categories'),
    [activeOnly]
  )

  const fetchCategories = useCallback(
    async (signal: AbortSignal) => {
      let lastError: unknown = null

      try {
        const response = await apiGet<Category[]>(endpoint, { signal })
        if (response.length) {
          return normalizeCategories(response)
        }
      } catch (err) {
        lastError = err
      }

      if (activeOnly) {
        try {
          const allCategories = await apiGet<Category[]>('/categories', { signal })
          if (allCategories.length) {
            return normalizeCategories(allCategories)
          }
        } catch (err) {
          lastError = err
        }
      }

      try {
        const fallback = await apiGet<HomeCategory[]>('/home/categories', {
          signal
        })
        const mapped: Category[] = fallback.map(root => ({
          id: root.id,
          name: root.name,
          slug: root.slug,
          description: root.description,
          icon: root.icon,
          color: root.color,
          gradient: root.gradient,
          isActive: true,
          position: 0,
          parentId: root.parentId ?? null,
          extraFields: root.extraFields,
          children: (root.children ?? []).map(child => ({
            id: child.id,
            name: child.name,
            slug: child.slug,
            description: child.description ?? null,
            icon: child.icon ?? null,
            color: child.color ?? null,
            gradient: child.gradient ?? null,
            isActive: true,
            position: 0,
            parentId: child.parentId ?? root.id,
            extraFields: [],
            children: []
          }))
        }))
        return normalizeCategories(mapped)
      } catch (err) {
        lastError = err
      }

      if (lastError) {
        throw lastError
      }
      return []
    },
    [activeOnly, endpoint]
  )

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const cached = categoriesCache[cacheKey]
    setCategories(cached.data ?? [])
    setError(cached.error ?? null)

    const hasCachedData = Array.isArray(cached.data) && cached.data.length > 0
    if (hasCachedData && refreshToken === 0) {
      setIsLoading(false)
      return () => {
        isMounted = false
        controller.abort()
      }
    }

    if (cached.promise && refreshToken === 0) {
      setIsLoading(true)
      cached.promise
        .then(data => {
          if (!isMounted) {
            return
          }
          categoriesCache[cacheKey] = { data, error: null, promise: null }
          setCategories(data)
          setError(null)
          setIsLoading(false)
        })
        .catch(err => {
          if (!isMounted) {
            return
          }
          if (err instanceof DOMException && err.name === 'AbortError') {
            categoriesCache[cacheKey].promise = null
            setIsLoading(false)
            if (!categoriesCache[cacheKey].data) {
              setRefreshToken(token => token + 1)
            }
            return
          }
          const message = err instanceof Error ? err.message : t('categories.loadError')
          console.error('Unable to load categories', err)
          categoriesCache[cacheKey] = {
            data: categoriesCache[cacheKey].data,
            error: message,
            promise: null
          }
          setError(message)
          if (!categoriesCache[cacheKey].data) {
            setCategories([])
          }
          setIsLoading(false)
        })

      return () => {
        isMounted = false
        controller.abort()
      }
    }

    setIsLoading(true)
    setError(null)

    const promise = fetchCategories(controller.signal)
    categoriesCache[cacheKey].promise = promise

    promise
      .then(data => {
        if (!isMounted) {
          return
        }
        categoriesCache[cacheKey] = { data, error: null, promise: null }
        setCategories(data)
        setError(null)
      })
      .catch(err => {
        if (!isMounted) {
          return
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
          categoriesCache[cacheKey].promise = null
          return
        }
        const message = err instanceof Error ? err.message : t('categories.loadError')
        console.error('Unable to load categories', err)
        categoriesCache[cacheKey] = {
          data: categoriesCache[cacheKey].data,
          error: message,
          promise: null
        }
        setError(message)
        if (!categoriesCache[cacheKey].data) {
          setCategories([])
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [cacheKey, fetchCategories, refreshToken])

  const refresh = useCallback(() => {
    setRefreshToken(token => token + 1)
  }, [])

  return {
    categories,
    isLoading,
    error,
    refresh
  }
}
