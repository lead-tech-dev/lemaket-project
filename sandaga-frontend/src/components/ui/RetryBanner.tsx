import type { ReactNode } from 'react'
import { useI18n } from '../../contexts/I18nContext'

type RetryBannerProps = {
  title?: string
  message: string
  actionLabel?: string
  onRetry: () => void
  variant?: 'warning' | 'error'
  accessory?: ReactNode
}

export function RetryBanner({
  title,
  message,
  actionLabel,
  onRetry,
  variant = 'error',
  accessory
}: RetryBannerProps) {
  const { t } = useI18n()
  const resolvedActionLabel = actionLabel ?? t('actions.retry')

  return (
    <div className={`retry-banner retry-banner--${variant}`} role="alert" aria-live="assertive">
      <div className="retry-banner__body">
        {accessory ? <div className="retry-banner__icon" aria-hidden>{accessory}</div> : null}
        <div className="retry-banner__content">
          {title ? <strong className="retry-banner__title">{title}</strong> : null}
          <p className="retry-banner__message">{message}</p>
        </div>
      </div>
      <button type="button" className="retry-banner__action" onClick={onRetry}>
        {resolvedActionLabel}
      </button>
    </div>
  )
}
