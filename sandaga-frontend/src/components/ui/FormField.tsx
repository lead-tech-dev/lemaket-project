import type { PropsWithChildren, ReactNode } from 'react'

type Props = PropsWithChildren<{
  label: ReactNode
  htmlFor?: string
  required?: boolean
  hint?: ReactNode
  action?: ReactNode
  error?: string
}>

export function FormField({ label, htmlFor, required, hint, action, children, error }: Props){
  return (
    <div className={`form-field ${error ? 'form-field--error' : ''}`}>
      <div className="form-field__head">
        <label className="form-field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="form-field__required">*</span>}
        </label>
        {action && <span className="form-field__action">{action}</span>}
      </div>
      <div className="form-field__control">{children}</div>
      {hint && !error && <p className="form-field__hint">{hint}</p>}
      {error && <p className="form-field__error">{error}</p>}
    </div>
  )
}
