import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { logout } from '../../utils/auth'
import { invalidateAuthCache } from '../../hooks/useAuth'
import { useI18n } from '../../contexts/I18nContext'

export default function LogoutPage() {
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { t } = useI18n()

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        await logout()
      } catch (error) {
        console.error('Unable to logout', error)
        if (active) {
          setErrorMessage(t('auth.logout.error'))
        }
      } finally {
        invalidateAuthCache()
        if (active) {
          navigate('/login', { replace: true })
        }
      }
    }

    run()

    return () => {
      active = false
    }
  }, [navigate])

  return (
    <MainLayout>
      <div className="auth-page">
        <section className="auth-card">
          <h1>{t('auth.logout.title')}</h1>
          <p>{t('auth.logout.message')}</p>
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        </section>
      </div>
    </MainLayout>
  )
}
