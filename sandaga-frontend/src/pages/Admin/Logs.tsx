import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { apiGet } from '../../utils/api'
import { useToast } from '../../components/ui/Toast'
import type { AdminLogEntry } from '../../types/admin'
import { useExportJob } from '../../hooks/useExportJob'
import { useI18n } from '../../contexts/I18nContext'

export default function Logs() {
  const [logs, setLogs] = useState<AdminLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()
  const { t, locale } = useI18n()
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short'
      }),
    [locale]
  )

  const { startExport, isRunning: isExportRunning, progress: exportProgress } = useExportJob('logs', {
    onStart: () =>
      addToast({
        variant: 'info',
        title: t('admin.logs.export.startTitle'),
        message: t('admin.logs.export.startMessage')
      }),
    onDownload: filename =>
      addToast({
        variant: 'success',
        title: t('admin.logs.export.doneTitle'),
        message: t('admin.logs.export.doneMessage', { filename })
      }),
    onError: message =>
      addToast({
        variant: 'error',
        title: t('admin.logs.export.errorTitle'),
        message
      })
  })

  const loadLogs = () => {
    setIsLoading(true)
    setError(null)

    apiGet<AdminLogEntry[]>('/admin/logs')
      .then(data => {
        setLogs(data)
      })
      .catch(err => {
        console.error('Unable to load admin logs', err)
        const message =
          err instanceof Error
            ? err.message
            : t('admin.logs.loadError')
        setError(message)
        addToast({ variant: 'error', title: t('admin.logs.toast.errorTitle'), message })
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    loadLogs()
  }, [])

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('admin.logs.title')}</h1>
            <p>{t('admin.logs.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              variant="outline"
              onClick={() => startExport('csv')}
              disabled={isExportRunning}
            >
              {t('admin.logs.export.csv')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => startExport('xlsx')}
              disabled={isExportRunning}
            >
              {t('admin.logs.export.excel')}
            </Button>
            {isExportRunning ? (
              <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>
                {t('admin.logs.export.progress', { progress: exportProgress })}
              </span>
            ) : null}
            <Button variant="ghost" onClick={loadLogs} disabled={isLoading}>
              {t('actions.refresh')}
            </Button>
          </div>
        </header>

        <div className="admin-card">
          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.logs.table.date')}</th>
                <th>{t('admin.logs.table.action')}</th>
                <th>{t('admin.logs.table.details')}</th>
                <th>{t('admin.logs.table.user')}</th>
                <th>{t('admin.logs.table.ip')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !logs.length ? (
                <tr>
                  <td colSpan={5} style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('admin.logs.loading')}
                  </td>
                </tr>
              ) : logs.length ? (
                logs.map(log => (
                  <tr key={log.id}>
                    <td>{dateTimeFormatter.format(new Date(log.created_at))}</td>
                    <td>{log.action}</td>
                    <td>{log.details ?? t('admin.logs.table.emptyValue')}</td>
                    <td>{log.actorName ?? t('admin.logs.table.system')}</td>
                    <td>{log.ipAddress ?? t('admin.logs.table.emptyValue')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('admin.logs.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
