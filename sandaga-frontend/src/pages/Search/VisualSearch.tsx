import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'
import MainLayout from '../../layouts/MainLayout'
import { Icon, Button, ListingCard, SectionHead } from '../../components/ds'
import { useI18n } from '../../contexts/I18nContext'
import { useFeatureFlagsContext } from '../../contexts/FeatureFlagContext'
import { visualSearch } from '../../utils/ai'
import { listingToCardItem } from '../../utils/listing-card'
import { apiGet } from '../../utils/api'
import type { Listing } from '../../types/listing'
import type { Paginated } from '../../types/pagination'

const Page = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 28px 60px;
  @media (max-width: 640px) {
    padding: 24px 18px 40px;
  }
`
const Title = styled.h1`
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: 800;
  font-size: clamp(28px, 4vw, 38px);
  color: ${({ theme }) => theme.text};
  margin: 0 0 6px;
  letter-spacing: -1px;
`
const Sub = styled.p`
  color: ${({ theme }) => theme.textSec};
  font-size: 16px;
  margin: 0 0 28px;
`
const Drop = styled.button`
  width: 100%;
  border: 2px dashed ${({ theme }) => theme.primary};
  background: ${({ theme }) => theme.primarySoft};
  color: ${({ theme }) => theme.primary};
  border-radius: 20px;
  padding: 60px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  font-family: inherit;
  font-size: 16px;
  font-weight: 700;
`
const Preview = styled.img`
  width: 100%;
  max-height: 360px;
  object-fit: cover;
  border-radius: 18px;
  display: block;
`
const spin = keyframes`to { transform: rotate(360deg); }`
const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid ${({ theme }) => theme.border};
  border-top-color: ${({ theme }) => theme.primary};
  animation: ${spin} 0.8s linear infinite;
`
const Center = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 0;
  color: ${({ theme }) => theme.textSec};
`
const Beta = styled.p`
  background: ${({ theme }) => theme.surfaceAlt};
  color: ${({ theme }) => theme.textSec};
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 13.5px;
  margin: 0 0 22px;
`
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
`
const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
`

type Stage = 'idle' | 'scanning' | 'results'

export default function VisualSearch() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { isEnabled } = useFeatureFlagsContext()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [matches, setMatches] = useState<Listing[]>([])

  if (!isEnabled('visualSearch')) {
    return <Navigate to="/search" replace />
  }

  const runSearch = async (dataUrl: string) => {
    setStage('scanning')
    try {
      const res = await visualSearch(dataUrl)
      setMatches(res.matches ?? [])
    } catch {
      // Fallback gracieux : pas de backend IA → on propose des annonces récentes.
      try {
        const recent = await apiGet<Paginated<Listing>>('/listings?limit=6', { silent: true })
        setMatches(recent?.data ?? [])
      } catch {
        setMatches([])
      }
    }
    setStage('results')
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      setPreview(dataUrl)
      runSearch(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const reset = () => {
    setStage('idle')
    setPreview(null)
    setMatches([])
  }

  return (
    <MainLayout>
      <Page>
        <Title>{t('visual.title')}</Title>
        <Sub>{t('visual.subtitle')}</Sub>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />

        {stage === 'idle' ? (
          <Drop type="button" onClick={() => fileRef.current?.click()}>
            <Icon name="cam" size={40} />
            {t('visual.dropHint')}
            <Button as="span" $kind="soft">
              {t('visual.import')}
            </Button>
          </Drop>
        ) : null}

        {stage === 'scanning' ? (
          <>
            {preview ? <Preview src={preview} alt="" /> : null}
            <Center>
              <Spinner />
              {t('visual.scanning')}
            </Center>
          </>
        ) : null}

        {stage === 'results' ? (
          <>
            <TopBar>
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 14 }}
                />
              ) : (
                <span />
              )}
              <Button $kind="ghost" type="button" onClick={reset}>
                <Icon name="cam" size={17} /> {t('visual.newPhoto')}
              </Button>
            </TopBar>
            <Beta>{t('visual.beta')}</Beta>
            <SectionHead title={t('visual.matches')} />
            {matches.length ? (
              <Grid>
                {matches.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    item={listingToCardItem(listing)}
                    onOpen={() => navigate(`/listing/${listing.id}`)}
                  />
                ))}
              </Grid>
            ) : (
              <p className="ui-feedback ui-feedback--compact">{t('visual.empty')}</p>
            )}
          </>
        ) : null}
      </Page>
    </MainLayout>
  )
}
