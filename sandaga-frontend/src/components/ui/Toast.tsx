import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren, ReactNode } from 'react'

type ToastVariant = 'success' | 'error' | 'info'

type ToastAction = {
  label: string
  onClick: () => void
}

type ToastMessage = {
  id: number
  title?: string
  message: string
  variant: ToastVariant
  duration?: number
  action?: ToastAction
}

type ToastContextValue = {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
  removeToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let toastId = 0
let externalAddToast: ((toast: Omit<ToastMessage, 'id'>) => void) | null = null

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timers = useMemo(() => new Map<number, number>(), [])

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    toastId += 1
    const id = toastId
    setToasts(prev => [...prev, { ...toast, id }])
    const timer = window.setTimeout(() => {
      setToasts(prev => prev.filter(item => item.id !== id))
      timers.delete(id)
    }, toast.duration ?? 5000)
    timers.set(id, timer)
  }, [timers])

  const removeToast = useCallback((id: number) => {
    const timer = timers.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.delete(id)
    }
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [timers])

  useEffect(() => {
    externalAddToast = addToast
    return () => {
      externalAddToast = null
    }
  }, [addToast])

  const contextValue = useMemo(
    () => ({ addToast, removeToast }),
    [addToast, removeToast]
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast--${toast.variant}`}
            onClick={() => removeToast(toast.id)}
          >
            <div className="toast__body">
              {toast.title ? <strong>{toast.title}</strong> : null}
              <span>{toast.message}</span>
              {toast.action ? (
                <button
                  type="button"
                  className="toast__action"
                  onClick={event => {
                    event.stopPropagation()
                    toast.action?.onClick()
                    removeToast(toast.id)
                  }}
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="toast__close"
              aria-label="Fermer la notification"
              onClick={event => {
                event.stopPropagation()
                removeToast(toast.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
