import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { login } from '../../utils/auth'
import { invalidateAuthCache } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'

export default function Connexion(){
  const navigate = useNavigate()
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { addToast } = useToast()
  const { t } = useI18n()

  const benefits = [
    t('auth.login.benefit1'),
    t('auth.login.benefit2'),
    t('auth.login.benefit3'),
  ]

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await login(credentials)
      invalidateAuthCache()
      addToast({
        variant: 'success',
        title: t('auth.login.toast.successTitle'),
        message: t('auth.login.toast.successMessage')
      })
      const role = response.user?.role
      const isAdmin = role === 'admin' || role === 'moderator'
      navigate(isAdmin ? '/admin' : '/dashboard', { replace: true })
    } catch (error) {
      console.error('Unable to login', error)
      setErrorMessage(t('auth.login.errorMessage'))
      addToast({
        variant: 'error',
        title: t('auth.login.toast.errorTitle'),
        message: t('auth.login.toast.errorMessage')
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: 'email' | 'password') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setCredentials(prev => ({ ...prev, [field]: event.target.value }))
    }

  return (
    <MainLayout>
      <div className="auth-page">
        <section className="auth-card">
          <div>
            <h1>{t('auth.login.title')}</h1>
            <p>{t('auth.login.subtitle')}</p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <FormField label={t('auth.login.emailLabel')} htmlFor="login-email" required>
              <Input
                id="login-email"
                type="email"
                placeholder={t('auth.login.emailPlaceholder')}
                value={credentials.email}
                onChange={handleChange('email')}
                required
              />
            </FormField>
            <FormField
              label={t('auth.login.passwordLabel')}
              htmlFor="login-password"
              required
              action={<Link to="/forgot-password" className="lbc-link">{t('auth.login.forgot')}</Link>}
            >
              <Input
                id="login-password"
                type="password"
                placeholder={t('auth.login.passwordPlaceholder')}
                value={credentials.password}
                onChange={handleChange('password')}
                required
              />
            </FormField>
            <label className="form-field form-field--inline" htmlFor="login-remember">
              <div className="form-field__control">
                <input id="login-remember" type="checkbox" />
                <span>{t('auth.login.remember')}</span>
              </div>
            </label>
            {errorMessage ? (
              <p className="auth-form__error" role="alert">{errorMessage}</p>
            ) : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
          </form>
          <div className="auth-form__actions">
            <span>{t('auth.login.noAccount')}</span>
            <Link to="/register" className="lbc-link">{t('auth.login.createAccount')}</Link>
          </div>
        </section>
        <aside className="auth-feature">
          <h2>{t('auth.login.featureTitle')}</h2>
          <ul className="auth-feature__list">
            {benefits.map(b => (
              <li key={b}>
                <span className="auth-feature__icon">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <p>{t('auth.login.securityNote')}</p>
        </aside>
      </div>
    </MainLayout>
  )
}
