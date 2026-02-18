import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { forgotPassword } from '../../utils/auth'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'

export default function ForgotPassword(){
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { addToast } = useToast()
  const { t } = useI18n()
  const tips = [
    t('auth.forgot.tip1'),
    t('auth.forgot.tip2'),
    t('auth.forgot.tip3'),
  ]

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || isSubmitting) {
      return
    }
    setIsSubmitting(true)
    setFeedback(null)
    setErrorMessage(null)

    try {
      const response = await forgotPassword({ email: email.trim() })
      const message =
        response?.message ??
        t('auth.forgot.feedbackDefault')
      setFeedback(message)
      addToast({
        variant: 'info',
        title: t('auth.forgot.toast.title'),
        message
      })
    } catch (error) {
      console.error('Unable to request password reset', error)
      const message =
        error instanceof Error
          ? error.message
          : t('auth.forgot.errorFallback')
      setErrorMessage(message)
      addToast({
        variant: 'error',
        title: t('auth.forgot.errorTitle'),
        message
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <MainLayout>
      <div className="auth-page">
        <section className="auth-card">
          <div>
            <h1>{t('auth.forgot.title')}</h1>
            <p>{t('auth.forgot.subtitle')}</p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <FormField label={t('auth.forgot.emailLabel')} htmlFor="forgot-email" required>
              <Input
                id="forgot-email"
                type="email"
                placeholder={t('auth.forgot.emailPlaceholder')}
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </FormField>
            {feedback ? (
              <p className="auth-form__hint" role="status">
                {feedback}
                <br />
                {t('auth.forgot.feedbackTokenPrefix')} <strong>?token=</strong> {t('auth.forgot.feedbackTokenSuffix')}
              </p>
            ) : null}
            {errorMessage ? (
              <p className="auth-form__error" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
            </Button>
          </form>
          <div className="auth-form__actions">
            <Link to="/login" className="lbc-link">{t('auth.forgot.backLogin')}</Link>
            <Link to="/register" className="lbc-link">{t('auth.forgot.createAccount')}</Link>
          </div>
        </section>
        <aside className="auth-feature">
          <h2>{t('auth.forgot.featureTitle')}</h2>
          <ul className="auth-feature__list">
            {tips.map(tip => (
              <li key={tip}>
                <span className="auth-feature__icon">i</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <p>{t('auth.forgot.featureFooter')}</p>
        </aside>
      </div>
    </MainLayout>
  )
}
