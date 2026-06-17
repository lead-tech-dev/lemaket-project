import React from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { useTheme } from '../../theme/ThemeProvider'

const ICONS: Record<string, string> = { terroir: '🌿', indigo: '🔷', nuit: '🌙' }

/**
 * Sélecteur de thème : cycle entre les 3 thèmes du design system
 * (Terroir → Indigo → Nuit). Remplace l'ancien toggle binaire light/dark.
 */
export const SwitchTheme: React.FC = () => {
  const { t } = useI18n()
  const { themeId, setThemeId, themes } = useTheme()

  const cycle = () => {
    const idx = themes.findIndex((th) => th.id === themeId)
    const next = themes[(idx + 1) % themes.length]
    setThemeId(next.id)
  }

  const current = themes.find((th) => th.id === themeId)

  return (
    <button
      className="btn btn--ghost"
      onClick={cycle}
      aria-label={t('ui.theme.toggle')}
      title={current?.name}
    >
      {ICONS[themeId] ?? '🎨'}
    </button>
  )
}
