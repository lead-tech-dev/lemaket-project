import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { dictionaries, type Locale, type TranslationKey } from '../i18n/translations'
import { setApiLocale } from '../utils/api'

type TemplateValues = Record<string, string | number>

export type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, values?: TemplateValues) => string
}

export const I18nContext = createContext<I18nContextValue | undefined>(undefined)
const STORAGE_KEY = 'sandaga:locale'

function interpolate(template: string, values?: TemplateValues): string {
  if (!values) {
    return template
  }
  return Object.keys(values).reduce((acc, key) => {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}|{\\s*${key}\\s*}`, 'g')
    return acc.replace(pattern, String(values[key]))
  }, template)
}

function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored && stored in dictionaries) {
      return stored
    }
  } catch (err) {
    console.warn('Impossible de lire la langue sauvegardée', err)
  }
  return null
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initialLocale = getStoredLocale() ?? 'fr'
    setApiLocale(initialLocale)
    return initialLocale
  })

  useEffect(() => {
    setApiLocale(locale)
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, locale)
    } catch (err) {
      console.warn('Impossible de sauvegarder la langue', err)
    }
  }, [locale])

  const setLocale = useCallback((nextLocale: Locale) => {
    if (nextLocale in dictionaries) {
      setLocaleState(nextLocale)
    }
  }, [])

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = dictionaries[locale]
    const translate = (key: string, values?: TemplateValues) => {
      const template = dictionary[key as TranslationKey] ?? key
      return interpolate(template, values)
    }

    return {
      locale,
      setLocale,
      t: translate
    }
  }, [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
