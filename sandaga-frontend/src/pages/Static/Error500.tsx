import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { useI18n } from '../../contexts/I18nContext'

export default function Error500(){
  const { t } = useI18n()

  return (
    <MainLayout>
      <section className="static-content error-page">
        <span className="error-code">500</span>
        <h1>{t('static.error500.title')}</h1>
        <p>{t('static.error500.body')}</p>
        <div className="auth-form__actions">
          <Link to="/" className="btn btn--primary">{t('static.error500.homeCta')}</Link>
          <Link to="/contact" className="btn btn--ghost">{t('static.error500.contactCta')}</Link>
        </div>
      </section>
    </MainLayout>
  )
}
