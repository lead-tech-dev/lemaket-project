/**
 * Helpers responsive pour le redesign. La maquette simule le mobile via un
 * contexte `VP` ; dans le vrai web on s'appuie sur de vraies media queries.
 */
import { useEffect, useState } from 'react'

export const breakpoints = {
  mobile: 640,
  tablet: 900,
  desktop: 1240,
} as const

/** À utiliser dans les template literals styled-components : `${media.tablet} { ... }`. */
export const media = {
  /** max-width mobile (<= 640px) */
  mobile: `@media (max-width: ${breakpoints.mobile}px)`,
  /** max-width tablette (<= 900px) */
  tablet: `@media (max-width: ${breakpoints.tablet}px)`,
  /** max-width desktop intermédiaire (<= 1240px) */
  desktop: `@media (max-width: ${breakpoints.desktop}px)`,
  /** min-width desktop (>= 901px) */
  up: `@media (min-width: ${breakpoints.tablet + 1}px)`,
} as const

/** Hook : true si la largeur courante est <= au breakpoint donné (défaut: tablette). */
export const useBreakpoint = (max: number = breakpoints.tablet): boolean => {
  const query = `(max-width: ${max}px)`
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}
