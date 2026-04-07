import { type PropsWithChildren, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { useI18n } from '../../contexts/I18nContext'

type ModalProps = PropsWithChildren<{
  open: boolean
  title?: string
  description?: string
  onClose?: () => void
  closeOnBackdrop?: boolean
  footer?: ReactNode
  className?: string
}>

export function Modal({
  open,
  title,
  description,
  onClose,
  closeOnBackdrop = true,
  footer,
  className,
  children
}: ModalProps){
  const { t } = useI18n()
  if (!open) return null
  if (typeof document === 'undefined') return null
  const contentClassName = ['modal__content', className].filter(Boolean).join(' ')

  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}>
      <div className="modal__backdrop" onClick={closeOnBackdrop ? onClose : undefined} />
      <div className={contentClassName} onClick={event => event.stopPropagation()}>
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
    </div>,
    document.body
  )
}
