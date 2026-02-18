import MainLayout from '../../layouts/MainLayout'
import { useI18n } from '../../contexts/I18nContext'

export default function About(){
  const { t } = useI18n()
  const milestones = [
    { year: '2016', detail: t('static.about.milestones.2016') },
    { year: '2019', detail: t('static.about.milestones.2019') },
    { year: '2023', detail: t('static.about.milestones.2023') },
  ]

  const values = [
    { title: t('static.about.values.trust.title'), description: t('static.about.values.trust.description') },
    { title: t('static.about.values.local.title'), description: t('static.about.values.local.description') },
    { title: t('static.about.values.innovation.title'), description: t('static.about.values.innovation.description') },
  ]

  return (
    <MainLayout>
      <section className="static-hero">
        <h1>{t('static.about.hero.title')}</h1>
        <p>{t('static.about.hero.subtitle')}</p>
      </section>

      <section className="static-content">
        <div className="static-section">
          <h2>{t('static.about.history.title')}</h2>
          <p>{t('static.about.history.body')}</p>
          <div className="static-grid">
            {milestones.map(item => (
              <div key={item.year} className="card">
                <strong>{item.year}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="static-section">
          <h2>{t('static.about.values.title')}</h2>
          <div className="static-grid">
            {values.map(value => (
              <div key={value.title} className="card">
                <strong>{value.title}</strong>
                <p>{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MainLayout>
  )
}
