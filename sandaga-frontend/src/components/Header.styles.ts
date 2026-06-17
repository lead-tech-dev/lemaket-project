import styled from 'styled-components'
import { Link } from 'react-router-dom'

/* En-tête sticky façon maquette ui.jsx (Header). */
export const HeaderEl = styled.header`
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.z.header};
  background: ${({ theme }) => theme.surface};
  border-bottom: 1px solid ${({ theme }) => theme.border};
`
export const Bar = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 14px 28px;
  display: flex;
  align-items: center;
  gap: 22px;
  @media (max-width: 900px) {
    padding: 12px 16px;
    gap: 12px;
  }
`
export const Brand = styled(Link)`
  flex-shrink: 0;
  text-decoration: none;
`
export const SearchBox = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${({ theme }) => theme.bg};
  border: 1.5px solid ${({ theme }) => theme.border};
  border-radius: 12px;
  padding: 9px 12px 9px 16px;
  max-width: 520px;
  position: relative;
  input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-family: inherit;
    font-size: 14.5px;
    color: ${({ theme }) => theme.text};
    &::placeholder {
      color: ${({ theme }) => theme.textMut};
    }
  }
  @media (max-width: 900px) {
    display: none;
  }
`
export const CamBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: ${({ theme }) => theme.primarySoft};
  color: ${({ theme }) => theme.primary};
  flex-shrink: 0;
`
export const ClearBtn = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.textMut};
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
`
export const Spacer = styled.div`
  flex: 1;
`
export const LangToggle = styled.div`
  display: flex;
  background: ${({ theme }) => theme.surfaceAlt};
  border-radius: 9px;
  padding: 2px;
  flex-shrink: 0;
  button {
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 11px;
    border-radius: 7px;
    background: transparent;
    color: ${({ theme }) => theme.textMut};
    &[data-active='true'] {
      background: ${({ theme }) => theme.surface};
      color: ${({ theme }) => theme.text};
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  }
  @media (max-width: 900px) {
    display: none;
  }
`
export const IconBtn = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.text};
  flex-shrink: 0;
  @media (max-width: 900px) {
    display: none;
  }
`
export const Dot = styled.span`
  position: absolute;
  top: -3px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: ${({ theme }) => theme.accent};
  border: 1.5px solid ${({ theme }) => theme.surface};
`
export const ActionLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 7px;
  color: ${({ theme }) => theme.text};
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  flex-shrink: 0;
  white-space: nowrap;
  @media (max-width: 900px) {
    display: none;
  }
`
export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: ${({ theme }) => theme.accent};
  color: #fff;
  font-size: 11px;
  font-weight: 700;
`
export const PostBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: ${({ theme }) => theme.accent};
  color: #fff;
  border-radius: 11px;
  padding: 11px 18px;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 6px 18px ${({ theme }) => theme.accent}44;
  flex-shrink: 0;
  @media (max-width: 900px) {
    padding: 9px 14px;
  }
`
export const IconToggle = styled.button`
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.text};
  padding: 6px;
  @media (max-width: 900px) {
    display: inline-flex;
    align-items: center;
  }
`

/* Suggestions de recherche (dropdown sous la barre) */
export const SuggestPanel = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 12px;
  box-shadow: ${({ theme }) => theme.shadows.md};
  padding: 6px;
  z-index: 30;
  max-height: 360px;
  overflow-y: auto;
`
export const SuggestSection = styled.div`
  padding: 4px;
`
export const SuggestTitle = styled.div`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.textMut};
  padding: 6px 8px;
`
export const SuggestItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: ${({ theme }) => theme.text};
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
  strong {
    font-size: 14px;
    font-weight: 600;
  }
  small {
    display: block;
    font-size: 12px;
    color: ${({ theme }) => theme.textMut};
  }
`
export const SuggestEmpty = styled.p`
  padding: 10px;
  font-size: 13px;
  color: ${({ theme }) => theme.textMut};
  margin: 0;
`

/* Barre de catégories */
export const NavBar = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  @media (max-width: 900px) {
    display: none;
  }
`
export const NavInner = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 28px;
  display: flex;
  align-items: center;
  gap: 4px;
`
export const NavLink = styled(Link)`
  padding: 12px;
  font-size: 13.5px;
  font-weight: 600;
  color: ${({ theme }) => theme.textSec};
  text-decoration: none;
  border-bottom: 2px solid transparent;
  &:hover {
    color: ${({ theme }) => theme.text};
    border-bottom-color: ${({ theme }) => theme.primary};
  }
`
export const NavCta = styled(Link)`
  margin-left: auto;
  padding: 12px 4px;
  font-size: 13.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.primary};
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 5px;
`

/* Barre de catégories mobile (pills scrollables) */
export const MobilePills = styled.div`
  display: none;
  border-top: 1px solid ${({ theme }) => theme.border};
  gap: 8px;
  overflow-x: auto;
  padding: 10px 16px;
  @media (max-width: 900px) {
    display: flex;
  }
`
