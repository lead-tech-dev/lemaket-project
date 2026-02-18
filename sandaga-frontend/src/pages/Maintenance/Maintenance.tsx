import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useI18n } from '../../contexts/I18nContext'

export default function Maintenance(){
  const { t } = useI18n()

  return (
    <MainLayout>
      <section className="static-content maintenance-page">
        <div className="maintenance-illustration">🔧</div>
        <h1>{t('maintenance.title')}</h1>
        <p>{t('maintenance.body')}</p>
        <div className="maintenance-actions">
          <Link to="/" className="btn btn--primary">{t('maintenance.homeCta')}</Link>
          <Link to="/contact" className="btn btn--ghost">{t('maintenance.contactCta')}</Link>
        </div>
        <span>{t('maintenance.eta')}</span>
      </section>
    </MainLayout>
  )
}
