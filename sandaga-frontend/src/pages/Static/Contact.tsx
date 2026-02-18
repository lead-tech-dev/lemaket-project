import MainLayout from '../../layouts/MainLayout'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useI18n } from '../../contexts/I18nContext'

export default function Contact(){
  const { t } = useI18n()

  return (
    <MainLayout>
      <section className="static-hero">
        <h1>{t('static.contact.hero.title')}</h1>
        <p>{t('static.contact.hero.subtitle')}</p>
      </section>

      <section className="static-content contact-grid">
        <div className="contact-card">
          <h2>{t('static.contact.card.supportTitle')}</h2>
          <p>{t('static.contact.card.supportEmail')}</p>
          <p>{t('static.contact.card.supportPhone')}</p>
          <h3>{t('static.contact.card.hoursTitle')}</h3>
          <p>{t('static.contact.card.hoursWeek')}</p>
          <p>{t('static.contact.card.hoursWeekend')}</p>
        </div>

        <form className="contact-form">
          <h2>{t('static.contact.form.title')}</h2>
          <FormField label={t('static.contact.form.nameLabel')} htmlFor="contact-name" required>
            <Input id="contact-name" placeholder={t('static.contact.form.namePlaceholder')} />
          </FormField>
          <FormField label={t('static.contact.form.emailLabel')} htmlFor="contact-email" required>
            <Input id="contact-email" type="email" placeholder={t('static.contact.form.emailPlaceholder')} />
          </FormField>
          <FormField label={t('static.contact.form.subjectLabel')} htmlFor="contact-subject">
            <Input id="contact-subject" placeholder={t('static.contact.form.subjectPlaceholder')} />
          </FormField>
          <FormField label={t('static.contact.form.messageLabel')} htmlFor="contact-message" required>
            <textarea
              id="contact-message"
              className="input"
              rows={5}
              placeholder={t('static.contact.form.messagePlaceholder')}
            />
          </FormField>
          <Button type="submit">{t('static.contact.form.submit')}</Button>
        </form>
      </section>
    </MainLayout>
  )
}
