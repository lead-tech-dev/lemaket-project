import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import MainLayout from '../../layouts/MainLayout'
import { Icon, ListingCard, SectionHead, Button } from '../../components/ds'
import { useCategories } from '../../hooks/useCategories'
import { useI18n } from '../../contexts/I18nContext'
import { apiGet } from '../../utils/api'
import { listingToCardItem } from '../../utils/listing-card'
import { categoryGradient } from '../../theme/tokens'
import type { Category as CategoryType } from '../../types/category'
import type { Listing } from '../../types/listing'
import type { Paginated } from '../../types/pagination'

const Hero = styled.section<{ $grad: string }>`
  background: ${({ $grad }) => $grad};
  position: relative;
  overflow: hidden;
`
const HeroInner = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 40px 28px 44px;
  position: relative;
  @media (max-width: 640px) {
    padding: 24px 18px 28px;
  }
`
const Crumb = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.75);
  font-size: 12.5px;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
  margin-bottom: 14px;
`
const HeroRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  .badge {
    width: 72px;
    height: 72px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    @media (max-width: 640px) {
      width: 56px;
      height: 56px;
    }
  }
  h1 {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 800;
    font-size: clamp(32px, 5vw, 48px);
    color: #fff;
    margin: 0;
    letter-spacing: -1.5px;
    line-height: 1;
  }
  .sub {
    color: rgba(255, 255, 255, 0.85);
    font-size: 16px;
    margin-top: 6px;
  }
`
const HeroSearch = styled.div`
  margin-top: 26px;
  background: ${({ theme }) => theme.surface};
  border-radius: 14px;
  padding: 6px 6px 6px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 560px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
  span {
    flex: 1;
    font-size: 14.5px;
    color: ${({ theme }) => theme.textMut};
  }
`
const Section = styled.section`
  max-width: 1240px;
  margin: 0 auto;
  padding: 44px 28px 0;
  @media (max-width: 640px) {
    padding: 28px 18px 0;
  }
  h2 {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 800;
    font-size: clamp(22px, 3vw, 26px);
    color: ${({ theme }) => theme.text};
    margin: 0 0 18px;
    letter-spacing: -0.6px;
  }
`
const SubGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
`
const SubCard = styled(Link)`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 14px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-decoration: none;
  transition: border-color 0.15s ease, transform 0.15s ease;
  span {
    font-size: 13.5px;
    font-weight: 600;
    color: ${({ theme }) => theme.text};
  }
  &:hover {
    border-color: ${({ theme }) => theme.primary};
    transform: translateY(-2px);
  }
`
const Grid4 = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  margin-top: 22px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
`
const Cta = styled.div`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 20px;
  padding: 32px 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  @media (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
    padding: 24px 20px;
  }
  h3 {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 800;
    font-size: clamp(22px, 3vw, 26px);
    color: ${({ theme }) => theme.text};
    margin: 0;
    letter-spacing: -0.6px;
  }
  p {
    color: ${({ theme }) => theme.textSec};
    font-size: 15px;
    margin-top: 6px;
  }
`

export default function Category() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const { categories } = useCategories({ activeOnly: false })
  const [listings, setListings] = useState<Listing[]>([])

  const category = useMemo<CategoryType | undefined>(() => {
    const flat: CategoryType[] = []
    categories.forEach((c) => {
      flat.push(c)
      ;(c.children ?? []).forEach((child) => flat.push(child))
    })
    return flat.find((c) => c.slug === slug)
  }, [categories, slug])

  const children = useMemo(
    () => categories.find((c) => c.slug === slug)?.children ?? [],
    [categories, slug]
  )

  useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    apiGet<Paginated<Listing>>(`/listings?category=${encodeURIComponent(slug)}&limit=12`, {
      signal: controller.signal,
      silent: true,
    })
      .then((res) => setListings(res?.data ?? []))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setListings([])
      })
    return () => controller.abort()
  }, [slug])

  const featured = listings.filter((l) => l.isFeatured || l.owner?.isCompanyVerified).slice(0, 4)
  const recent = listings.slice(0, 8)
  const name = category?.name ?? slug
  const grad = categoryGradient(name)
  const searchUrl = `/search?category=${encodeURIComponent(slug)}`

  return (
    <MainLayout>
      <Hero $grad={grad}>
        <HeroInner>
          <Crumb onClick={() => navigate('/')}>
            {t('header.mobile.home')} · {name}
          </Crumb>
          <HeroRow>
            <div className="badge">
              <Icon name="tag" size={36} color="#fff" />
            </div>
            <div>
              <h1>{name}</h1>
              {category?.description ? <div className="sub">{category.description}</div> : null}
            </div>
          </HeroRow>
          <HeroSearch onClick={() => navigate(searchUrl)}>
            <Icon name="search" size={18} color="#97A199" />
            <span>{t('home.search.queryPlaceholder')}</span>
            <Button type="button" onClick={() => navigate(searchUrl)}>
              {t('home.search.submit')}
            </Button>
          </HeroSearch>
        </HeroInner>
      </Hero>

      {children.length ? (
        <Section>
          <h2>{t('home.section.popularCategories')}</h2>
          <SubGrid>
            {children.map((child) => (
              <SubCard key={child.id} to={`/search?category=${encodeURIComponent(child.slug)}`}>
                <span>{child.name}</span>
                <Icon name="chevR" size={15} color="#97A199" />
              </SubCard>
            ))}
          </SubGrid>
        </Section>
      ) : null}

      {featured.length ? (
        <Section>
          <SectionHead
            title={`${t('home.section.featured')} · ${name}`}
            action={
              <Link to={searchUrl} className="lbc-link">
                {t('home.section.featuredAll')}
              </Link>
            }
          />
          <Grid4>
            {featured.map((listing) => (
              <ListingCard
                key={listing.id}
                item={listingToCardItem(listing, numberLocale)}
                onOpen={() => navigate(`/listing/${listing.id}`)}
              />
            ))}
          </Grid4>
        </Section>
      ) : null}

      {recent.length ? (
        <Section>
          <SectionHead
            title={t('home.section.nearby')}
            action={
              <Link to={searchUrl} className="lbc-link">
                {t('home.section.nearbyCustomize')}
              </Link>
            }
          />
          <Grid4>
            {recent.map((listing) => (
              <ListingCard
                key={listing.id}
                item={listingToCardItem(listing, numberLocale)}
                onOpen={() => navigate(`/listing/${listing.id}`)}
              />
            ))}
          </Grid4>
        </Section>
      ) : null}

      <Section style={{ paddingBottom: 8 }}>
        <Cta>
          <div>
            <h3>{t('home.boost.heading')}</h3>
            <p>{t('home.boost.text')}</p>
          </div>
          <Button $kind="accent" type="button" onClick={() => navigate('/listings/new')}>
            <Icon name="plus" size={17} color="#fff" /> {t('header.postListing')}
          </Button>
        </Cta>
      </Section>
    </MainLayout>
  )
}
