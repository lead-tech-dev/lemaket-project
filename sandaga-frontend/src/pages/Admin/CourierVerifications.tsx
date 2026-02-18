import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import { apiPatch } from '../../utils/api'
import { fetchCourierVerifications } from '../../utils/admin-api'
import { useExportJob } from '../../hooks/useExportJob'
import type { AdminUser } from '../../types/user'

export default function CourierVerifications() {
  const { t, locale } = useI18n()
  const { addToast } = useToast()
  const localeTag = locale === 'fr' ? 'fr-FR' : 'en-US'
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        dateStyle: 'short',
        timeStyle: 'short'
      }),
    [localeTag]
  )
  const [items, setItems] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<
    'pending' | 'approved' | 'rejected' | 'unverified' | 'all'
  >('pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const { startExport, isRunning: isExportRunning, progress: exportProgress } = useExportJob(
    'courier-verifications',
    {
      onStart: () =>
        addToast({
          variant: 'info',
          title: t('admin.courierVerification.export.startTitle'),
          message: t('admin.courierVerification.export.startMessage')
        }),
      onDownload: filename =>
        addToast({
          variant: 'success',
          title: t('admin.courierVerification.export.doneTitle'),
          message: t('admin.courierVerification.export.doneMessage', { filename })
        }),
      onError: message =>
        addToast({
          variant: 'error',
          title: t('admin.courierVerification.export.errorTitle'),
          message
        })
    }
  )

  const loadVerifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchCourierVerifications({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
        limit: 100
      })
      setItems(response.items)
      setTotal(response.total)
    } catch (err) {
      console.error('Unable to load courier verifications', err)
      const message =
        err instanceof Error ? err.message : t('admin.courierVerification.loadError')
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, t])

  useEffect(() => {
    void loadVerifications()
  }, [loadVerifications])

  const handleStatus = async (user: AdminUser, status: 'approved' | 'rejected') => {
    setUpdatingId(user.id)
    try {
      const note = notes[user.id]?.trim()
      const updated = await apiPatch<AdminUser>(`/users/${user.id}`, {
        courierVerificationStatus: status,
        courierVerificationReviewNotes: note || undefined
      })
      setItems(prev => prev.map(item => (item.id === user.id ? updated : item)))
      addToast({
        variant: 'success',
        title: t('admin.courierVerification.updateTitle'),
        message:
          status === 'approved'
            ? t('admin.courierVerification.updateApproved')
            : t('admin.courierVerification.updateRejected')
      })
    } catch (err) {
      console.error('Unable to update courier verification', err)
      addToast({
        variant: 'error',
        title: t('admin.courierVerification.updateErrorTitle'),
        message:
          err instanceof Error ? err.message : t('admin.courierVerification.updateError')
      })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('admin.courierVerification.title')}</h1>
            <p>{t('admin.courierVerification.subtitle', { count: total })}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              variant="outline"
              onClick={() => startExport('csv')}
              disabled={isExportRunning}
            >
              {t('admin.courierVerification.export.csv')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => startExport('xlsx')}
              disabled={isExportRunning}
            >
              {t('admin.courierVerification.export.xlsx')}
            </Button>
            {isExportRunning ? (
              <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>
                {t('admin.courierVerification.export.progress', { progress: exportProgress })}
              </span>
            ) : null}
          </div>
        </header>

        <div className="admin-card">
          <div className="admin-card__meta" style={{ alignItems: 'center' }}>
            <strong>{t('admin.courierVerification.filters.title')}</strong>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="input"
                value={statusFilter}
                onChange={event =>
                  setStatusFilter(event.target.value as typeof statusFilter)
                }
              >
                <option value="pending">{t('admin.courierVerification.filters.pending')}</option>
                <option value="approved">{t('admin.courierVerification.filters.approved')}</option>
                <option value="rejected">{t('admin.courierVerification.filters.rejected')}</option>
                <option value="unverified">{t('admin.courierVerification.filters.unverified')}</option>
                <option value="all">{t('admin.courierVerification.filters.all')}</option>
              </select>
              <input
                className="input"
                placeholder={t('admin.courierVerification.searchPlaceholder')}
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <Button variant="ghost" onClick={() => void loadVerifications()}>
                {t('actions.refresh')}
              </Button>
            </div>
          </div>

          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}

          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.courierVerification.table.courier')}</th>
                <th>{t('admin.courierVerification.table.contact')}</th>
                <th>{t('admin.courierVerification.table.location')}</th>
                <th>{t('admin.courierVerification.table.status')}</th>
                <th>{t('admin.courierVerification.table.document')}</th>
                <th>{t('admin.courierVerification.table.action')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !items.length ? (
                <tr>
                  <td colSpan={6} style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('admin.courierVerification.loading')}
                  </td>
                </tr>
              ) : items.length ? (
                items.map(user => (
                  <tr key={user.id}>
                    <td>
                      <strong>{`${user.firstName} ${user.lastName}`.trim() || user.email}</strong>
                      <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                        {user.email}
                      </div>
                    </td>
                    <td>
                      <div>{user.email}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {user.location || t('admin.courierVerification.unknownLocation')}
                    </td>
                    <td>
                      <span
                        className={`admin-status ${
                          user.courierVerificationStatus === 'approved'
                            ? 'admin-status--approved'
                            : user.courierVerificationStatus === 'rejected'
                              ? 'admin-status--rejected'
                              : 'admin-status--pending'
                        }`}
                      >
                        {t(
                          `admin.courierVerification.status.${user.courierVerificationStatus ?? 'unverified'}`
                        )}
                      </span>
                      {user.courierVerificationSubmittedAt ? (
                        <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '4px' }}>
                          {dateFormatter.format(new Date(user.courierVerificationSubmittedAt))}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {user.courierVerificationDocumentUrl ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            window.open(user.courierVerificationDocumentUrl!, '_blank', 'noopener')
                          }
                        >
                          {t('admin.courierVerification.openDocument')}
                        </Button>
                      ) : (
                        <span style={{ color: '#6c757d' }}>
                          {t('admin.courierVerification.noDocument')}
                        </span>
                      )}
                    </td>
                    <td style={{ minWidth: '220px' }}>
                      <textarea
                        className="input"
                        rows={2}
                        placeholder={t('admin.courierVerification.notesPlaceholder')}
                        value={notes[user.id] ?? user.courierVerificationReviewNotes ?? ''}
                        onChange={event =>
                          setNotes(prev => ({ ...prev, [user.id]: event.target.value }))
                        }
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <Button
                          variant="outline"
                          disabled={updatingId === user.id}
                          onClick={() => handleStatus(user, 'approved')}
                        >
                          {t('admin.courierVerification.actions.approve')}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={updatingId === user.id}
                          onClick={() => handleStatus(user, 'rejected')}
                        >
                          {t('admin.courierVerification.actions.reject')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('admin.courierVerification.empty')}
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
