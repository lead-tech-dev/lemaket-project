import { Link } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { useAuth } from '../hooks/useAuth'
import lemaketIcon from '../assets/icons/lemaket-icon.svg'

export default function Footer(){
  const { t } = useI18n()
  const { isPro } = useAuth()
  const proColumn = {
    title: t('footer.column.pro'),
    links: [
      { label: t('footer.link.proAccount'), to: '/dashboard/pro' },
      { label: t('footer.link.ads'), to: '/dashboard/pro' },
      { label: t('footer.link.enterprise'), to: '/dashboard/pro' },
    ],
  }
  const footerColumns = [
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
    ...(isPro ? [proColumn] : []),
    {
      title: t('footer.column.follow'),
      links: [
        { label: t('footer.link.facebook'), to: '#' },
        { label: t('footer.link.instagram'), to: '#' },
        { label: t('footer.link.linkedin'), to: '#' },
      ],
    },
  ]

  return (
    <footer className="lbc-footer">
      <div className="container">
        <div className="lbc-footer__top">
          <div className="lbc-footer__brand">
            <span className="lbc-logo lbc-logo--footer">
              <img src={lemaketIcon} alt="" aria-hidden className="lbc-logo__icon" />
              <span className="lbc-logo__text">LEMAKET</span>
            </span>
            <p>{t('footer.brand.tagline')}</p>
          </div>
          <div className="lbc-footer__columns">
            {footerColumns.map(column => (
              <div key={column.title} className="lbc-footer__column">
                <h4>{column.title}</h4>
                <ul>
                  {column.links.map(link => {
                    const isAnchor = link.to.startsWith('#')
                    return (
                      <li key={link.label}>
                        {isAnchor ? (
                          <a href={link.to}>{link.label}</a>
                        ) : (
                          <Link to={link.to}>{link.label}</Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="lbc-footer__bottom">
          <p>© {new Date().getFullYear()} LEMAKET — {t('footer.bottom.rights')}</p>
          <div className="lbc-footer__badges">
            <span>{t('footer.badge.buyLocal')}</span>
            <span>{t('footer.badge.support')}</span>
            <span>{t('footer.badge.securePayment')}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
