import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import type {
  AdminActivity,
  AdminMetric,
  SearchAlertDispatchResult,
  SearchOperationalStatus
} from '../../types/admin'
import { useI18n } from '../../contexts/I18nContext'
import {
  dispatchSearchOperationalAlerts,
  fetchSearchOperationalStatus
} from '../../utils/admin-api'
import { apiGet } from '../../utils/api'

export default function AdminHome() {
  const [metrics, setMetrics] = useState<AdminMetric[]>([])
  const [activities, setActivities] = useState<AdminActivity[]>([])
  const [searchStatus, setSearchStatus] = useState<SearchOperationalStatus | null>(null)
  const [lastDispatch, setLastDispatch] = useState<SearchAlertDispatchResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshingSearch, setIsRefreshingSearch] = useState(false)
  const [isDispatching, setIsDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()
  const { t } = useI18n()

  const loadOverview = useCallback(async (activeRef?: { current: boolean }) => {
    const isActive = () => (activeRef ? activeRef.current : true)
    const metricsPromise = apiGet<AdminMetric[]>('/admin/metrics')
    const activitiesPromise = apiGet<AdminActivity[]>('/admin/activities')
    const searchStatusPromise = fetchSearchOperationalStatus()

    return Promise.all([metricsPromise, activitiesPromise, searchStatusPromise])
      .then(([metricsData, activitiesData, searchData]) => {
        if (!isActive()) return
        setMetrics(metricsData)
        setActivities(activitiesData)
        setSearchStatus(searchData)
      })
      .catch(err => {
        console.error('Unable to load admin overview', err)
        if (!isActive()) return
        const message =
          err instanceof Error ? err.message : t('admin.home.loadError')
        setError(message)
        addToast({ variant: 'error', title: t('admin.home.toast.errorTitle'), message })
      })
      .finally(() => {
        if (isActive()) {
          setIsLoading(false)
        }
      })
  }, [addToast, t])

  useEffect(() => {
    const activeRef = { current: true }
    setIsLoading(true)
    setError(null)
    void loadOverview(activeRef)

    return () => {
      activeRef.current = false
    }
  }, [loadOverview])

  const statusChip = useMemo(() => {
    const status = searchStatus?.status
    if (!status) {
      return { label: 'INCONNU', color: '#6c757d', background: '#f1f3f5' }
    }
    if (status === 'critical') {
      return { label: 'CRITIQUE', color: '#b42318', background: '#fee4e2' }
    }
    if (status === 'degraded') {
      return { label: 'DEGRADE', color: '#b54708', background: '#fffaeb' }
    }
    if (status === 'ok') {
      return { label: 'OK', color: '#027a48', background: '#ecfdf3' }
    }
    return { label: 'INCONNU', color: '#6c757d', background: '#f1f3f5' }
  }, [searchStatus])

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`
  const listingsWithSearch = searchStatus?.snapshot?.listings?.withSearch ?? {
    total: 0,
    errors: 0,
    errorRate: 0,
    successRate: 1,
    p95LatencyMs: 0
  }
  const suggestionsSummary = searchStatus?.snapshot?.suggestions ?? {
    total: 0,
    errors: 0,
    errorRate: 0,
    successRate: 1,
    p95LatencyMs: 0
  }
  const searchAlerts = Array.isArray(searchStatus?.alerts) ? searchStatus.alerts : []
  const canRenderSearchMonitoring = Boolean(searchStatus)

  const handleRefreshSearch = async () => {
    setIsRefreshingSearch(true)
    try {
      const data = await fetchSearchOperationalStatus()
      setSearchStatus(data)
      addToast({
        variant: 'success',
        title: 'Monitoring actualisé',
        message: 'Statut recherche mis à jour.'
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de rafraichissement.'
      addToast({
        variant: 'error',
        title: 'Monitoring indisponible',
        message
      })
    } finally {
      setIsRefreshingSearch(false)
    }
  }

  const handleDispatch = async () => {
    setIsDispatching(true)
    try {
      const result = await dispatchSearchOperationalAlerts(true)
      setLastDispatch(result)
      addToast({
        variant: result.dispatched ? 'success' : 'info',
        title: result.dispatched ? 'Alerte envoyee' : 'Alerte non envoyee',
        message: result.message
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur d'envoi d'alerte."
      addToast({
        variant: 'error',
        title: "Echec d'envoi",
        message
      })
    } finally {
      setIsDispatching(false)
    }
  }

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

        <section className="dashboard-section">
          <div className="dashboard-section__head">
            <h2>Monitoring recherche</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="ghost"
                onClick={handleRefreshSearch}
                disabled={isRefreshingSearch || isLoading}
              >
                {isRefreshingSearch ? 'Rafraichissement...' : 'Rafraichir'}
              </Button>
              <Button
                variant="outline"
                onClick={handleDispatch}
                disabled={isDispatching || isLoading}
              >
                {isDispatching ? 'Envoi...' : 'Envoyer alerte'}
              </Button>
            </div>
          </div>

          {canRenderSearchMonitoring ? (
            <div className="message-list" style={{ gap: 12 }}>
              <div className="message-item" style={{ alignItems: 'flex-start', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 10px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 12,
                    color: statusChip.color,
                    background: statusChip.background
                  }}
                >
                  {statusChip.label}
                </span>
                <span className="message-item__snippet">
                  Derniere mesure: {new Date(searchStatus?.generatedAt ?? Date.now()).toLocaleString()}
                </span>
              </div>

              <div className="message-item" style={{ alignItems: 'flex-start', gap: 6 }}>
                <span className="message-item__title">Listings (avec recherche)</span>
                <span className="message-item__snippet">
                  requetes: {listingsWithSearch.total} | p95:{' '}
                  {listingsWithSearch.p95LatencyMs.toFixed(2)} ms | erreurs:{' '}
                  {formatPercent(listingsWithSearch.errorRate)}
                </span>
              </div>

              <div className="message-item" style={{ alignItems: 'flex-start', gap: 6 }}>
                <span className="message-item__title">Suggestions</span>
                <span className="message-item__snippet">
                  requetes: {suggestionsSummary.total} | p95:{' '}
                  {suggestionsSummary.p95LatencyMs.toFixed(2)} ms | erreurs:{' '}
                  {formatPercent(suggestionsSummary.errorRate)}
                </span>
              </div>

              {searchAlerts.length ? (
                <div className="message-item" style={{ alignItems: 'flex-start', gap: 6 }}>
                  <span className="message-item__title">Alertes actives ({searchAlerts.length})</span>
                  {searchAlerts.map((alert, index) => (
                    <span key={`${alert.component}-${alert.metric}-${index}`} className="message-item__snippet">
                      [{alert.severity}] {alert.message}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="message-item" style={{ alignItems: 'flex-start', gap: 6 }}>
                  <span className="message-item__title">Alertes actives</span>
                  <span className="message-item__snippet">Aucune alerte.</span>
                </div>
              )}

              {lastDispatch ? (
                <div className="message-item" style={{ alignItems: 'flex-start', gap: 6 }}>
                  <span className="message-item__title">Dernier dispatch</span>
                  <span className="message-item__snippet">{lastDispatch.message}</span>
                  {lastDispatch.channels.length ? (
                    <span className="message-item__snippet">
                      Canaux: {lastDispatch.channels.map(channel => `${channel.channel}:${channel.sent ? 'ok' : 'ko'}`).join(', ')}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {isLoading ? 'Chargement monitoring...' : 'Monitoring indisponible.'}
            </p>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
