import type { CSSProperties } from 'react'

type SkeletonProps = {
  width?: number | string
  height?: number | string
  rounded?: boolean
  variant?: 'text' | 'circle' | 'rect'
  className?: string
  style?: CSSProperties
}

export function Skeleton({
  width = '100%',
  height = '1em',
  rounded,
  variant = 'text',
  className,
  style
}: SkeletonProps) {
  const resolvedStyle: CSSProperties = {
    width,
    height,
    borderRadius: rounded || variant === 'circle' ? '999px' : '8px',
    ...style
  }

  if (variant === 'circle') {
    resolvedStyle.borderRadius = '50%'
    if (!style?.width && typeof width === 'string') {
      resolvedStyle.width = width
    }
    if (!style?.height && typeof height === 'string') {
      resolvedStyle.height = height
    }
  }

  const classes = ['skeleton', `skeleton--${variant}`]
  if (className) {
    classes.push(className)
  }

  return <span className={classes.join(' ')} style={resolvedStyle} />
}
