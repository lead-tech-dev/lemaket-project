import type { FC } from 'react'

/** Badge "vérifié" (étoile bleue + check) — port de lib.jsx. */
export const Badge: FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden>
    <path
      d="M12 2l2.2 1.6 2.7-.3 1.1 2.5 2.5 1.1-.3 2.7L24 12l-1.6 2.2.3 2.7-2.5 1.1-1.1 2.5-2.7-.3L12 22l-2.2-1.6-2.7.3-1.1-2.5-2.5-1.1.3-2.7L2 12l1.6-2.2-.3-2.7 2.5-1.1L7 3.4l2.7.3z"
      transform="scale(0.96) translate(0.5 0.5)"
      fill="#1D9BF0"
    />
    <path
      d="M8.5 12.4l2.2 2.2 4.8-5"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
