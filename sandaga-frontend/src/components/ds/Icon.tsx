import type { CSSProperties, FC } from 'react'

/**
 * Jeu d'icônes du design system (port de `lib.jsx` PATHS). SVG stroke, 24×24.
 */
export const ICON_PATHS = {
  search: 'M21 21l-5.2-5.2M17 10a7 7 0 11-14 0 7 7 0 0114 0z',
  pin: 'M12 21s-7-6.3-7-11a7 7 0 1114 0c0 4.7-7 11-7 11z M12 10.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z',
  heart:
    'M12 20.3l-1.6-1.5C5.4 14.2 2.5 11.5 2.5 8.3 2.5 5.9 4.4 4 6.8 4c1.4 0 2.7.6 3.5 1.7L12 7.3l1.7-1.6A4.3 4.3 0 0117.2 4C19.6 4 21.5 5.9 21.5 8.3c0 3.2-2.9 5.9-7.9 10.5L12 20.3z',
  user: 'M16 8a4 4 0 11-8 0 4 4 0 018 0z M4 21a8 8 0 0116 0',
  plus: 'M12 5v14M5 12h14',
  chevD: 'M6 9l6 6 6-6',
  chevR: 'M9 6l6 6-6 6',
  chevL: 'M15 6l-6 6 6 6',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 13l4 4L19 7',
  star: 'M12 3.2l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.6-5 2.6.9-5.6-4-4 5.6-.8z',
  shield: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z M9 12l2 2 4-4',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  cam: 'M3 8a2 2 0 012-2h2l1.2-1.6A1 1 0 019 4h6a1 1 0 01.8.4L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z M12 16a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z',
  filter: 'M3 5h18M6 12h12M10 19h4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14',
  phone:
    'M4 5a2 2 0 012-2h2.3a1 1 0 011 .76l1 4a1 1 0 01-.3 1L9 10.5a12 12 0 005 5l1.7-1.3a1 1 0 011-.2l4 1a1 1 0 01.7 1V18a2 2 0 01-2 2A16 16 0 014 5z',
  chat: 'M21 12a8 8 0 01-11.5 7.2L4 21l1.8-5.5A8 8 0 1121 12z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  x: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  clock: 'M12 8v4l3 2 M12 21a9 9 0 100-18 9 9 0 000 18z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 15a3 3 0 100-6 3 3 0 000 6z',
  tag: 'M3 12l9-9 9 9-9 9-9-9z M9 9h.01',
  briefcase: 'M4 8h16v11H4z M9 8V5h6v3 M4 13h16',
  building: 'M5 21V4a1 1 0 011-1h7a1 1 0 011 1v17 M14 9h4a1 1 0 011 1v11 M8 7h2M8 11h2M8 15h2',
  car: 'M5 12l1.5-4.5A2 2 0 018.4 6h7.2a2 2 0 011.9 1.5L19 12m-14 0h14m-14 0v5h2v-2h10v2h2v-5M7.5 15h.01M16.5 15h.01',
  sofa: 'M4 11V8a2 2 0 012-2h12a2 2 0 012 2v3 M3 12a2 2 0 012 2v3h14v-3a2 2 0 012-2 M5 17v2M19 17v2',
  monitor: 'M3 4h18v12H3z M8 20h8M12 16v4',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4 M12 16a4 4 0 100-8 4 4 0 000 8z',
  paw: 'M8 14c-2 0-3 1.5-3 3s1 2 3 2 2-1 4-1 2 1 4 1 3-.5 3-2-1-3-3-3-3 1-4 1-2-1-4-1z M6.5 9.5a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z M17.5 9.5a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z M11 7.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M13 7.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 16a4 4 0 100-8 4 4 0 000 8z M12 12h.01',
  bell: 'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 01-3.4 0',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18z M3.5 9h17M3.5 15h17 M12 3c2.5 2.5 2.5 15.5 0 18 M12 3c-2.5 2.5-2.5 15.5 0 18',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  upload: 'M12 16V4M7 9l5-5 5 5 M5 20h14',
} as const

export type IconName = keyof typeof ICON_PATHS

interface IconProps {
  name: IconName
  size?: number
  color?: string
  /** stroke width */
  sw?: number
  fill?: string
  style?: CSSProperties
  className?: string
}

export const Icon: FC<IconProps> = ({
  name,
  size = 22,
  color = 'currentColor',
  sw = 1.8,
  fill = 'none',
  style,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    className={className}
    aria-hidden
  >
    <path d={ICON_PATHS[name]} />
  </svg>
)
