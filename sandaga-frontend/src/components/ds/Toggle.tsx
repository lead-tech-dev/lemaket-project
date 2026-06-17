import type { FC } from 'react'
import styled from 'styled-components'

const Track = styled.button<{ $on: boolean }>`
  width: 44px;
  height: 26px;
  border-radius: 13px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.primary : theme.border)};
  background: ${({ $on, theme }) => ($on ? theme.primary : theme.surfaceAlt)};
  position: relative;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.18s ease, border-color 0.18s ease;
`

const Knob = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transform: translateX(${({ $on }) => ($on ? '18px' : '0')});
  transition: transform 0.18s ease;
`

/** Interrupteur on/off (port des toggles alerts/kyc). */
export const Toggle: FC<{ on: boolean; onChange: (next: boolean) => void; label?: string }> = ({
  on,
  onChange,
  label,
}) => (
  <Track $on={on} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
    <Knob $on={on} />
  </Track>
)
