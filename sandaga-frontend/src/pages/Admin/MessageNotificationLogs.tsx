import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import {
  fetchMessageNotificationLogs,
  type MessageNotificationLogQuery
} from '../../utils/admin-api'
import type { MessageNotificationLogEntry } from '../../types/admin'
import { useI18n } from '../../contexts/I18nContext'

const STATUS_BADGES: Record<string, string> = {
  sent: 'admin-status--approved',
  failed: 'admin-status--rejected',
  skipped: 'admin-status--pending'
}

export default function MessageNotificationLogs() {
  const [logs, setLogs] = useState<MessageNotificationLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<MessageNotificationLogQuery>({
    status: '',
    channel: '',
    provider: '',
    search: ''
  })
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
  const statusOptions = useMemo(
    () => [
      { value: 'sent', label: t('admin.notificationLogs.status.sent') },
      { value: 'failed', label: t('admin.notificationLogs.status.failed') },
      { value: 'skipped', label: t('admin.notificationLogs.status.skipped') }
    ],
    [t]
  )
  const channelOptions = useMemo(
    () => [
      { value: 'email', label: t('admin.notificationLogs.channel.email') },
      { value: 'sms', label: t('admin.notificationLogs.channel.sms') },
      { value: 'whatsapp', label: t('admin.notificationLogs.channel.whatsapp') }
    ],
    [t]
  )
  const providerOptions = useMemo(
    () => [
      { value: 'sendgrid', label: t('admin.notificationLogs.provider.sendgrid') },
      { value: 'twilio', label: t('admin.notificationLogs.provider.twilio') }
    ],
    [t]
  )
  const statusLabels = useMemo(
    () => ({
      sent: t('admin.notificationLogs.status.sent'),
      failed: t('admin.notificationLogs.status.failed'),
      skipped: t('admin.notificationLogs.status.skipped')
    }),
    [t]
  )

  const loadLogs = () => {
    setIsLoading(true)
    setError(null)

    fetchMessageNotificationLogs({
      status: filters.status || undefined,
      channel: filters.channel || undefined,
      provider: filters.provider || undefined,
      search: filters.search?.trim() || undefined,
      limit: 100,
      offset: 0
    })
      .then(data => {
        setLogs(data.items)
        setTotal(data.total)
      })
      .catch(err => {
        console.error('Unable to load notification logs', err)
        const message =
          err instanceof Error
            ? err.message
            : t('admin.notificationLogs.loadError')
        setError(message)
        addToast({ variant: 'error', title: t('admin.notificationLogs.toast.errorTitle'), message })
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
            <h1>{t('admin.notificationLogs.title')}</h1>
            <p>{t('admin.notificationLogs.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button variant="ghost" onClick={loadLogs} disabled={isLoading}>
              {t('actions.refresh')}
            </Button>
          </div>
        </header>

        <div className="admin-card">
          <div className="admin-card__meta">
            <div className="admin-filter-bar">
              <Input
                placeholder={t('admin.notificationLogs.searchPlaceholder')}
                value={filters.search ?? ''}
                onChange={event =>
                  setFilters(current => ({ ...current, search: event.target.value }))
                }
              />
              <Select
                value={filters.status ?? ''}
                onChange={value =>
                  setFilters(current => ({ ...current, status: String(value) }))
                }
                options={statusOptions}
                placeholder={t('admin.notificationLogs.filters.statusAll')}
              />
              <Select
                value={filters.channel ?? ''}
                onChange={value =>
                  setFilters(current => ({ ...current, channel: String(value) }))
                }
                options={channelOptions}
                placeholder={t('admin.notificationLogs.filters.channelAll')}
              />
              <Select
                value={filters.provider ?? ''}
                onChange={value =>
                  setFilters(current => ({ ...current, provider: String(value) }))
                }
                options={providerOptions}
                placeholder={t('admin.notificationLogs.filters.providerAll')}
              />
              <Button variant="outline" onClick={loadLogs} disabled={isLoading}>
                {t('admin.notificationLogs.filters.apply')}
              </Button>
            </div>
            <span>
              {total === 1
                ? t('admin.notificationLogs.filters.resultSingle', { count: total })
                : t('admin.notificationLogs.filters.resultMultiple', { count: total })}
            </span>
          </div>

          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}

          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.notificationLogs.table.date')}</th>
                <th>{t('admin.notificationLogs.table.status')}</th>
                <th>{t('admin.notificationLogs.table.channel')}</th>
                <th>{t('admin.notificationLogs.table.provider')}</th>
                <th>{t('admin.notificationLogs.table.destination')}</th>
                <th>{t('admin.notificationLogs.table.message')}</th>
                <th>{t('admin.notificationLogs.table.conversation')}</th>
                <th>{t('admin.notificationLogs.table.recipient')}</th>
                <th>{t('admin.notificationLogs.table.error')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !logs.length ? (
                <tr>
                  <td colSpan={9} style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('admin.notificationLogs.loading')}
                  </td>
                </tr>
              ) : logs.length ? (
                logs.map(log => {
                  const badgeClass = STATUS_BADGES[log.status] ?? 'admin-status--pending'
                  const statusLabel =
                    statusLabels[log.status as keyof typeof statusLabels] ?? log.status
                  return (
                    <tr key={log.id}>
                      <td>{dateTimeFormatter.format(new Date(log.created_at))}</td>
                      <td>
                        <span className={`admin-status ${badgeClass}`}>{statusLabel}</span>
                      </td>
                      <td>{log.channel}</td>
                      <td>{log.provider ?? t('admin.notificationLogs.table.emptyValue')}</td>
                      <td>{log.destination ?? t('admin.notificationLogs.table.emptyValue')}</td>
                      <td>{log.messageId ?? t('admin.notificationLogs.table.emptyValue')}</td>
                      <td>{log.conversationId ?? t('admin.notificationLogs.table.emptyValue')}</td>
                      <td>{log.recipientId ?? t('admin.notificationLogs.table.emptyValue')}</td>
                      <td>{log.error ?? t('admin.notificationLogs.table.emptyValue')}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={9} style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('admin.notificationLogs.empty')}
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
