import { type PropsWithChildren, type ReactNode } from 'react'
import { Button } from './Button'
import { useI18n } from '../../contexts/I18nContext'

type ModalProps = PropsWithChildren<{
  open: boolean
  title?: string
  description?: string
  onClose?: () => void
  footer?: ReactNode
  className?: string
}>

export function Modal({ open, title, description, onClose, footer, className, children }: ModalProps){
  const { t } = useI18n()
  if (!open) return null
  const contentClassName = ['modal__content', className].filter(Boolean).join(' ')
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}>
      <div className="modal__backdrop" onClick={onClose} />
      <div className={contentClassName}>
        <header className="modal__header">
          {title && <h3 id="modal-title">{title}</h3>}
          {onClose && (
            <Button
              variant="ghost"
              className="modal__close"
              onClick={(e) => { e.stopPropagation(); onClose?.() }}
              aria-label={t('ui.modal.close')}
            >
              ×
            </Button>
          )}
        </header>
        {description && <p className="modal__description">{description}</p>}
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  )
}
