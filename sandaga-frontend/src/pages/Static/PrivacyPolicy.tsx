import MainLayout from '../../layouts/MainLayout'
import { useI18n } from '../../contexts/I18nContext'

export default function PrivacyPolicy(){
  const { t } = useI18n()
  const policies = [
    { title: t('static.privacy.sections.collect.title'), detail: t('static.privacy.sections.collect.detail') },
    { title: t('static.privacy.sections.use.title'), detail: t('static.privacy.sections.use.detail') },
    { title: t('static.privacy.sections.share.title'), detail: t('static.privacy.sections.share.detail') },
    { title: t('static.privacy.sections.rights.title'), detail: t('static.privacy.sections.rights.detail') },
  ]

  return (
    <MainLayout>
      <section className="static-hero">
        <h1>{t('static.privacy.hero.title')}</h1>
        <p>{t('static.privacy.hero.subtitle')}</p>
      </section>

      <section className="static-content">
        <ul className="policy-list">
          {policies.map(policy => (
            <li key={policy.title}>
              <h3>{policy.title}</h3>
              <p>{policy.detail}</p>
            </li>
          ))}
        </ul>
        <p>{t('static.privacy.footer')}</p>
      </section>
    </MainLayout>
  )
}
