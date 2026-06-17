import styled from 'styled-components'

/**
 * Surface carte du design system. `$pad` ajuste le padding interne,
 * `$hover` active l'élévation au survol (cartes cliquables).
 */
export const Card = styled.div<{ $pad?: number; $hover?: boolean }>`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  padding: ${({ $pad }) => ($pad ?? 18)}px;
  box-shadow: ${({ theme }) => theme.shadows.sm};
  ${({ $hover, theme }) =>
    $hover &&
    `
    cursor: pointer;
    transition: box-shadow .15s ease, transform .15s ease;
    &:hover {
      box-shadow: ${theme.shadows.md};
      transform: translateY(-3px);
    }
  `}
`
