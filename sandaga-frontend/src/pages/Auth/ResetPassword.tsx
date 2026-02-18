import { FormEvent, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { resetPassword } from '../../utils/auth'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'

export default function ResetPassword(){
  const location = useLocation()
  const navigate = useNavigate()
  const token = useMemo(() => {
    const searchParams = new URLSearchParams(location.search)
    const searchToken = searchParams.get('token')
    if (searchToken) {
      return searchToken
    }

    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
    if (hash) {
      const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : hash
      const hashParams = new URLSearchParams(hashQuery)
      const hashToken = hashParams.get('token')
      if (hashToken) {
        return hashToken
      }
    }

    const pathMatch = location.pathname.match(/reset-password\/([^/]+)/i)
    if (pathMatch?.[1]) {
      return pathMatch[1]
    }

    return ''
  }, [location.hash, location.pathname, location.search])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const { addToast } = useToast()
  const { t } = useI18n()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    if (!token) {
      setErrorMessage(t('auth.reset.invalidToken'))
      return
    }

    if (password.length < 8) {
      setErrorMessage(t('auth.reset.passwordMinLength'))
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('auth.reset.passwordMismatch'))
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setFeedback(null)

    try {
      await resetPassword({ token, password })
      const message = t('auth.reset.successMessage')
      setFeedback(message)
      addToast({
        variant: 'success',
        title: t('auth.reset.toast.successTitle'),
        message
      })
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 2000)
    } catch (error) {
      console.error('Unable to reset password', error)
      const message =
        error instanceof Error
          ? error.message
          : t('auth.reset.errorFallback')
      setErrorMessage(message)
      addToast({
        variant: 'error',
        title: t('auth.reset.errorTitle'),
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
            <h1>{t('auth.reset.title')}</h1>
            <p>{t('auth.reset.subtitle')}</p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <FormField
              label={t('auth.reset.passwordLabel')}
              htmlFor="reset-password"
              required
              hint={t('auth.reset.passwordHint')}
            >
              <Input
                id="reset-password"
                type="password"
                placeholder={t('auth.reset.passwordPlaceholder')}
                value={password}
                onChange={event => setPassword(event.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </FormField>
            <FormField label={t('auth.reset.confirmLabel')} htmlFor="reset-password-confirm" required>
              <Input
                id="reset-password-confirm"
                type="password"
                placeholder={t('auth.reset.confirmPlaceholder')}
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </FormField>
            {!token ? (
              <p className="auth-form__error" role="alert">
                {t('auth.reset.invalidToken')}
              </p>
            ) : null}
            {feedback ? (
              <p className="auth-form__hint" role="status">
                {feedback}
              </p>
            ) : null}
            {errorMessage ? (
              <p className="auth-form__error" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <Button type="submit" disabled={isSubmitting || !token}>
              {isSubmitting ? t('auth.reset.submitting') : t('auth.reset.submit')}
            </Button>
          </form>
          <div className="auth-form__actions">
            <Link to="/login" className="lbc-link">{t('auth.reset.login')}</Link>
            <Link to="/register" className="lbc-link">{t('auth.reset.createAccount')}</Link>
          </div>
        </section>
        <aside className="auth-feature">
          <h2>{t('auth.reset.featureTitle')}</h2>
          <ul className="auth-feature__list">
            <li>
              <span className="auth-feature__icon">🔒</span>
              <span>{t('auth.reset.tip1')}</span>
            </li>
            <li>
              <span className="auth-feature__icon">🔁</span>
              <span>{t('auth.reset.tip2')}</span>
            </li>
            <li>
              <span className="auth-feature__icon">📧</span>
              <span>{t('auth.reset.tip3')}</span>
            </li>
          </ul>
        </aside>
      </div>
    </MainLayout>
  )
}
