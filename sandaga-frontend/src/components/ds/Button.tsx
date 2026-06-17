import styled, { css } from 'styled-components'

export type ButtonKind = 'primary' | 'accent' | 'ghost' | 'soft'

const kinds = {
  primary: css`
    background: ${({ theme }) => theme.primary};
    color: #fff;
    box-shadow: 0 6px 18px ${({ theme }) => theme.primary}44;
  `,
  accent: css`
    background: ${({ theme }) => theme.accent};
    color: #fff;
    box-shadow: 0 6px 18px ${({ theme }) => theme.accent}44;
  `,
  ghost: css`
    background: ${({ theme }) => theme.surface};
    color: ${({ theme }) => theme.text};
    border: 1.5px solid ${({ theme }) => theme.border};
  `,
  soft: css`
    background: ${({ theme }) => theme.primarySoft};
    color: ${({ theme }) => theme.primary};
  `,
}

/**
 * Bouton du design system (port de lib.jsx Btn). 4 variantes ; `$full` pour
 * occuper toute la largeur. S'utilise comme un <button> natif.
 */
export const Button = styled.button<{ $kind?: ButtonKind; $full?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  border: none;
  padding: 13px 22px;
  width: ${({ $full }) => ($full ? '100%' : 'auto')};
  transition: transform 0.12s ease, filter 0.12s ease;
  ${({ $kind = 'primary' }) => kinds[$kind]}

  &:active {
    transform: scale(0.97);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`
