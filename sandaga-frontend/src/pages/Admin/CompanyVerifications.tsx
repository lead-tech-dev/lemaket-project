import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import { apiPatch } from '../../utils/api'
import { fetchCompanyVerifications } from '../../utils/admin-api'
import { useExportJob } from '../../hooks/useExportJob'
import type { AdminUser } from '../../types/user'

export default function CompanyVerifications() {
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
    'company-verifications',
    {
      onStart: () =>
        addToast({
          variant: 'info',
          title: t('admin.companyVerification.export.startTitle'),
          message: t('admin.companyVerification.export.startMessage')
        }),
      onDownload: filename =>
        addToast({
          variant: 'success',
          title: t('admin.companyVerification.export.doneTitle'),
          message: t('admin.companyVerification.export.doneMessage', { filename })
        }),
      onError: message =>
        addToast({
          variant: 'error',
          title: t('admin.companyVerification.export.errorTitle'),
          message
        })
    }
  )

  const loadVerifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchCompanyVerifications({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
        limit: 100
      })
      setItems(response.items)
      setTotal(response.total)
    } catch (err) {
      console.error('Unable to load company verifications', err)
      const message =
        err instanceof Error ? err.message : t('admin.companyVerification.loadError')
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
        companyVerificationStatus: status,
        companyVerificationReviewNotes: note || undefined
      })
      setItems(prev => prev.map(item => (item.id === user.id ? updated : item)))
      addToast({
        variant: 'success',
        title: t('admin.companyVerification.updateTitle'),
        message:
          status === 'approved'
            ? t('admin.companyVerification.updateApproved')
            : t('admin.companyVerification.updateRejected')
      })
    } catch (err) {
      console.error('Unable to update company verification', err)
      addToast({
        variant: 'error',
        title: t('admin.companyVerification.updateErrorTitle'),
        message:
          err instanceof Error ? err.message : t('admin.companyVerification.updateError')
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
            <h1>{t('admin.companyVerification.title')}</h1>
            <p>{t('admin.companyVerification.subtitle', { count: total })}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              variant="outline"
              onClick={() => startExport('csv')}
              disabled={isExportRunning}
            >
              {t('admin.companyVerification.export.csv')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => startExport('xlsx')}
              disabled={isExportRunning}
            >
              {t('admin.companyVerification.export.xlsx')}
            </Button>
            {isExportRunning ? (
              <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>
                {t('admin.companyVerification.export.progress', { progress: exportProgress })}
              </span>
            ) : null}
          </div>
        </header>

        <div className="admin-card">
          <div className="admin-card__meta" style={{ alignItems: 'center' }}>
            <strong>{t('admin.companyVerification.filters.title')}</strong>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="input"
                value={statusFilter}
                onChange={event =>
                  setStatusFilter(event.target.value as typeof statusFilter)
                }
              >
                <option value="pending">{t('admin.companyVerification.filters.pending')}</option>
                <option value="approved">{t('admin.companyVerification.filters.approved')}</option>
                <option value="rejected">{t('admin.companyVerification.filters.rejected')}</option>
                <option value="unverified">{t('admin.companyVerification.filters.unverified')}</option>
                <option value="all">{t('admin.companyVerification.filters.all')}</option>
              </select>
              <input
                className="input"
                placeholder={t('admin.companyVerification.searchPlaceholder')}
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
                <th>{t('admin.companyVerification.table.company')}</th>
                <th>{t('admin.companyVerification.table.contact')}</th>
                <th>{t('admin.companyVerification.table.identifiers')}</th>
                <th>{t('admin.companyVerification.table.status')}</th>
                <th>{t('admin.companyVerification.table.document')}</th>
                <th>{t('admin.companyVerification.table.action')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !items.length ? (
                <tr>
                  <td colSpan={6} style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('admin.companyVerification.loading')}
                  </td>
                </tr>
              ) : items.length ? (
                items.map(user => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.companyName || t('admin.companyVerification.unknownCompany')}</strong>
                      <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                        {user.companyCity || t('admin.companyVerification.unknownCity')}
                      </div>
                    </td>
                    <td>
                      <div>{`${user.firstName} ${user.lastName}`.trim() || user.email}</div>
                      <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>{user.email}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <div>RCCM: {user.companyRccm || '-'}</div>
                      <div>NIU: {user.companyNiu || '-'}</div>
                      <div>ID: {user.companyId || '-'}</div>
                    </td>
                    <td>
                      <span
                        className={`admin-status ${
                          user.companyVerificationStatus === 'approved'
                            ? 'admin-status--approved'
                            : user.companyVerificationStatus === 'rejected'
                            ? 'admin-status--rejected'
                            : 'admin-status--pending'
                        }`}
                      >
                        {t(
                          `admin.companyVerification.status.${user.companyVerificationStatus ?? 'unverified'}`
                        )}
                      </span>
                      {user.companyVerificationSubmittedAt ? (
                        <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '4px' }}>
                          {dateFormatter.format(new Date(user.companyVerificationSubmittedAt))}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {user.companyVerificationDocumentUrl ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            window.open(user.companyVerificationDocumentUrl!, '_blank', 'noopener')
                          }
                        >
                          {t('admin.companyVerification.openDocument')}
                        </Button>
                      ) : (
                        <span style={{ color: '#6c757d' }}>{t('admin.companyVerification.noDocument')}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <textarea
                          className="input"
                          rows={2}
                          placeholder={t('admin.companyVerification.notesPlaceholder')}
                          value={notes[user.id] ?? user.companyVerificationReviewNotes ?? ''}
                          onChange={event =>
                            setNotes(prev => ({
                              ...prev,
                              [user.id]: event.target.value
                            }))
                          }
                        />
                        <div className="auth-form__actions" style={{ gap: '8px' }}>
                          <Button
                            variant="outline"
                            onClick={() => handleStatus(user, 'approved')}
                            disabled={updatingId === user.id}
                          >
                            {t('admin.companyVerification.actions.approve')}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => handleStatus(user, 'rejected')}
                            disabled={updatingId === user.id}
                          >
                            {t('admin.companyVerification.actions.reject')}
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('admin.companyVerification.empty')}
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
