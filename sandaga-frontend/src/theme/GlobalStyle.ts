import { createGlobalStyle } from 'styled-components'

/**
 * Styles globaux du redesign :
 * 1. import des polices (Bricolage Grotesque + Hanken Grotesk) ;
 * 2. fond/texte pilotés par le thème actif ;
 * 3. **pont de variables CSS** : on remappe les tokens du thème styled-components
 *    sur les variables `--color-*` héritées du SCSS, pour que TOUTE l'app
 *    existante (Header, Footer, pages encore en SCSS) reflète le thème actif
 *    pendant la migration. Le reset complet reste dans le SCSS hérité.
 */
export const GlobalStyle = createGlobalStyle`
  body {
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    font-family: ${({ theme }) => theme.fonts.body};
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    transition: background-color .2s ease, color .2s ease;

    /* ── pont SCSS : tokens du thème → variables --color-* héritées ── */
    --color-primary: ${({ theme }) => theme.primary};
    --color-accent: ${({ theme }) => theme.accent};
    --color-primary-soft: ${({ theme }) => theme.primarySoft};
    --color-primary-soft-strong: ${({ theme }) => theme.primarySoft};
    --color-accent-soft: ${({ theme }) => theme.accentSoft};
    --color-accent-soft-strong: ${({ theme }) => theme.accentSoft};
    --color-accent-outline: ${({ theme }) => theme.border};
    --color-bg: ${({ theme }) => theme.bg};
    --color-surface: ${({ theme }) => theme.surface};
    --color-surface-raised: ${({ theme }) => theme.surface};
    --color-surface-alt: ${({ theme }) => theme.surfaceAlt};
    --color-border: ${({ theme }) => theme.border};
    --color-border-strong: ${({ theme }) => theme.border};
    --color-text: ${({ theme }) => theme.text};
    --color-muted: ${({ theme }) => theme.textSec};
    --color-placeholder: ${({ theme }) => theme.textMut};
  }

  h1, h2, h3 {
    font-family: ${({ theme }) => theme.fonts.display};
  }
`
