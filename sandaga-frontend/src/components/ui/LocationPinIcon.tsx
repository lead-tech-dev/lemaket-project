type LocationPinIconProps = {
  className?: string
  title?: string
  variant?: 'thin' | 'bold' | 'filled'
}

export function LocationPinIcon({ className, title, variant = 'filled' }: LocationPinIconProps) {
  const labelled = Boolean(title)
  const strokeWidth = variant === 'thin' ? '1.5' : '2.1'

  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
    >
      {labelled ? <title>{title}</title> : null}
      {variant === 'filled' ? (
        <>
          <path
            fill="currentColor"
            stroke="none"
            d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 5.1 5.48 9.32 6.5 10.05 1.02-.73 6.5-4.95 6.5-10.05A6.5 6.5 0 0 0 12 2.5Z"
          />
          <circle cx="12" cy="9" r="2.25" fill="rgba(255,255,255,0.92)" stroke="none" />
        </>
      ) : (
        <>
          <path strokeWidth={strokeWidth} d="M12 22s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" />
          <circle cx="12" cy="12" r="2.75" strokeWidth={strokeWidth} />
        </>
      )}
    </svg>
  )
}
