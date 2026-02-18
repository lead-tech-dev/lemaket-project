import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  children,
  className
}: EmptyStateProps) {
  const classes = ['empty-state']
  if (className) {
    classes.push(className)
  }

  return (
    <div className={classes.join(' ')}>
      {icon ? (
        <div className="empty-state__icon" aria-hidden>
          {icon}
        </div>
      ) : null}
      <div className="empty-state__content">
        <h3 className="empty-state__title">{title}</h3>
        {description ? <p className="empty-state__description">{description}</p> : null}
        {children}
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  )
}
