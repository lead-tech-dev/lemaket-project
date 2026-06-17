import type { FC } from 'react'
import styled from 'styled-components'
import { Icon } from './Icon'

const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const Mark = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $size }) => $size * 0.28}px;
  background: linear-gradient(140deg, ${({ theme }) => theme.primary}, ${({ theme }) => theme.primaryDk});
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px ${({ theme }) => theme.primary}40;
`

const Word = styled.span<{ $size: number; $light: boolean }>`
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: 800;
  font-size: ${({ $size }) => $size * 0.72}px;
  letter-spacing: -1px;
  color: ${({ $light, theme }) => ($light ? '#fff' : theme.text)};
`

/** Logo Lemaket (mark dégradé + wordmark). */
export const Logo: FC<{ size?: number; light?: boolean }> = ({ size = 30, light = false }) => (
  <Wrap>
    <Mark $size={size}>
      <Icon name="bolt" size={size * 0.56} color="#fff" fill="#fff" sw={1.2} />
    </Mark>
    <Word $size={size} $light={light}>
      lemaket
    </Word>
  </Wrap>
)
