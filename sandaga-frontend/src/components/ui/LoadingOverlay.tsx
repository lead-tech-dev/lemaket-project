import { useMemo } from 'react'
import { useGlobalLoading } from '../../hooks/useGlobalLoading'
import { useI18n } from '../../contexts/I18nContext'

export function LoadingOverlay() {
  const { isGlobalLoading, pendingCount } = useGlobalLoading()
  const { t } = useI18n()

  const label = useMemo(() => {
    if (pendingCount <= 1) {
      return t('loading.global.single')
    }
    return t('loading.global.multiple', { count: pendingCount })
  }, [pendingCount, t])

  if (!isGlobalLoading) {
    return null
  }

  return (
    <div className="global-loading-overlay" role="status" aria-live="polite" aria-label={label}>
      <div className="global-loading-overlay__panel">
        <span className="global-loading-overlay__spinner" aria-hidden />
        <span className="global-loading-overlay__text">{label}…</span>
      </div>
    </div>
  )
}
