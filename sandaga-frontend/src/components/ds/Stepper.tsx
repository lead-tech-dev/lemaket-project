import type { FC } from 'react'
import styled from 'styled-components'
import { Icon } from './Icon'

const Row = styled.div`
  display: flex;
  align-items: center;
`

const Item = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  &:last-child {
    flex: 0;
  }
`

const Dot = styled.div<{ $state: 'done' | 'active' | 'pending' }>`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  background: ${({ $state, theme }) =>
    $state === 'pending' ? theme.surfaceAlt : theme.primary};
  color: ${({ $state, theme }) => ($state === 'pending' ? theme.textMut : '#fff')};
  border: 2px solid ${({ $state, theme }) => ($state === 'active' ? theme.primary : 'transparent')};
`

const Line = styled.div<{ $done: boolean }>`
  flex: 1;
  height: 2px;
  margin: 0 6px;
  background: ${({ $done, theme }) => ($done ? theme.primary : theme.border)};
`

const Label = styled.span<{ $current: boolean }>`
  font-size: 12px;
  font-weight: ${({ $current }) => ($current ? 700 : 600)};
  color: ${({ $current, theme }) => ($current ? theme.text : theme.textMut)};
  margin-left: 8px;
  white-space: nowrap;
`

/**
 * Indicateur d'étapes (port des steppers KYC/publish/pay). `current` = index
 * de l'étape active (0-based).
 */
export const Stepper: FC<{ steps: string[]; current: number; showLabels?: boolean }> = ({
  steps,
  current,
  showLabels = true,
}) => (
  <Row>
    {steps.map((label, i) => {
      const state = i < current ? 'done' : i === current ? 'active' : 'pending'
      return (
        <Item key={label}>
          <Dot $state={state}>{state === 'done' ? <Icon name="check" size={15} color="#fff" /> : i + 1}</Dot>
          {showLabels && <Label $current={i === current}>{label}</Label>}
          {i < steps.length - 1 && <Line $done={i < current} />}
        </Item>
      )
    })}
  </Row>
)
