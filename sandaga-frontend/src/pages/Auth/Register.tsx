import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { register as registerUser } from '../../utils/auth'
import { invalidateAuthCache, useAuth } from '../../hooks/useAuth'
import { useUserPreferences } from '../../hooks/useUserPreferences'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'

export default function Inscription(){
  const navigate = useNavigate()
  const { isPro } = useAuth()
  const { setPreference } = useUserPreferences()
  const { addToast } = useToast()
  const { t } = useI18n()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
    companyName: '',
    companyId: '',
    companyNiu: '',
    companyRccm: '',
    companyCity: '',
    accountType: 'individual' as 'individual' | 'pro'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showProModal, setShowProModal] = useState(false)
  const steps = [
    { title: t('auth.register.featureStep1.title'), description: t('auth.register.featureStep1.desc') },
    { title: t('auth.register.featureStep2.title'), description: t('auth.register.featureStep2.desc') },
    { title: t('auth.register.featureStep3.title'), description: t('auth.register.featureStep3.desc') },
  ]

  const handleChange =
    (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: event.target.value }))
    }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await registerUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phoneNumber: form.phoneNumber || undefined,
        isPro: form.accountType === 'pro',
        companyName: form.accountType === 'pro' ? form.companyName || undefined : undefined,
        companyId: form.accountType === 'pro' ? form.companyId || undefined : undefined,
        companyNiu: form.accountType === 'pro' ? form.companyNiu || undefined : undefined,
        companyRccm: form.accountType === 'pro' ? form.companyRccm || undefined : undefined,
        companyCity: form.accountType === 'pro' ? form.companyCity || undefined : undefined
      })
      invalidateAuthCache()
      const becamePro = form.accountType === 'pro'
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phoneNumber: '',
        companyName: '',
        companyId: '',
        companyNiu: '',
        companyRccm: '',
        companyCity: '',
        accountType: 'individual'
      })
      if (becamePro) {
        setPreference('sellerType', 'pro')
        setShowProModal(true)
      } else {
        navigate('/dashboard', { replace: true })
        addToast({
          variant: 'success',
          title: t('auth.register.toast.successTitle'),
          message: t('auth.register.toast.successMessage')
        })
      }
    } catch (error) {
      console.error('Unable to register', error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('auth.register.errorFallback')
      )
      addToast({
        variant: 'error',
        title: t('auth.register.toast.errorTitle'),
        message: t('auth.register.toast.errorMessage')
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
            <h1>{t('auth.register.title')}</h1>
            <p>{t('auth.register.subtitle')}</p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="grid" style={{ gap: '24px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <FormField label={t('auth.register.firstName')} htmlFor="register-firstname" required>
                <Input
                  id="register-firstname"
                  placeholder={t('auth.register.firstNamePlaceholder')}
                  value={form.firstName}
                  onChange={handleChange('firstName')}
                  required
                />
              </FormField>
              <FormField label={t('auth.register.lastName')} htmlFor="register-lastname" required>
                <Input
                  id="register-lastname"
                  placeholder={t('auth.register.lastNamePlaceholder')}
                  value={form.lastName}
                  onChange={handleChange('lastName')}
                  required
                />
              </FormField>
            </div>
            <FormField label={t('auth.register.emailLabel')} htmlFor="register-email" required>
              <Input
                id="register-email"
                type="email"
                placeholder={t('auth.register.emailPlaceholder')}
                value={form.email}
                onChange={handleChange('email')}
                required
              />
            </FormField>
            <FormField
              label={t('auth.register.passwordLabel')}
              htmlFor="register-password"
              required
              hint={t('auth.register.passwordHint')}
            >
              <Input
                id="register-password"
                type="password"
                placeholder={t('auth.register.passwordPlaceholder')}
                value={form.password}
                onChange={handleChange('password')}
                required
              />
            </FormField>
            <FormField
              label={t('auth.register.phoneLabel')}
              htmlFor="register-phone"
              hint={t('auth.register.phoneHint')}
            >
              <Input
                id="register-phone"
                placeholder={t('auth.register.phonePlaceholder')}
                value={form.phoneNumber}
                onChange={handleChange('phoneNumber')}
              />
            </FormField>
            <FormField label={t('auth.register.accountTypeLabel')} required>
              <div className="auth-form__actions">
                <label className="btn btn--outline">
                  <input
                    type="radio"
                    name="account-type"
                    value="individual"
                    checked={form.accountType === 'individual'}
                    onChange={() => setForm(prev => ({ ...prev, accountType: 'individual' }))}
                  />{' '}
                  {t('auth.register.accountType.individual')}
                </label>
                <label className="btn btn--outline">
                  <input
                    type="radio"
                    name="account-type"
                    value="pro"
                    checked={form.accountType === 'pro'}
                    onChange={() => setForm(prev => ({ ...prev, accountType: 'pro' }))}
                  />{' '}
                  {t('auth.register.accountType.pro')}
                </label>
              </div>
              <p className="auth-form__hint">
                <strong>{t('auth.register.proHintLabel')}</strong> {t('auth.register.proHint')}
              </p>
            </FormField>
            {form.accountType === 'pro' ? (
              <div className="grid" style={{ gap: '24px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <FormField label={t('auth.register.companyName')} htmlFor="register-company" required>
                  <Input
                    id="register-company"
                    placeholder={t('auth.register.companyNamePlaceholder')}
                    value={form.companyName}
                    onChange={handleChange('companyName')}
                    required
                  />
                </FormField>
                <FormField label={t('auth.register.companyId')} htmlFor="register-siret" required>
                  <Input
                    id="register-siret"
                    placeholder={t('auth.register.companyIdPlaceholder')}
                    value={form.companyId}
                    onChange={handleChange('companyId')}
                    required
                  />
                </FormField>
                <FormField label={t('auth.register.companyNiu')} htmlFor="register-niu">
                  <Input
                    id="register-niu"
                    placeholder={t('auth.register.companyNiuPlaceholder')}
                    value={form.companyNiu}
                    onChange={handleChange('companyNiu')}
                  />
                </FormField>
                <FormField label={t('auth.register.companyRccm')} htmlFor="register-rccm">
                  <Input
                    id="register-rccm"
                    placeholder={t('auth.register.companyRccmPlaceholder')}
                    value={form.companyRccm}
                    onChange={handleChange('companyRccm')}
                  />
                </FormField>
                <FormField label={t('auth.register.companyCity')} htmlFor="register-company-city">
                  <Input
                    id="register-company-city"
                    placeholder={t('auth.register.companyCityPlaceholder')}
                    value={form.companyCity}
                    onChange={handleChange('companyCity')}
                  />
                </FormField>
              </div>
            ) : null}
            <label className="form-field form-field--inline" htmlFor="register-consent">
              <div className="form-field__control">
                <input id="register-consent" type="checkbox" required />
                <span>
                  {t('auth.register.consentPrefix')}{' '}
                  <Link to="/terms" className="lbc-link">{t('auth.register.consentTerms')}</Link>{' '}
                  {t('auth.register.consentAnd')}{' '}
                  <Link to="/privacy-policy" className="lbc-link">{t('auth.register.consentPrivacy')}</Link>.
                </span>
              </div>
            </label>
            {errorMessage ? (
              <p className="auth-form__error" role="alert">{errorMessage}</p>
            ) : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')}
            </Button>
          </form>
          <div className="auth-form__actions">
            <span>{t('auth.register.already')}</span>
            <Link to="/login" className="lbc-link">{t('auth.register.login')}</Link>
          </div>
        </section>
        <aside className="auth-feature">
          <h2>{t('auth.register.featureTitle')}</h2>
          <ul className="auth-feature__list">
            {steps.map(step => (
              <li key={step.title}>
                <span className="auth-feature__icon">•</span>
                <span>
                  <strong>{step.title}</strong>
                  <br />
                  {step.description}
                </span>
              </li>
            ))}
          </ul>
          <p>{t('auth.register.featureFooter')}</p>
        </aside>
      </div>
      <Modal
        open={showProModal}
        title={t('auth.register.proModal.title')}
        description={t('auth.register.proModal.description')}
        onClose={() => {
          setShowProModal(false)
          navigate('/dashboard', { replace: true })
        }}
        footer={
          <Button
            onClick={() => {
              setShowProModal(false)
              navigate('/dashboard', { replace: true })
            }}
          >
            {t('auth.register.proModal.cta')}
          </Button>
        }
      >
        <ul className="auth-feature__list">
          <li>
            <span className="auth-feature__icon">✓</span>
            <span>{t('auth.register.proModal.benefit1')}</span>
          </li>
          <li>
            <span className="auth-feature__icon">✓</span>
            <span>{t('auth.register.proModal.benefit2')}</span>
          </li>
          <li>
            <span className="auth-feature__icon">✓</span>
            <span>{t('auth.register.proModal.benefit3')}</span>
          </li>
        </ul>
      </Modal>
    </MainLayout>
  )
}
