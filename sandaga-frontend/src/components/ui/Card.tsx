import React from 'react'

type CardProps = {
  className?: string
  style?: React.CSSProperties
}

export const Card: React.FC<React.PropsWithChildren<CardProps>> = ({
  children,
  className = '',
  style
}) => (
  <div
    className={['card', className].filter(Boolean).join(' ')}
    style={style}
  >
    {children}
  </div>
)
