import { useCallback, useEffect, useRef, useState } from 'react'
import type { Category } from '../types/category'
import { apiGet } from '../utils/api'
import { normalizeCategories } from '../utils/categories'
import { useI18n } from '../contexts/I18nContext'

type ApiCategory = Category & { iconUrl?: string | null; icon_url?: string | null }

const resolveIcon = (value: string | null | undefined, alt?: string | null | undefined, alt2?: string | null | undefined) => {
  const candidates = [value, alt, alt2]
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }
  return null
}

const withResolvedIcon = (category: ApiCategory): Category => ({
  ...category,
  icon: resolveIcon(category.icon, category.iconUrl, category.icon_url),
  children: Array.isArray(category.children)
    ? category.children.map(child => ({
        ...child,
        icon: resolveIcon((child as ApiCategory).icon, (child as ApiCategory).iconUrl, (child as ApiCategory).icon_url)
      }))
    : category.children
})

export type UseCategoryHierarchyOptions = {
  activeOnly?: boolean
}

export type UseCategoryHierarchyResult = {
  categories: Category[]
  rootCategories: Category[]
  categoriesLoading: boolean
  categoriesError: string | null
  childrenByParent: Record<string, Category[]>
  childrenLoading: Record<string, boolean>
  loadChildren: (parentId: string) => Promise<Category[]>
  ensureCategoryLoaded: (categoryId: string | null | undefined) => Promise<void>
  setCategoriesError: (error: string | null) => void
}

export function useCategoryHierarchy(
  options: UseCategoryHierarchyOptions = {}
): UseCategoryHierarchyResult {
  const { t } = useI18n()
  const { activeOnly = true } = options

  const [categories, setCategories] = useState<Category[]>([])
  const [rootCategories, setRootCategories] = useState<Category[]>([])
  const [childrenByParent, setChildrenByParent] = useState<Record<string, Category[]>>({})
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [childrenLoading, setChildrenLoading] = useState<Record<string, boolean>>({})
  const detailsLoadedRef = useRef<Set<string>>(new Set())

  const hasAdTypes = useCallback((category: Category) => {
    const direct = (category as any).ad_types ?? (category as any).adTypes ?? null
    if (direct) return true
    const raw = (category as any).extraFieldsRaw
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return 'ad_types' in raw || 'adTypes' in raw
    }
    if (Array.isArray(category.extraFields)) {
      return category.extraFields.some(entry => {
        if (!entry) return false
        if (typeof entry === 'object' && 'ad_types' in entry) return true
        if (typeof entry === 'string') {
          try {
            const parsed = JSON.parse(entry)
            return parsed && typeof parsed === 'object' && 'ad_types' in parsed
          } catch {
            return false
          }
        }
        return false
      })
    }
    return false
  }, [])

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const endpoint = activeOnly
      ? '/categories?active=true&parentId=null'
      : '/categories?parentId=null'

    setCategoriesLoading(true)
    setCategoriesError(null)

    apiGet<ApiCategory[]>(endpoint, { signal: controller.signal })
      .then(data => {
        if (!isMounted) {
          return
        }
        const normalized = normalizeCategories(data.map(withResolvedIcon))
        const roots = normalized.filter(category => !category.parentId)
        setRootCategories(roots)
        setCategories(normalized)
        setChildrenByParent({})
      })
      .catch(err => {
        if (!isMounted) {
          return
        }
        console.error('Unable to load parent categories', err)
        setCategoriesError(
          err instanceof Error
            ? err.message
            : t('categories.loadError')
        )
      })
      .finally(() => {
        if (isMounted) {
          setCategoriesLoading(false)
        }
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [activeOnly])

  const loadChildren = useCallback(
    async (parentId: string): Promise<Category[]> => {
      const cached = childrenByParent[parentId]
      if (cached && cached.length && cached.some(child => child.icon && child.description)) {
        return cached
      }

      setChildrenLoading(prev => ({ ...prev, [parentId]: true }))
      try {
        const endpoint = activeOnly
          ? `/categories?active=true&parentId=${parentId}`
          : `/categories?parentId=${parentId}`
        const data = await apiGet<ApiCategory[]>(endpoint)
        const normalized = normalizeCategories(
          data
            .map(withResolvedIcon)
            .filter(entry => entry.parentId === parentId)
        )
        setChildrenByParent(prev => ({ ...prev, [parentId]: normalized }))
        setCategories(prev => {
          const mergedMap = new Map<string, Category>()
          prev.forEach(category => mergedMap.set(category.id, category))
          normalized.forEach(category => {
            const existing = mergedMap.get(category.id)
            mergedMap.set(category.id, existing ? { ...existing, ...category } : category)
          })
          return normalizeCategories(Array.from(mergedMap.values()))
        })
        return normalized
      } catch (err) {
        console.error('Unable to load child categories', err)
        setCategoriesError(
          err instanceof Error
            ? err.message
            : t('categories.childrenLoadError')
        )
        throw err
      } finally {
        setChildrenLoading(prev => {
          const { [parentId]: _, ...rest } = prev
          return rest
        })
      }
    },
    [activeOnly, childrenByParent]
  )

  const ensureCategoryLoaded = useCallback(
    async (categoryId: string | null | undefined): Promise<void> => {
      if (!categoryId) {
        return
      }

      const existing = categories.find(category => category.id === categoryId)
      if (existing) {
        if (existing.parentId) {
          await loadChildren(existing.parentId).catch(() => {
            /* handled */
          })
        }
        if (hasAdTypes(existing) || existing.extraFieldsRaw || detailsLoadedRef.current.has(categoryId)) {
          return
        }
      }

      try {
        const category = await apiGet<Category>(`/categories/${categoryId}`)
        setCategories(prev => {
          if (prev.some(entry => entry.id === category.id)) {
            const merged = prev.map(entry => (entry.id === category.id ? { ...entry, ...category } : entry))
            return normalizeCategories(merged)
          }
          return normalizeCategories(prev.concat(category))
        })
        detailsLoadedRef.current.add(categoryId)

        if (category.parentId) {
          await ensureCategoryLoaded(category.parentId)
          await loadChildren(category.parentId).catch(() => {
            /* handled */
          })
        } else {
          setRootCategories(prev => {
            if (prev.some(entry => entry.id === category.id)) {
              return prev
            }
            return normalizeCategories(prev.concat(category))
          })
        }
      } catch (err) {
        console.error('Unable to resolve category hierarchy', err)
        setCategoriesError(
          err instanceof Error
            ? err.message
            : t('categories.resolveError')
        )
        detailsLoadedRef.current.add(categoryId)
      }
    },
    [categories, hasAdTypes, loadChildren]
  )

  return {
    categories,
    rootCategories,
    categoriesLoading,
    categoriesError,
    childrenByParent,
    childrenLoading,
    loadChildren,
    ensureCategoryLoaded,
    setCategoriesError
  }
}
