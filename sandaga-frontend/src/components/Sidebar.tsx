import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { FeatureFlagName } from '../config/featureFlags'
import { useFeatureFlagsContext } from '../contexts/FeatureFlagContext'
import { useI18n } from '../contexts/I18nContext'

type SidebarLink = {
  to: string
  label: string
  icon?: string
  feature?: FeatureFlagName
  requirePro?: boolean
}

export default function Sidebar(){
  const { user, isPro } = useAuth()
  const { isEnabled } = useFeatureFlagsContext()
  const { t } = useI18n()

  const primaryLinks: SidebarLink[] = [
    { to: '/dashboard', label: t('sidebar.links.dashboard'), icon: '📊' },
    { to: '/dashboard/overview', label: t('sidebar.links.overview'), icon: '⚖️', feature: 'proOverview', requirePro: true },
    { to: '/dashboard/listings', label: t('sidebar.links.listings'), icon: '📦' },
    { to: '/dashboard/orders', label: t('sidebar.links.orders'), icon: '🧾' },
    { to: '/dashboard/deliveries', label: t('sidebar.links.deliveries'), icon: '🛵' },
    { to: '/dashboard/messages', label: t('sidebar.links.messages'), icon: '💬', feature: 'proMessaging', requirePro: true },
    { to: '/dashboard/favorites', label: t('sidebar.links.favorites'), icon: '⭐' },
    { to: '/dashboard/follows', label: t('sidebar.links.follows'), icon: '👥' },
    { to: '/dashboard/alerts', label: t('sidebar.links.alerts'), icon: '🔔' },
  ]

  const accountLinks: SidebarLink[] = [
    { to: '/dashboard/profile', label: t('sidebar.links.profile'), icon: '👤' },
    { to: '/dashboard/settings', label: t('sidebar.links.settings'), icon: '⚙️' },
    { to: '/dashboard/wallet', label: t('sidebar.links.wallet'), icon: '👛' },
    { to: '/dashboard/payments', label: t('sidebar.links.payments'), icon: '💳', feature: 'proPayments', requirePro: true },
    { to: '/dashboard/pro', label: t('sidebar.links.proAccount'), icon: '🏢', feature: 'proPortal', requirePro: true },
  ]

  const supportLinks = [
    { to: '/faq', label: t('sidebar.support.faq') },
    { to: '/contact', label: t('sidebar.support.contact') },
  ]

  const isLinkVisible = (link: SidebarLink) => {
    if (link.requirePro && !isPro) {
      return false
    }
    if (link.feature && !isEnabled(link.feature)) {
      return false
    }
    return true
  }

  const renderLink = ({ to, label, icon }: SidebarLink) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
    >
      {icon && <span className="sidebar__icon" aria-hidden>{icon}</span>}
      <span>{label}</span>
    </NavLink>
  )

  return (
    <aside className="sidebar sidebar--dashboard">
      <header className="sidebar__header">
        <div className="sidebar__avatar" aria-hidden>
          {user ? user.firstName.charAt(0).toUpperCase() : 'A'}
        </div>
        <div className="sidebar__meta">
          <strong>
            {user ? `${user.firstName} ${user.lastName}` : t('sidebar.account.title')}
            {isPro ? <span className="sidebar__badge">PRO</span> : null}
          </strong>
          <span>{user ? t('sidebar.welcome') : t('sidebar.loginPrompt')}</span>
        </div>
      </header>

      <div className="sidebar__section">
        <span className="sidebar__section-label">{t('sidebar.section.workspace')}</span>
        <nav className="sidebar__nav">
          {primaryLinks.filter(isLinkVisible).map(renderLink)}
        </nav>
      </div>

      <div className="sidebar__section">
        <span className="sidebar__section-label">{t('sidebar.section.account')}</span>
        <nav className="sidebar__nav">
          {accountLinks.filter(isLinkVisible).map(renderLink)}
        </nav>
      </div>

      <div className="sidebar__cta">
        <Link to="/listings/new" className="btn btn--primary btn--full">{t('sidebar.cta.postListing')}</Link>
        <Link to="/dashboard/listings" className="btn btn--outline btn--full">{t('sidebar.cta.manageListings')}</Link>
        <Link to="/auth/logout" className="btn btn--ghost btn--full">
          {t('sidebar.cta.logout')}
        </Link>
      </div>

      <footer className="sidebar__footer">
        {supportLinks.map(link => (
          <Link key={link.to} to={link.to} className="sidebar__support-link">
            {link.label}
          </Link>
        ))}
      </footer>
    </aside>
  )
}
