import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import {
  defaultFeatureFlags,
  type FeatureFlagName,
  type FeatureFlags,
  parseFeatureFlagRecord
} from '../config/featureFlags'

type FeatureFlagContextValue = {
  flags: FeatureFlags
  isEnabled: (flag: FeatureFlagName) => boolean
  setFlag: (flag: FeatureFlagName, value: boolean) => void
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(undefined)
const STORAGE_KEY = 'sandaga:featureFlags'

function readStoredFlags(): Partial<FeatureFlags> {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    return parseFeatureFlagRecord(parsed)
  } catch (err) {
    console.warn('Impossible de lire les feature flags sauvegardés', err)
    return {}
  }
}

function parseEnvFlags(): Partial<FeatureFlags> {
  const raw = import.meta.env.VITE_FEATURE_FLAGS
  if (!raw) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw)
    return parseFeatureFlagRecord(parsed)
  } catch (err) {
    console.warn('Impossible de parser VITE_FEATURE_FLAGS', err)
    return {}
  }
}

export function FeatureFlagProvider({ children }: PropsWithChildren) {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFeatureFlags)

  useEffect(() => {
    const overrides = { ...parseEnvFlags(), ...readStoredFlags() }
    if (Object.keys(overrides).length) {
      setFlags(prev => ({ ...prev, ...overrides }))
    }
  }, [])

  const setFlag = useCallback((flag: FeatureFlagName, value: boolean) => {
    setFlags(prev => {
      if (prev[flag] === value) {
        return prev
      }
      const nextState: FeatureFlags = { ...prev, [flag]: value }
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
        } catch (err) {
          console.warn('Impossible de sauvegarder les feature flags', err)
        }
      }
      return nextState
    })
  }, [])

  const isEnabled = useCallback(
    (flag: FeatureFlagName) => {
      return Boolean(flags[flag])
    },
    [flags]
  )

  const value = useMemo<FeatureFlagContextValue>(
    () => ({
      flags,
      isEnabled,
      setFlag
    }),
    [flags, isEnabled, setFlag]
  )

  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>
}

export function useFeatureFlagsContext() {
  const context = useContext(FeatureFlagContext)
  if (!context) {
    throw new Error('useFeatureFlagsContext must be used within a FeatureFlagProvider')
  }
  return context
}

export function useFeatureFlag(flag: FeatureFlagName) {
  const { isEnabled } = useFeatureFlagsContext()
  return isEnabled(flag)
}
