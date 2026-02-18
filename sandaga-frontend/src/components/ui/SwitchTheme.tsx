import React from 'react'
import { useI18n } from '../../contexts/I18nContext'
export const SwitchTheme: React.FC = () => {
  const { t } = useI18n()
  const toggle = () => {
    const root = document.documentElement
    const theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    root.setAttribute('data-theme', theme!)
    localStorage.setItem('theme', theme!)
  }
  React.useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved) document.documentElement.setAttribute('data-theme', saved)
  }, [])
  return (
    <button className="btn btn--ghost" onClick={toggle} aria-label={t('ui.theme.toggle')}>
      🌓
    </button>
  )
}
