import MainLayout from '../../layouts/MainLayout'
import { useI18n } from '../../contexts/I18nContext'

export default function Terms(){
  const { t } = useI18n()
  const sections = [
    {
      title: t('static.terms.sections.accept.title'),
      content: t('static.terms.sections.accept.content'),
    },
    {
      title: t('static.terms.sections.account.title'),
      content: t('static.terms.sections.account.content'),
    },
    {
      title: t('static.terms.sections.listings.title'),
      content: t('static.terms.sections.listings.content'),
    },
    {
      title: t('static.terms.sections.responsibility.title'),
      content: t('static.terms.sections.responsibility.content'),
    },
  ]

  return (
    <MainLayout>
      <section className="static-hero">
        <h1>{t('static.terms.hero.title')}</h1>
        <p>{t('static.terms.hero.subtitle')}</p>
      </section>

      <section className="static-content">
        <ul className="terms-list">
          {sections.map(section => (
            <li key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.content}</p>
            </li>
          ))}
        </ul>
        <p>{t('static.terms.footer')}</p>
      </section>
    </MainLayout>
  )
}
