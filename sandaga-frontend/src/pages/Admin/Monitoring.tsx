import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import type {
  SearchAlertDispatchResult,
  SearchOperationalStatus
} from '../../types/admin'
import {
  dispatchSearchOperationalAlerts,
  fetchAdminSettings,
  fetchSearchOperationalStatus,
  updateAdminSettingsBatch,
  type AdminSettingResponse
} from '../../utils/admin-api'

const AUTO_REFRESH_MS = 30_000

export default function AdminMonitoring() {
  const [status, setStatus] = useState<SearchOperationalStatus | null>(null)
  const [lastDispatch, setLastDispatch] = useState<SearchAlertDispatchResult | null>(null)
  const [settings, setSettings] = useState<AdminSettingResponse[]>([])
  const [settingsDraft, setSettingsDraft] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDispatching, setIsDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()
  const { t } = useI18n()

  const loadStatus = useCallback(
    async (showToast = false, force = false) => {
      try {
        const data = await fetchSearchOperationalStatus(force)
        setStatus(data)
        setError(null)
        if (showToast) {
          addToast({
            variant: 'success',
            title: t('admin.monitoring.toast.refreshTitle'),
            message: t('admin.monitoring.toast.refreshSuccess')
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t('admin.monitoring.loadError')
        setError(message)
        if (showToast) {
          addToast({
            variant: 'error',
            title: t('admin.monitoring.toast.refreshErrorTitle'),
            message
          })
        }
      }
    },
    [addToast, t]
  )

  const loadSettings = useCallback(async () => {
    try {
      const allSettings = await fetchAdminSettings()
      const monitoringSettings = allSettings.filter(setting =>
        setting.key.startsWith('monitoring.search.')
      )
      setSettings(monitoringSettings)
      setSettingsDraft(
        monitoringSettings.reduce<Record<string, unknown>>((acc, setting) => {
          acc[setting.key] = setting.value
          return acc
        }, {})
      )
    } catch {
      // silent: monitoring data can still render without settings panel data
    }
  }, [])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    void Promise.all([loadStatus(), loadSettings()])
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [loadSettings, loadStatus])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadStatus()
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [loadStatus])

  const statusToken = useMemo(() => {
    if (!status) {
      return 'unknown'
    }
    return status.status
  }, [status])

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([loadStatus(true, true), loadSettings()])
    setIsRefreshing(false)
  }

  const handleDispatch = async () => {
    setIsDispatching(true)
    try {
      const result = await dispatchSearchOperationalAlerts(true)
      setLastDispatch(result)
      addToast({
        variant: result.dispatched ? 'success' : 'info',
        title: result.dispatched
          ? t('admin.monitoring.toast.dispatchSentTitle')
          : t('admin.monitoring.toast.dispatchSkippedTitle'),
        message: result.message
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('admin.monitoring.dispatchError')
      addToast({
        variant: 'error',
        title: t('admin.monitoring.toast.dispatchErrorTitle'),
        message
      })
    } finally {
      setIsDispatching(false)
    }
  }

  const handleSettingChange = (key: string, value: unknown) => {
    setSettingsDraft(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSaveSettings = async () => {
    setIsSavingSettings(true)
    try {
      const updates = settings.map(setting => {
        const draftValue = settingsDraft[setting.key]
        if (setting.type === 'boolean') {
          return { key: setting.key, value: Boolean(draftValue) }
        }
        if (setting.type === 'number') {
          return { key: setting.key, value: Number(draftValue) }
        }
        return { key: setting.key, value: String(draftValue ?? '') }
      })
      await updateAdminSettingsBatch(updates)
      await Promise.all([loadSettings(), loadStatus(false, true)])
      addToast({
        variant: 'success',
        title: t('admin.monitoring.toast.settingsSavedTitle'),
        message: t('admin.monitoring.toast.settingsSavedMessage')
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('admin.monitoring.settingsSaveError')
      addToast({
        variant: 'error',
        title: t('admin.monitoring.toast.settingsSaveErrorTitle'),
        message
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('admin.monitoring.title')}</h1>
            <p>{t('admin.monitoring.subtitle')}</p>
          </div>
          <div className="admin-filter-bar">
            <Button variant="ghost" onClick={handleRefresh} disabled={isRefreshing || isLoading}>
              {isRefreshing ? t('admin.monitoring.actions.refreshing') : t('admin.monitoring.actions.refresh')}
            </Button>
            <Button variant="outline" onClick={handleDispatch} disabled={isDispatching || isLoading}>
              {isDispatching ? t('admin.monitoring.actions.dispatching') : t('admin.monitoring.actions.dispatch')}
            </Button>
          </div>
        </header>

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading && !status ? (
          <p style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>
            {t('admin.monitoring.loading')}
          </p>
        ) : status ? (
          <>
            <section className="admin-metrics">
              <article className="admin-card admin-monitoring-card">
                <div className="admin-card__meta">
                  <span>{t('admin.monitoring.cards.globalStatus')}</span>
                  <span
                    className={`admin-monitoring-status admin-monitoring-status--${statusToken}`}
                  >
                    {t(`admin.monitoring.status.${statusToken}` as const)}
                  </span>
                </div>
                <strong>{new Date(status.generatedAt).toLocaleString()}</strong>
                <span className="admin-monitoring-muted">
                  {t('admin.monitoring.cards.window', { seconds: String(status.snapshot.windowSeconds) })}
                </span>
              </article>

              <article className="admin-card admin-monitoring-card">
                <div className="admin-card__meta">
                  <span>{t('admin.monitoring.cards.listings')}</span>
                  <strong>{status.snapshot.listings.withSearch.total}</strong>
                </div>
                <span className="admin-monitoring-muted">
                  {t('admin.monitoring.cards.p95')}: {status.snapshot.listings.withSearch.p95LatencyMs.toFixed(2)} ms
                </span>
                <span className="admin-monitoring-muted">
                  {t('admin.monitoring.cards.errorRate')}: {formatPercent(status.snapshot.listings.withSearch.errorRate)}
                </span>
              </article>

              <article className="admin-card admin-monitoring-card">
                <div className="admin-card__meta">
                  <span>{t('admin.monitoring.cards.suggestions')}</span>
                  <strong>{status.snapshot.suggestions.total}</strong>
                </div>
                <span className="admin-monitoring-muted">
                  {t('admin.monitoring.cards.p95')}: {status.snapshot.suggestions.p95LatencyMs.toFixed(2)} ms
                </span>
                <span className="admin-monitoring-muted">
                  {t('admin.monitoring.cards.errorRate')}: {formatPercent(status.snapshot.suggestions.errorRate)}
                </span>
              </article>
            </section>

            <section className="admin-grid">
              <article className="admin-card">
                <h2>{t('admin.monitoring.sections.alerts')}</h2>
                {status.alerts.length ? (
                  <ul>
                    {status.alerts.map((alert, index) => (
                      <li key={`${alert.component}-${alert.metric}-${index}`}>
                        [{alert.severity}] {alert.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-monitoring-muted">{t('admin.monitoring.empty.alerts')}</p>
                )}
              </article>

              <article className="admin-card">
                <h2>{t('admin.monitoring.sections.notes')}</h2>
                {status.notes.length ? (
                  <ul>
                    {status.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-monitoring-muted">{t('admin.monitoring.empty.notes')}</p>
                )}
              </article>

              <article className="admin-card">
                <h2>{t('admin.monitoring.sections.thresholds')}</h2>
                <ul>
                  <li>
                    listings p95: <strong>{status.thresholds.listingsP95Ms} ms</strong>
                  </li>
                  <li>
                    listings error rate: <strong>{formatPercent(status.thresholds.listingsErrorRate)}</strong>
                  </li>
                  <li>
                    suggestions p95: <strong>{status.thresholds.suggestionsP95Ms} ms</strong>
                  </li>
                  <li>
                    suggestions error rate: <strong>{formatPercent(status.thresholds.suggestionsErrorRate)}</strong>
                  </li>
                </ul>
              </article>

              <article className="admin-card">
                <h2>{t('admin.monitoring.sections.dispatch')}</h2>
                {lastDispatch ? (
                  <>
                    <p className="admin-monitoring-muted">{lastDispatch.message}</p>
                    {lastDispatch.channels.length ? (
                      <ul>
                        {lastDispatch.channels.map((channel, index) => (
                          <li key={`${channel.channel}-${index}`}>
                            {channel.channel}: {channel.sent ? 'ok' : 'ko'}
                            {channel.reason ? ` (${channel.reason})` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="admin-monitoring-muted">{t('admin.monitoring.empty.dispatch')}</p>
                )}
              </article>

              <article className="admin-card">
                <h2>{t('admin.monitoring.sections.config')}</h2>
                {settings.length ? (
                  <div className="admin-monitoring-settings">
                    {settings.map(setting => (
                      <label key={setting.key} className="admin-monitoring-settings__row">
                        <span>
                          <strong>{setting.label}</strong>
                          {setting.description ? (
                            <small className="admin-monitoring-muted">{setting.description}</small>
                          ) : null}
                        </span>
                        {setting.type === 'boolean' ? (
                          <input
                            type="checkbox"
                            checked={Boolean(settingsDraft[setting.key])}
                            onChange={event =>
                              handleSettingChange(setting.key, event.target.checked)
                            }
                          />
                        ) : (
                          <input
                            type={setting.type === 'number' ? 'number' : 'text'}
                            min={setting.min}
                            max={setting.max}
                            step={setting.step}
                            value={String(settingsDraft[setting.key] ?? '')}
                            onChange={event =>
                              handleSettingChange(setting.key, event.target.value)
                            }
                          />
                        )}
                      </label>
                    ))}
                    <Button
                      variant="accent"
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                    >
                      {isSavingSettings
                        ? t('admin.monitoring.actions.savingSettings')
                        : t('admin.monitoring.actions.saveSettings')}
                    </Button>
                  </div>
                ) : (
                  <p className="admin-monitoring-muted">{t('admin.monitoring.empty.config')}</p>
                )}
              </article>
            </section>
          </>
        ) : (
          <p className="admin-monitoring-muted">{t('admin.monitoring.loadError')}</p>
        )}
      </div>
    </AdminLayout>
  )
}
