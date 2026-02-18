import { useCallback, useMemo, useState } from 'react'
import type { SortOption } from '../components/ui/SortSelect'
import {
  clearLimitPreference,
  clearPriceBandPreference,
  clearRadiusPreference,
  clearSellerTypePreference,
  clearSortPreference,
  getLimitPreference,
  getPriceBandPreference,
  getRadiusPreference,
  getSellerTypePreference,
  getSortPreference,
  setLimitPreference,
  setPriceBandPreference,
  setRadiusPreference,
  setSellerTypePreference,
  setSortPreference
} from '../utils/preferences'

type Preferences = {
  sort: SortOption
  sellerType: string
  page: number
  limit: number
  priceBand: string
  radius: string
}

type PreferenceKeys = keyof Preferences

export function useUserPreferences(initial?: Partial<Preferences>) {
  const [preferences, setPreferences] = useState<Preferences>(() => ({
    sort: initial?.sort ?? getSortPreference() ?? 'recent',
    sellerType: initial?.sellerType ?? getSellerTypePreference() ?? 'all',
    page: initial?.page ?? 1,
    limit: initial?.limit ?? getLimitPreference() ?? 20,
    priceBand: initial?.priceBand ?? getPriceBandPreference() ?? 'all',
    radius: initial?.radius ?? getRadiusPreference() ?? '25'
  }))

  const setPreference = useCallback(
    <Key extends PreferenceKeys>(key: Key, value: Preferences[Key]) => {
      setPreferences(prev => {
        const next = { ...prev, [key]: value }
        if (key === 'sort') {
          setSortPreference(next.sort)
        }
        if (key === 'sellerType') {
          setSellerTypePreference(next.sellerType)
        }
        if (key === 'limit') {
          setLimitPreference(next.limit)
        }
        if (key === 'priceBand') {
          setPriceBandPreference(next.priceBand)
        }
        if (key === 'radius') {
          setRadiusPreference(next.radius)
        }
        return next
      })
    },
    []
  )

  const resetPreferences = useCallback(() => {
    setPreferences({
      sort: 'recent',
      sellerType: 'all',
      page: 1,
      limit: 20,
      priceBand: 'all',
      radius: '25'
    })
    clearSortPreference()
    clearSellerTypePreference()
    clearLimitPreference()
    clearPriceBandPreference()
    clearRadiusPreference()
  }, [])

  return useMemo(
    () => ({
      preferences,
      setPreference,
      resetPreferences
    }),
    [preferences, resetPreferences, setPreference]
  )
}
