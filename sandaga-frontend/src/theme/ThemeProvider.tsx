import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ThemeProvider as SCThemeProvider } from 'styled-components'
import { GlobalStyle } from './GlobalStyle'
import { buildTheme, DEFAULT_THEME, THEMES, type ThemeId } from './tokens'

const STORAGE_KEY = 'theme'

interface ThemeContextValue {
  themeId: ThemeId
  setThemeId: (id: ThemeId) => void
  /** Liste des thèmes disponibles (id + nom + dark) pour le sélecteur. */
  themes: { id: ThemeId; name: string; dark: boolean }[]
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Migre l'ancienne valeur localStorage (light/dark) vers un ThemeId valide. */
const readStoredTheme = (): ThemeId => {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw && raw in THEMES) return raw as ThemeId
  if (raw === 'dark') return 'nuit'
  if (raw === 'light') return DEFAULT_THEME
  return DEFAULT_THEME
}

/**
 * Fournit le thème styled-components (3 thèmes commutables) + le GlobalStyle.
 * Persiste le choix en localStorage et reflète clair/sombre sur `data-theme`
 * pour rester compatible avec le SCSS hérité pendant la migration.
 */
export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(readStoredTheme)

  const applyDataTheme = useCallback((id: ThemeId) => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', THEMES[id].dark ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme-id', id)
  }, [])

  const setThemeId = useCallback(
    (id: ThemeId) => {
      setThemeIdState(id)
      try {
        window.localStorage.setItem(STORAGE_KEY, id)
      } catch {
        /* localStorage indisponible : on ignore */
      }
      applyDataTheme(id)
    },
    [applyDataTheme]
  )

  useEffect(() => {
    applyDataTheme(themeId)
  }, [themeId, applyDataTheme])

  const theme = useMemo(() => buildTheme(themeId), [themeId])

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      setThemeId,
      themes: (Object.keys(THEMES) as ThemeId[]).map((id) => ({
        id,
        name: THEMES[id].name,
        dark: THEMES[id].dark,
      })),
    }),
    [themeId, setThemeId]
  )

  return (
    <ThemeContext.Provider value={value}>
      <SCThemeProvider theme={theme}>
        <GlobalStyle />
        {children}
      </SCThemeProvider>
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <AppThemeProvider>')
  return ctx
}
