import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../utils/api'
import { useI18n } from '../contexts/I18nContext'

export type PriceSuggestion = {
  suggested: number | null
  min: number | null
  max: number | null
  currency: string
  sampleSize: number
}

type Params = {
  categoryId?: string | null
  subCategoryId?: string | null
  city?: string | null
  sampleSize?: number | null
}

export function usePriceSuggestion(params: Params) {
  const { t } = useI18n()
  const [data, setData] = useState<PriceSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const queryPath = useMemo(() => {
    const search = new URLSearchParams()
    if (params.categoryId) search.set('categoryId', params.categoryId)
    if (params.subCategoryId) search.set('subCategoryId', params.subCategoryId)
    if (params.city) search.set('city', params.city)
    if (params.sampleSize) search.set('sampleSize', String(params.sampleSize))
    const qs = search.toString()
    return `/listings/price-suggestion${qs ? `?${qs}` : ''}`
  }, [params.categoryId, params.city, params.sampleSize, params.subCategoryId])

  useEffect(() => {
    if (!params.categoryId && !params.subCategoryId) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    apiGet<PriceSuggestion>(queryPath, { signal: controller.signal })
      .then(setData)
      .catch(err => {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error ? err.message : t('listings.priceSuggestion.loadError')
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [params.categoryId, params.subCategoryId, queryPath])

  return { data, loading, error }
}
