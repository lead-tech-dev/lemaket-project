import type { CSSProperties, FC, ReactNode } from 'react'
import styled from 'styled-components'
import { categoryGradient } from '../../theme/tokens'

const Block = styled.div<{ $grad: string; $h: string | number; $r: number; $fz: number }>`
  height: ${({ $h }) => (typeof $h === 'number' ? `${$h}px` : $h)};
  background: ${({ $grad }) => $grad};
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ $r }) => $r}px;
  overflow: hidden;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    top: -30%;
    left: -15%;
    width: 80%;
    height: 80%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.3), transparent 70%);
  }
  &::after {
    content: '';
    position: absolute;
    bottom: -25%;
    right: -12%;
    width: 62%;
    height: 62%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0, 0, 0, 0.2), transparent 70%);
  }

  & > .photo-emoji {
    font-size: ${({ $fz }) => $fz}px;
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25));
    position: relative;
  }
`

export interface PhotoItem {
  cat: string
  img?: string
  imageUrl?: string | null
}

interface PhotoProps {
  item: PhotoItem
  h?: string | number
  r?: number
  fz?: number
  style?: CSSProperties
  className?: string
  children?: ReactNode
}

/**
 * Bloc photo : image réelle si dispo, sinon placeholder dégradé par catégorie
 * avec emoji (port de lib.jsx Photo).
 */
export const Photo: FC<PhotoProps> = ({ item, h = '100%', r = 0, fz = 46, style, className, children }) => (
  <Block
    $grad={item.imageUrl ? `center / cover no-repeat url(${item.imageUrl})` : categoryGradient(item.cat)}
    $h={h}
    $r={r}
    $fz={fz}
    style={style}
    className={className}
  >
    {!item.imageUrl && item.img && <span className="photo-emoji">{item.img}</span>}
    {children}
  </Block>
)
