import { Link, NavLink } from 'react-router-dom'
import type { FeatureFlagName } from '../config/featureFlags'
import { useFeatureFlagsContext } from '../contexts/FeatureFlagContext'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../contexts/I18nContext'
import type { TranslationKey } from '../i18n/translations'

type AdminSidebarLink = {
  to: string
  labelKey: TranslationKey
  icon?: string
  feature?: FeatureFlagName
}

export function AdminSidebar(){
  const { t } = useI18n()
  const { isEnabled } = useFeatureFlagsContext()
  const { user } = useAuth()
  const initials = user
    ? `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.trim() || 'S'
    : 'S'

  const overviewLinks: AdminSidebarLink[] = [
    { to: '/admin', labelKey: 'admin.sidebar.links.overview', icon: '📊', feature: 'adminConsole' },
    { to: '/admin/listings', labelKey: 'admin.sidebar.links.moderation', icon: '🛡️', feature: 'adminConsole' },
    { to: '/admin/reports', labelKey: 'admin.sidebar.links.reports', icon: '🚨', feature: 'adminConsole' },
  ]

  const managementLinks: AdminSidebarLink[] = [
    { to: '/admin/users', labelKey: 'admin.sidebar.links.users', icon: '👥', feature: 'adminConsole' },
    { to: '/admin/company-verifications', labelKey: 'admin.sidebar.links.companyVerifications', icon: '✅', feature: 'adminConsole' },
    { to: '/admin/courier-verifications', labelKey: 'admin.sidebar.links.courierVerifications', icon: '🛵', feature: 'adminConsole' },
    { to: '/admin/platform-wallet', labelKey: 'admin.sidebar.links.platformWallet', icon: '💼', feature: 'adminConsole' },
    { to: '/admin/zikopay-transactions', labelKey: 'admin.sidebar.links.zikopayTransactions', icon: '💳', feature: 'adminConsole' },
    { to: '/admin/categories', labelKey: 'admin.sidebar.links.categories', icon: '🗂️', feature: 'adminConsole' },
    { to: '/admin/promotions', labelKey: 'admin.sidebar.links.promotions', icon: '📣', feature: 'adminPromotions' },
    { to: '/admin/logs', labelKey: 'admin.sidebar.links.logs', icon: '📝', feature: 'adminLogs' },
    { to: '/admin/notification-logs', labelKey: 'admin.sidebar.links.notificationLogs', icon: '📨', feature: 'adminLogs' },
  ]

  const configLinks: AdminSidebarLink[] = [
    { to: '/admin/settings', labelKey: 'admin.sidebar.links.settings', icon: '⚙️', feature: 'adminSettings' },
    { to: '/terms', labelKey: 'admin.sidebar.links.terms', icon: '📄' },
    { to: '/privacy-policy', labelKey: 'admin.sidebar.links.privacy', icon: '🔐' },
  ]

  const isVisible = (link: AdminSidebarLink) => {
    if (link.feature && !isEnabled(link.feature)) {
      return false
    }
    return true
  }

  const renderLink = ({ to, labelKey, icon }: AdminSidebarLink) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
    >
      {icon && <span className="sidebar__icon" aria-hidden>{icon}</span>}
      <span>{t(labelKey)}</span>
    </NavLink>
  )

  return (
    <aside className="sidebar sidebar--admin">
      <header className="sidebar__header">
        <div className="sidebar__avatar" aria-hidden>
          {initials}
        </div>
        <div className="sidebar__meta">
          <strong>
            {user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : t('admin.sidebar.userFallback')}
          </strong>
          <span>{t('admin.sidebar.role')}</span>
        </div>
      </header>

      <div className="sidebar__section">
        <span className="sidebar__section-label">{t('admin.sidebar.sections.supervision')}</span>
        <nav className="sidebar__nav">
          {overviewLinks.filter(isVisible).map(renderLink)}
        </nav>
      </div>

      <div className="sidebar__section">
        <span className="sidebar__section-label">{t('admin.sidebar.sections.management')}</span>
        <nav className="sidebar__nav">
          {managementLinks.filter(isVisible).map(renderLink)}
        </nav>
      </div>

      <div className="sidebar__section">
        <span className="sidebar__section-label">{t('admin.sidebar.sections.configuration')}</span>
        <nav className="sidebar__nav">
          {configLinks.filter(isVisible).map(renderLink)}
        </nav>
      </div>

      <div className="sidebar__cta">
        <Link to="/admin/listings" className="btn btn--accent btn--full">{t('admin.sidebar.cta.supervision')}</Link>
        <Link to="/admin/promotions" className="btn btn--outline btn--full">{t('admin.sidebar.cta.createCampaign')}</Link>
        <Link to="/auth/logout" className="btn btn--ghost btn--full">
          {t('admin.sidebar.cta.logout')}
        </Link>
      </div>
    </aside>
  )
}
