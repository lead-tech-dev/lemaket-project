import styled from 'styled-components'

/**
 * Pilule / chip de filtre (port de lib.jsx Pill). `$active` = état sélectionné.
 */
export const Pill = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 15px;
  border-radius: ${({ theme }) => theme.radii.pill}px;
  border: 1px solid ${({ $active, theme }) => ($active ? theme.primary : theme.border)};
  background: ${({ $active, theme }) => ($active ? theme.primary : theme.surface)};
  color: ${({ $active }) => ($active ? '#fff' : 'inherit')};
  ${({ $active, theme }) => !$active && `color: ${theme.text};`}
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: all 0.15s ease;
`
