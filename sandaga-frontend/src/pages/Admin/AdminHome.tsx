import { useEffect, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { apiGet } from '../../utils/api'
import { useToast } from '../../components/ui/Toast'
import type { AdminActivity, AdminMetric } from '../../types/admin'
import { useI18n } from '../../contexts/I18nContext'

export default function AdminHome() {
  const [metrics, setMetrics] = useState<AdminMetric[]>([])
  const [activities, setActivities] = useState<AdminActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()
  const { t } = useI18n()

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)

    const metricsPromise = apiGet<AdminMetric[]>('/admin/metrics')
    const activitiesPromise = apiGet<AdminActivity[]>('/admin/activities')

    Promise.all([metricsPromise, activitiesPromise])
      .then(([metricsData, activitiesData]) => {
        if (!active) return
        setMetrics(metricsData)
        setActivities(activitiesData)
      })
      .catch(err => {
        console.error('Unable to load admin overview', err)
        if (!active) return
        const message =
          err instanceof Error ? err.message : t('admin.home.loadError')
        setError(message)
        addToast({ variant: 'error', title: t('admin.home.toast.errorTitle'), message })
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [addToast])

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('admin.home.title')}</h1>
            <p>{t('admin.home.subtitle')}</p>
          </div>
          <Button variant="accent">{t('admin.home.supervision')}</Button>
        </header>

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <section className="admin-metrics">
          {isLoading && !metrics.length ? (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {t('admin.home.metrics.loading')}
            </p>
          ) : metrics.length ? (
            metrics.map(metric => (
              <div key={metric.label} className={`admin-metric ${metric.accent ?? ''}`}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))
          ) : (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {t('admin.home.metrics.empty')}
            </p>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__head">
            <h2>{t('admin.home.activities.title')}</h2>
          </div>
          <div className="message-list">
            {isLoading && !activities.length ? (
              <p style={{ padding: '1rem', color: '#6c757d' }}>
                {t('admin.home.activities.loading')}
              </p>
            ) : activities.length ? (
              activities.map(activity => (
                <div key={activity.id} className="message-item">
                  <span className="message-item__title">{activity.label}</span>
                  {activity.detail ? (
                    <span className="message-item__snippet">{activity.detail}</span>
                  ) : null}
                  <span className="message-item__snippet">{activity.time}</span>
                </div>
              ))
            ) : (
              <p style={{ padding: '1rem', color: '#6c757d' }}>
                {t('admin.home.activities.empty')}
              </p>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
