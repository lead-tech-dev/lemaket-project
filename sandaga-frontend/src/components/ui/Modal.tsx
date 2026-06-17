import { type PropsWithChildren, type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { useI18n } from '../../contexts/I18nContext'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

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
  const contentRef = useRef<HTMLDivElement | null>(null)

  // Verrou de scroll de l'arrière-plan, focus initial dans la modale et
  // restauration du focus sur l'élément précédent à la fermeture.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const node = contentRef.current
    const firstFocusable = node?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(firstFocusable ?? node)?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  // Échap pour fermer + piège de focus (Tab/Shift+Tab cyclent dans la modale).
  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const node = contentRef.current
      if (!node) return
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) {
        event.preventDefault()
        node.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || !node.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !node.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null
  const contentClassName = ['modal__content', className].filter(Boolean).join(' ')

  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}>
      <div className="modal__backdrop" onClick={closeOnBackdrop ? onClose : undefined} />
      <div
        ref={contentRef}
        className={contentClassName}
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
      >
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
