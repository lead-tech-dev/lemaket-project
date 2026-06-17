import type { FC, MouseEvent } from 'react'
import styled from 'styled-components'
import { Badge } from './Badge'
import { Icon } from './Icon'
import { Photo } from './Photo'

/** Forme normalisée consommée par la carte (les écrans adaptent leur modèle). */
export interface ListingCardItem {
  id: string | number
  title: string
  price: string
  unit?: string
  cat: string
  city: string
  area?: string
  time?: string
  fav?: boolean
  verified?: boolean
  boosted?: boolean
  pro?: boolean
  img?: string
  imageUrl?: string | null
}

interface ListingCardProps {
  item: ListingCardItem
  onOpen?: (item: ListingCardItem) => void
  onFav?: (id: ListingCardItem['id']) => void
  wide?: boolean
  selectable?: boolean
  selected?: boolean
  onToggle?: (id: ListingCardItem['id']) => void
}

const stop = (e: MouseEvent) => e.stopPropagation()

/* ── Boost tag ── */
const BoostWrap = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(4px);
  border-radius: 20px;
  padding: 3px 9px;
`
const BoostText = styled.span`
  font-size: 9.5px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.3px;
`
export const BoostTag: FC = () => (
  <BoostWrap>
    <Icon name="bolt" size={11} color="#FFD23F" fill="#FFD23F" sw={1} />
    <BoostText>BOOSTÉ</BoostText>
  </BoostWrap>
)

/* ── Favorite button ── */
const FavWrap = styled.div<{ $float?: boolean }>`
  width: 34px;
  height: 34px;
  border-radius: 17px;
  background: ${({ $float, theme }) => ($float ? 'rgba(255,255,255,0.92)' : theme.surfaceAlt)};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: ${({ $float }) => ($float ? '0 2px 6px rgba(0,0,0,0.15)' : 'none')};
`
const FavBtn: FC<{ item: ListingCardItem; onFav?: ListingCardProps['onFav']; float?: boolean }> = ({
  item,
  onFav,
  float,
}) => (
  <FavWrap
    $float={float}
    onClick={(e) => {
      e.stopPropagation()
      onFav?.(item.id)
    }}
  >
    <Icon name="heart" size={17} color={item.fav ? '#D8572A' : float ? '#888' : '#97A199'} fill={item.fav ? '#D8572A' : 'none'} />
  </FavWrap>
)

/* ── Compare toggle ── */
const CmpWrap = styled.div<{ $selected?: boolean }>`
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  background: ${({ $selected, theme }) => ($selected ? theme.primary : 'rgba(255,255,255,0.92)')};
  border-radius: 8px;
  padding: 4px 9px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
`
const CmpBox = styled.div<{ $selected?: boolean }>`
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 2px solid ${({ $selected }) => ($selected ? '#fff' : '#999')};
  background: ${({ $selected }) => ($selected ? '#fff' : 'transparent')};
  display: flex;
  align-items: center;
  justify-content: center;
`
const CmpText = styled.span<{ $selected?: boolean }>`
  font-size: 10px;
  font-weight: 700;
  color: ${({ $selected }) => ($selected ? '#fff' : '#555')};
`
const CmpToggle: FC<{ selected?: boolean; onClick: (e: MouseEvent) => void }> = ({ selected, onClick }) => (
  <CmpWrap $selected={selected} onClick={onClick}>
    <CmpBox $selected={selected}>{selected && <Icon name="check" size={9} color="#0F6B45" />}</CmpBox>
    <CmpText $selected={selected}>Comparer</CmpText>
  </CmpWrap>
)

/* ── Card shells ── */
const Vertical = styled.article`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
  &:hover {
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.11);
    transform: translateY(-3px);
  }
`
const Wide = styled.article`
  display: flex;
  gap: 16px;
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s ease;
  &:hover {
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.1);
  }
`
const Price = styled.div<{ $big?: boolean }>`
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: 800;
  font-size: ${({ $big }) => ($big ? 21 : 18)}px;
  color: ${({ theme }) => theme.primary};
  margin-bottom: 4px;
  & span {
    font-size: ${({ $big }) => ($big ? 13 : 11)}px;
    font-weight: 700;
  }
`
const Title = styled.div<{ $clamp?: boolean }>`
  font-size: ${({ $clamp }) => ($clamp ? 14 : 16)}px;
  font-weight: ${({ $clamp }) => ($clamp ? 500 : 600)};
  color: ${({ theme }) => theme.text};
  line-height: 1.35;
  ${({ $clamp }) =>
    $clamp
      ? `margin-bottom:10px;min-height:38px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;`
      : `margin:4px 0 8px;`}
`
const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: ${({ theme }) => theme.textMut};
`
const MetaWide = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12.5px;
  color: ${({ theme }) => theme.textSec};
`
const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`
const ProTag = styled.span`
  background: ${({ theme }) => theme.surfaceAlt};
  color: ${({ theme }) => theme.textSec};
  font-weight: 700;
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: 20px;
`
const VerifiedTag = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${({ theme }) => theme.primary};
  font-weight: 600;
`
const Body = styled.div`
  padding: 13px 14px 15px;
`
const BodyWide = styled.div`
  flex: 1;
  padding: 15px 16px 15px 0;
  display: flex;
  flex-direction: column;
`
const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
`
const Truncate = styled.span`
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`

/** Carte annonce — variante verticale (défaut) ou large (`wide`, vue liste). */
export const ListingCard: FC<ListingCardProps> = ({
  item,
  onOpen,
  onFav,
  wide = false,
  selectable = false,
  selected = false,
  onToggle,
}) => {
  const open = () => onOpen?.(item)

  if (wide) {
    return (
      <Wide onClick={open}>
        <Photo item={item} h={150} fz={48} style={{ width: 200 }}>
          {item.boosted && <BoostTag />}
          {selectable && (
            <CmpToggle
              selected={selected}
              onClick={(e) => {
                stop(e)
                onToggle?.(item.id)
              }}
            />
          )}
        </Photo>
        <BodyWide>
          <TopRow>
            <Price $big>
              {item.price} <span>FCFA{item.unit ?? ''}</span>
            </Price>
            <FavBtn item={item} onFav={onFav} />
          </TopRow>
          <Title>{item.title}</Title>
          <div style={{ flex: 1 }} />
          <MetaWide>
            <MetaItem>
              <Icon name="pin" size={14} color="#97A199" />
              {item.city}
              {item.area ? ` · ${item.area}` : ''}
            </MetaItem>
            {item.time && (
              <MetaItem>
                <Icon name="clock" size={14} color="#97A199" />
                {item.time}
              </MetaItem>
            )}
            {item.pro && <ProTag>PRO</ProTag>}
            {item.verified && (
              <VerifiedTag>
                <Badge size={14} />
                Vérifié
              </VerifiedTag>
            )}
          </MetaWide>
        </BodyWide>
      </Wide>
    )
  }

  return (
    <Vertical onClick={open}>
      <Photo item={item} h={158} fz={50}>
        {item.boosted && <BoostTag />}
        {selectable && (
          <CmpToggle
            selected={selected}
            onClick={(e) => {
              stop(e)
              onToggle?.(item.id)
            }}
          />
        )}
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <FavBtn item={item} onFav={onFav} float />
        </div>
      </Photo>
      <Body>
        <Price>
          {item.price} <span>FCFA{item.unit ?? ''}</span>
        </Price>
        <Title $clamp>{item.title}</Title>
        <Meta>
          <Icon name="pin" size={13} color="#97A199" />
          <Truncate>{item.city}</Truncate>
          {item.verified && <Badge size={13} />}
        </Meta>
      </Body>
    </Vertical>
  )
}
