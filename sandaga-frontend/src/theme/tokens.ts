/**
 * Design tokens du redesign Lemaket.
 *
 * Trois thèmes commutables (Terroir / Indigo / Nuit) portés depuis la maquette
 * `docs/lemaket-source/web/lib.jsx` (THEMES). Chaque thème expose les mêmes
 * tokens de couleur ; les échelles partagées (espacements, rayons, ombres,
 * typographie, z-index) sont communes à tous les thèmes.
 */

export type ThemeId = 'terroir' | 'indigo' | 'nuit'

export interface ThemeColors {
  name: string
  primary: string
  primaryDk: string
  primarySoft: string
  accent: string
  accentSoft: string
  bg: string
  surface: string
  surfaceAlt: string
  text: string
  textSec: string
  textMut: string
  border: string
  heroInk: string
  dark: boolean
}

/** Échelles partagées entre tous les thèmes. */
export const shared = {
  fonts: {
    display: "'Bricolage Grotesque', sans-serif",
    body: "'Hanken Grotesk', sans-serif",
  },
  /** Espacements (px) — incréments utilisés dans la maquette. */
  space: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    xxl: 40,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 100,
  },
  shadows: {
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 8px 26px rgba(0,0,0,0.10)',
    lg: '0 12px 50px rgba(0,0,0,0.16)',
  },
  typography: {
    h1: 38,
    h2: 28,
    h3: 20,
    body: 15,
    sm: 13.5,
    xs: 12,
    weightBody: 500,
    weightBold: 700,
    weightDisplay: 800,
  },
  /** Z-index normalisés (cf. inventaire maquette). */
  z: {
    header: 40,
    compareBar: 50,
    mobileFilter: 60,
    walletModal: 70,
    detailReport: 80,
    tweaks: 100,
  },
} as const

export type SharedTokens = typeof shared

/** Palettes des trois thèmes (couleurs uniquement). */
export const THEMES: Record<ThemeId, ThemeColors> = {
  terroir: {
    name: 'Terroir',
    primary: '#0F6B45',
    primaryDk: '#0A4E32',
    primarySoft: '#E4F0E8',
    accent: '#D8572A',
    accentSoft: '#FBE7DC',
    bg: '#F6F1E6',
    surface: '#FFFFFF',
    surfaceAlt: '#EFE7D5',
    text: '#1A2A22',
    textSec: '#5E6E64',
    textMut: '#97A199',
    border: '#E5DCC9',
    heroInk: '#0E3325',
    dark: false,
  },
  indigo: {
    name: 'Indigo',
    primary: '#3A36D6',
    primaryDk: '#2723A8',
    primarySoft: '#E7E6FB',
    accent: '#FF5A4D',
    accentSoft: '#FFE6E3',
    bg: '#F3F4FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EAECF8',
    text: '#15182B',
    textSec: '#5A6079',
    textMut: '#9AA0BC',
    border: '#E1E4F1',
    heroInk: '#15182B',
    dark: false,
  },
  nuit: {
    name: 'Nuit',
    primary: '#E8A33D',
    primaryDk: '#C9842A',
    primarySoft: '#2A2415',
    accent: '#54D6A4',
    accentSoft: '#16271F',
    bg: '#111216',
    surface: '#1B1C21',
    surfaceAlt: '#25262D',
    text: '#F4EFE5',
    textSec: '#9B9CA6',
    textMut: '#63646E',
    border: '#2D2E36',
    heroInk: '#F4EFE5',
    dark: true,
  },
}

/** Thème complet (couleurs + échelles partagées) consommé par styled-components. */
export type AppTheme = ThemeColors & SharedTokens

export const buildTheme = (id: ThemeId): AppTheme => ({
  ...THEMES[id],
  ...shared,
})

export const DEFAULT_THEME: ThemeId = 'terroir'

/** Catégories marketplace + dégradés de placeholder (port de lib.jsx). */
export const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  Emploi: ['#1E3A8A', '#60A5FA'],
  Maison: ['#9A3412', '#FB923C'],
  Vacances: ['#0E7490', '#22D3EE'],
  Immobilier: ['#065F46', '#34D399'],
  Véhicules: ['#7F1D1D', '#F87171'],
  Multimédia: ['#3730A3', '#818CF8'],
  Animaux: ['#854D0E', '#FACC15'],
  Loisirs: ['#831843', '#F472B6'],
}

export const categoryGradient = (cat: string): string => {
  const g = CATEGORY_GRADIENTS[cat] ?? ['#475569', '#94A3B8']
  return `linear-gradient(140deg, ${g[0]}, ${g[1]})`
}
