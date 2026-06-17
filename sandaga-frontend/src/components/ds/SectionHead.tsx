import type { FC, ReactNode } from 'react'
import styled from 'styled-components'

const Row = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
`

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: 800;
  font-size: ${({ theme }) => theme.typography.h2}px;
  color: ${({ theme }) => theme.text};
  margin: 0;
`

const Sub = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.textSec};
`

const Action = styled.div`
  flex-shrink: 0;
`

/** En-tête de section : titre display + sous-titre optionnel + action à droite. */
export const SectionHead: FC<{ title: ReactNode; sub?: ReactNode; action?: ReactNode }> = ({
  title,
  sub,
  action,
}) => (
  <Row>
    <TitleBlock>
      <Title>{title}</Title>
      {sub && <Sub>{sub}</Sub>}
    </TitleBlock>
    {action && <Action>{action}</Action>}
  </Row>
)
