import styled from 'styled-components'

/* ── Hero ── */
export const Hero = styled.section`
  background: ${({ theme }) => (theme.dark ? theme.surface : theme.heroInk)};
  position: relative;
  overflow: hidden;
`
export const HeroGlowA = styled.div`
  position: absolute;
  top: -20%;
  right: -8%;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background: radial-gradient(circle, ${({ theme }) => theme.primary}55, transparent 65%);
  pointer-events: none;
`
export const HeroGlowB = styled.div`
  position: absolute;
  bottom: -30%;
  left: -10%;
  width: 460px;
  height: 460px;
  border-radius: 50%;
  background: radial-gradient(circle, ${({ theme }) => theme.accent}33, transparent 65%);
  pointer-events: none;
`
export const HeroInner = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 70px 28px 84px;
  position: relative;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 48px;
  align-items: center;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 36px;
    padding: 40px 18px 44px;
  }
`
export const HeroBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 100px;
  padding: 6px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 24px;
`
export const HeroTitle = styled.h1`
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: 800;
  font-size: clamp(40px, 5vw, 62px);
  line-height: 0.98;
  letter-spacing: -2px;
  color: #fff;
  margin: 0;
`
export const HeroSub = styled.p`
  color: rgba(255, 255, 255, 0.66);
  font-size: 18px;
  line-height: 1.6;
  margin: 20px 0 0;
  max-width: 480px;
  @media (max-width: 900px) {
    font-size: 16px;
  }
`
export const HeroSearch = styled.form`
  margin-top: 34px;
  background: ${({ theme }) => theme.surface};
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  display: flex;
  gap: 0;
  align-items: stretch;
  position: relative;
  @media (max-width: 900px) {
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }
`
export const HeroField = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  position: relative;
  label {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    color: ${({ theme }) => theme.textMut};
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  input {
    border: none;
    outline: none;
    background: transparent;
    font-family: inherit;
    font-size: 14.5px;
    color: ${({ theme }) => theme.text};
    width: 100%;
    padding: 2px 0 0;
    &::placeholder {
      color: ${({ theme }) => theme.textMut};
    }
  }
`
export const HeroDivider = styled.div`
  width: 1px;
  background: ${({ theme }) => theme.border};
  margin: 8px 0;
  @media (max-width: 900px) {
    display: none;
  }
`
export const HeroSubmit = styled.button`
  border: none;
  border-radius: 12px;
  padding: 15px 28px;
  background: ${({ theme }) => theme.primary};
  color: #fff;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 18px ${({ theme }) => theme.primary}44;
  flex-shrink: 0;
  &:active {
    transform: scale(0.98);
  }
`
export const HeroTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
  align-items: center;
`
export const HeroTagLabel = styled.span`
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.5);
`
export const HeroTag = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #fff;
  border-radius: 100px;
  padding: 6px 13px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  text-decoration: none;
  &:hover {
    background: rgba(255, 255, 255, 0.16);
  }
`
export const HeroAside = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
  @media (max-width: 900px) {
    display: none;
  }
`
export const HeroStatCard = styled.div`
  background: ${({ theme }) => theme.surface};
  border-radius: 14px;
  padding: 16px 20px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  gap: 12px;
  strong {
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: 22px;
    color: ${({ theme }) => theme.text};
    line-height: 1;
  }
  span {
    font-size: 11.5px;
    color: ${({ theme }) => theme.textSec};
  }
`
export const SuggestBox = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 12px;
  box-shadow: ${({ theme }) => theme.shadows.md};
  padding: 6px;
  z-index: 20;
  max-height: 320px;
  overflow-y: auto;
`
export const SuggestItem = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  border: none;
  background: transparent;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: ${({ theme }) => theme.text};
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
  .label {
    font-size: 14px;
    font-weight: 600;
  }
  .meta {
    font-size: 12px;
    color: ${({ theme }) => theme.textMut};
  }
`
export const SuggestHint = styled.p`
  padding: 10px 12px;
  font-size: 13px;
  color: ${({ theme }) => theme.textMut};
  margin: 0;
`

/* ── Sections ── */
export const Section = styled.section`
  max-width: 1240px;
  margin: 0 auto;
  padding: 64px 28px 0;
  @media (max-width: 900px) {
    padding: 40px 18px 0;
  }
`
export const Grid4 = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  margin-top: 22px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
`

/* ── Category card ── */
export const CategoryCard = styled.button`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color 0.15s ease, transform 0.15s ease;
  &:hover {
    border-color: ${({ theme }) => theme.primary};
    transform: translateY(-2px);
  }
  .icon {
    width: 46px;
    height: 46px;
    border-radius: 13px;
    background: ${({ theme }) => theme.primarySoft};
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    font-size: 22px;
  }
  .name {
    font-size: 15.5px;
    font-weight: 700;
    color: ${({ theme }) => theme.text};
  }
  .sub {
    font-size: 12px;
    color: ${({ theme }) => theme.textMut};
    margin: 3px 0 10px;
    line-height: 1.4;
    min-height: 34px;
  }
  .count {
    font-size: 12.5px;
    font-weight: 700;
    color: ${({ theme }) => theme.primary};
  }
`

/* ── Boost strip ── */
export const BoostStrip = styled.div`
  background: linear-gradient(120deg, ${({ theme }) => theme.primary}, ${({ theme }) => theme.primaryDk});
  border-radius: 22px;
  padding: 40px 48px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 24px;
  @media (max-width: 900px) {
    flex-direction: column;
    align-items: flex-start;
    padding: 28px 22px;
  }
  .body {
    flex: 1;
    position: relative;
  }
  h3 {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 800;
    font-size: clamp(26px, 3vw, 34px);
    color: #fff;
    margin: 12px 0 0;
    letter-spacing: -1px;
    line-height: 1.05;
  }
  p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 15px;
    margin: 10px 0 0;
    max-width: 440px;
    line-height: 1.5;
  }
`
export const BoostTagPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 100px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
`
export const BoostCta = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  color: ${({ theme }) => theme.primary};
  border: none;
  border-radius: 12px;
  padding: 15px 26px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
`

/* ── How it works ── */
export const HowHead = styled.div`
  text-align: center;
  margin-bottom: 36px;
  h2 {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 800;
    font-size: clamp(28px, 3vw, 38px);
    color: ${({ theme }) => theme.text};
    margin: 0;
    letter-spacing: -1px;
  }
  p {
    color: ${({ theme }) => theme.textSec};
    font-size: 16px;
    margin-top: 10px;
  }
`
export const HowGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`
export const HowCard = styled.div`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 18px;
  padding: 26px 24px;
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 18px;
  }
  .ic {
    width: 48px;
    height: 48px;
    border-radius: 13px;
    background: ${({ theme }) => theme.primarySoft};
    color: ${({ theme }) => theme.primary};
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .num {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 800;
    font-size: 34px;
    color: ${({ theme }) => theme.border};
  }
  .t {
    font-size: 18px;
    font-weight: 700;
    color: ${({ theme }) => theme.text};
    margin-bottom: 8px;
  }
  .d {
    font-size: 14px;
    color: ${({ theme }) => theme.textSec};
    line-height: 1.6;
  }
`
export const HowCta = styled.div`
  text-align: center;
  margin-top: 36px;
`
