import MainLayout from '../../layouts/MainLayout'
import { useI18n } from '../../contexts/I18nContext'

export default function Faq(){
  const { t } = useI18n()
  const questions = [
    {
      question: t('static.faq.questions.transaction.question'),
      answer: t('static.faq.questions.transaction.answer')
    },
    {
      question: t('static.faq.questions.promote.question'),
      answer: t('static.faq.questions.promote.answer')
    },
    {
      question: t('static.faq.questions.report.question'),
      answer: t('static.faq.questions.report.answer')
    }
  ]

  return (
    <MainLayout>
      <section className="static-hero">
        <h1>{t('static.faq.hero.title')}</h1>
        <p>{t('static.faq.hero.subtitle')}</p>
      </section>

      <section className="static-content">
        <div className="faq-accordion">
          {questions.map(item => (
            <div key={item.question} className="faq-item">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}
        </div>
        <p>{t('static.faq.footer')}</p>
      </section>
    </MainLayout>
  )
}
