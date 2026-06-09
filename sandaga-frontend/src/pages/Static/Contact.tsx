import { useState } from 'react'
import type { FormEvent } from 'react'
import MainLayout from '../../layouts/MainLayout'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'

export default function Contact(){
  const { t } = useI18n()
  const { addToast } = useToast()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })

  const update = (field: keyof typeof form) =>
    (event: { target: { value: string } }) =>
      setForm(prev => ({ ...prev, [field]: event.target.value }))

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Aucun endpoint backend de contact n'existe encore : on évite le rechargement
    // de page (qui perdait la saisie) et on ouvre le client mail de l'utilisateur
    // pré-rempli vers l'adresse de support.
    const supportEmail = t('static.contact.card.supportEmail')
    const subject = form.subject.trim() || t('static.contact.form.title')
    const body = `${form.name}\n${form.email}\n\n${form.message}`
    window.location.href =
      `mailto:${supportEmail}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`
    addToast({
      variant: 'success',
      title: t('static.contact.form.title'),
      message: t('static.contact.form.successMessage')
    })
  }

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

        <form className="contact-form" onSubmit={handleSubmit}>
          <h2>{t('static.contact.form.title')}</h2>
          <FormField label={t('static.contact.form.nameLabel')} htmlFor="contact-name" required>
            <Input
              id="contact-name"
              value={form.name}
              onChange={update('name')}
              placeholder={t('static.contact.form.namePlaceholder')}
              required
            />
          </FormField>
          <FormField label={t('static.contact.form.emailLabel')} htmlFor="contact-email" required>
            <Input
              id="contact-email"
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder={t('static.contact.form.emailPlaceholder')}
              required
            />
          </FormField>
          <FormField label={t('static.contact.form.subjectLabel')} htmlFor="contact-subject">
            <Input
              id="contact-subject"
              value={form.subject}
              onChange={update('subject')}
              placeholder={t('static.contact.form.subjectPlaceholder')}
            />
          </FormField>
          <FormField label={t('static.contact.form.messageLabel')} htmlFor="contact-message" required>
            <textarea
              id="contact-message"
              className="input"
              rows={5}
              value={form.message}
              onChange={update('message')}
              placeholder={t('static.contact.form.messagePlaceholder')}
              required
              aria-required="true"
            />
          </FormField>
          <Button type="submit">{t('static.contact.form.submit')}</Button>
        </form>
      </section>
    </MainLayout>
  )
}
