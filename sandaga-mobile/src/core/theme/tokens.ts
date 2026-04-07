export const colors = {
  // Core brand colors (aligned with web light theme)
  primary: '#ff6e14',
  primaryDark: '#d95b0f',
  accent: '#0f60c4',
  primarySoft: 'rgba(255, 110, 20, 0.1)',
  primarySoftStrong: 'rgba(255, 110, 20, 0.18)',
  accentSoft: 'rgba(15, 96, 196, 0.08)',
  accentSoftStrong: 'rgba(15, 96, 196, 0.16)',
  accentOutline: 'rgba(15, 96, 196, 0.34)',
  primarySurface: '#fff1e8',
  primarySurfaceStrong: '#ffd4bb',
  accentSurface: '#e7f1ff',
  dangerSoft: 'rgba(220, 38, 38, 0.06)',
  dangerSoftStrong: 'rgba(220, 38, 38, 0.2)',
  dangerSurface: '#fff1f2',
  dangerSurfaceStrong: '#fecaca',
  successSoft: 'rgba(15, 157, 88, 0.12)',
  warningSoft: 'rgba(185, 106, 0, 0.12)',

  // Surfaces
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceAlt: '#f3f7ff',
  surfaceMuted: '#eef2f7',
  background: '#f7f8fc',

  // Borders and text
  border: 'rgba(20, 20, 20, 0.1)',
  borderStrong: 'rgba(20, 20, 20, 0.16)',
  text: '#1f1f1f',
  muted: '#6f6f6f',
  placeholder: 'rgba(110, 110, 110, 0.7)',

  // States
  danger: '#dc2626',
  success: '#0f9d58',
  warning: '#b96a00',
  info: '#0f60c4',

  // Overlays / utility
  overlaySoft: 'rgba(15, 23, 42, 0.06)',
  overlayStrong: 'rgba(15, 23, 42, 0.72)',
  white: '#ffffff',
  whiteMuted: 'rgba(255, 255, 255, 0.84)'
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 22,
  pill: 999
}

export const typography = {
  body: 16,
  bodySm: 14,
  bodyXs: 13,
  caption: 12,
  captionSm: 11,
  title: 22,
  titleSm: 18,
  titleLg: 28,
  titleXl: 32,
  display: 36,
  weightSemibold: '600' as const,
  weightBold: '700' as const,
  weightExtrabold: '800' as const,
  weightBlack: '900' as const
}

export const controls = {
  height: 44,
  heightSm: 36
}

export const shadows = {
  soft: {
    shadowColor: colors.overlayStrong,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  elevated: {
    shadowColor: colors.overlayStrong,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  }
}
