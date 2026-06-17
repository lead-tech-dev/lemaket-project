import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { useI18n } from '../contexts/I18nContext'
import { Logo, Icon, type IconName } from './ds'

const Wrap = styled.footer`
  background: ${({ theme }) => (theme.dark ? '#0C0D10' : theme.heroInk)};
  color: #fff;
  margin-top: 60px;
`

const Inner = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 56px 28px 32px;
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 40px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
    gap: 28px;
  }
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`

const Tagline = styled.p`
  color: rgba(255, 255, 255, 0.6);
  font-size: 13.5px;
  line-height: 1.7;
  margin-top: 16px;
  max-width: 280px;
`

const Socials = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 18px;
`

const SocialBtn = styled.a`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  &:hover {
    background: rgba(255, 255, 255, 0.18);
  }
`

const ColTitle = styled.div`
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 14px;
`

const ColLink = styled.div`
  margin-bottom: 11px;
  a {
    color: rgba(255, 255, 255, 0.6);
    font-size: 13.5px;
    text-decoration: none;
    &:hover {
      color: #fff;
    }
  }
`

const BottomBar = styled.div`
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`

const Bottom = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 18px 28px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12.5px;
`

const Pay = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  b {
    font-weight: 700;
  }
`

export default function Footer() {
  const { t } = useI18n()

  const columns = [
    {
      title: t('footer.column.company'),
      links: [
        { label: t('footer.link.about'), to: '/about' },
        { label: t('footer.link.contact'), to: '/contact' },
        { label: t('footer.link.press'), to: '/about' },
      ],
    },
    {
      title: t('footer.column.legal'),
      links: [
        { label: t('footer.link.terms'), to: '/terms' },
        { label: t('footer.link.privacy'), to: '/privacy-policy' },
        { label: t('footer.link.faq'), to: '/faq' },
      ],
    },
    {
      title: t('footer.column.follow'),
      links: [
        { label: t('footer.link.facebook'), to: '#' },
        { label: t('footer.link.instagram'), to: '#' },
        { label: t('footer.link.linkedin'), to: '#' },
      ],
    },
  ]

  const socials: IconName[] = ['globe', 'chat', 'phone']

  return (
    <Wrap className="lbc-footer">
      <Inner>
        <div>
          <Logo size={30} light />
          <Tagline>{t('home.m.footTag')}</Tagline>
          <Socials>
            {socials.map((name) => (
              <SocialBtn key={name} href="#" aria-label={name}>
                <Icon name={name} size={17} color="#fff" />
              </SocialBtn>
            ))}
          </Socials>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <ColTitle>{col.title}</ColTitle>
            {col.links.map((link) => (
              <ColLink key={link.label}>
                {link.to.startsWith('#') ? (
                  <a href={link.to}>{link.label}</a>
                ) : (
                  <Link to={link.to}>{link.label}</Link>
                )}
              </ColLink>
            ))}
          </div>
        ))}
      </Inner>
      <BottomBar>
        <Bottom>
          <span>© {new Date().getFullYear()} LEMAKET — {t('footer.bottom.rights')}</span>
          <Pay>
            {t('footer.badge.securePayment')} <b style={{ color: '#FFCC00' }}>MTN MoMo</b> &amp;{' '}
            <b style={{ color: '#FF7900' }}>Orange Money</b>
          </Pay>
        </Bottom>
      </BottomBar>
    </Wrap>
  )
}
