import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useI18n } from '../../contexts/I18nContext'

export default function Error404(){
  const { t } = useI18n()

  return (
    <MainLayout>
      <section className="static-content error-page">
        <span className="error-code">404</span>
        <h1>{t('static.error404.title')}</h1>
        <p>{t('static.error404.body')}</p>
        <div className="auth-form__actions">
          <Link to="/" className="btn btn--primary">{t('static.error404.homeCta')}</Link>
          <Link to="/search" className="btn btn--ghost">{t('static.error404.listingsCta')}</Link>
        </div>
      </section>
    </MainLayout>
  )
}
