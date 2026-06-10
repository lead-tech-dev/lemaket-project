import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { apiDelete, apiGet, apiPatch } from '../../utils/api'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import type { AdminUser } from '../../types/user'
import type { AuditEvent } from '../../types/admin'
import { fetchAuditTrail } from '../../utils/admin-api'
import { useExportJob } from '../../hooks/useExportJob'
import type { Paginated } from '../../types/pagination'

const PAGE_SIZE = 20

export default function Users() {
  const { t, locale } = useI18n()
  const localeTag = locale === 'fr' ? 'fr-FR' : 'en-US'
  const auditDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        dateStyle: 'short',
        timeStyle: 'short'
      }),
    [localeTag]
  )
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [isAuditLoading, setIsAuditLoading] = useState(false)
  const { addToast } = useToast()

  const { startExport, isRunning: isExportRunning, progress: exportProgress } = useExportJob('users', {
    onStart: () =>
      addToast({
        variant: 'info',
        title: t('admin.users.export.startTitle'),
        message: t('admin.users.export.startMessage')
      }),
    onDownload: filename =>
      addToast({
        variant: 'success',
        title: t('admin.users.export.doneTitle'),
        message: t('admin.users.export.doneMessage', { filename })
      }),
    onError: message =>
      addToast({
        variant: 'error',
        title: t('admin.users.export.errorTitle'),
        message
      })
  })

  // Recherche serveur debouncée : retour à la page 1 à chaque nouvelle requête.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timeout)
  }, [search])

  // Chargement d'UNE page côté serveur (recherche + pagination), sans plus
  // agréger toutes les pages côté client.
  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE)
    })
    if (debouncedSearch) {
      params.set('search', debouncedSearch)
    }

    apiGet<Paginated<AdminUser>>(`/users?${params.toString()}`, {
      signal: controller.signal
    })
      .then(response => {
        setUsers(response.data)
        setTotal(response.total)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('Unable to load users', err)
        const message =
          err instanceof Error ? err.message : t('admin.users.toast.loadErrorMessage')
        setError(message)
        addToast({ variant: 'error', title: t('admin.users.toast.loadErrorTitle'), message })
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [page, debouncedSearch, addToast, t])

  const loadAudit = useCallback(async () => {
    setIsAuditLoading(true)
    try {
      const events = await fetchAuditTrail('users', undefined, 10)
      setAuditEvents(events)
    } catch (err) {
      console.error('Unable to load audit trail', err)
    } finally {
      setIsAuditLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAudit()
  }, [loadAudit])


  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handlePromote = async (id: string) => {
    setUpdatingId(id)
    try {
      const updated = await apiPatch<AdminUser>(`/users/${id}/pro`, {})
      setUsers(prev => prev.map(user => (user.id === id ? updated : user)))
      addToast({
        variant: 'success',
        title: t('admin.users.toast.promoteTitle'),
        message: t('admin.users.toast.promoteMessage')
      })
      void loadAudit()
    } catch (err) {
      console.error('Unable to promote user', err)
      addToast({
        variant: 'error',
        title: t('admin.users.toast.promoteErrorTitle'),
        message:
          err instanceof Error ? err.message : t('admin.users.toast.promoteErrorMessage')
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleToggleActive = async (user: AdminUser) => {
    setUpdatingId(user.id)
    try {
      const updated = await apiPatch<AdminUser>(`/users/${user.id}`, {
        isActive: !user.isActive
      })
      setUsers(prev => prev.map(item => (item.id === user.id ? updated : item)))
      addToast({
        variant: 'success',
        title: updated.isActive
          ? t('admin.users.toast.reactivatedTitle')
          : t('admin.users.toast.suspendedTitle'),
        message: t('admin.users.toast.statusMessage', {
          name: `${updated.firstName} ${updated.lastName}`.trim(),
          status: updated.isActive ? t('admin.users.status.active') : t('admin.users.status.suspended')
        })
      })
      void loadAudit()
    } catch (err) {
      console.error('Unable to update user', err)
      addToast({
        variant: 'error',
        title: t('admin.users.toast.statusErrorTitle'),
        message:
          err instanceof Error ? err.message : t('admin.users.toast.statusErrorMessage')
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.users.deleteConfirm'))) {
      return
    }
    setUpdatingId(id)
    try {
      await apiDelete(`/users/${id}`)
      setUsers(prev => prev.filter(user => user.id !== id))
      setTotal(current => Math.max(0, current - 1))
      addToast({
        variant: 'info',
        title: t('admin.users.toast.deletedTitle'),
        message: t('admin.users.toast.deletedMessage')
      })
      void loadAudit()
    } catch (err) {
      console.error('Unable to delete user', err)
      addToast({
        variant: 'error',
        title: t('admin.users.toast.deleteErrorTitle'),
        message:
          err instanceof Error ? err.message : t('admin.users.toast.deleteErrorMessage')
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
            <h1>{t('admin.users.title')}</h1>
            <p>{t('admin.users.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              variant="outline"
              onClick={() => startExport('csv')}
              disabled={isExportRunning}
            >
              {t('admin.users.export.csv')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => startExport('xlsx')}
              disabled={isExportRunning}
            >
              {t('admin.users.export.xlsx')}
            </Button>
            {isExportRunning ? (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                {t('admin.users.export.progress', { progress: exportProgress })}
              </span>
            ) : null}
          </div>
        </header>

        <div className="admin-card">
          <div className="admin-card__meta">
            <strong>
              {total === 1
                ? t('admin.users.count.single', { count: total })
                : t('admin.users.count.multiple', { count: total })}
            </strong>
            <input
              className="input"
              placeholder={t('admin.users.searchPlaceholder')}
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}
          <table className="admin-table admin-table--users">
            <thead>
              <tr>
                <th>{t('admin.users.table.name')}</th>
                <th className="admin-users__col-email">{t('admin.users.table.email')}</th>
                <th>{t('admin.users.table.role')}</th>
                <th>{t('admin.users.table.signup')}</th>
                <th>{t('admin.users.table.status')}</th>
                <th>{t('admin.users.table.action')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !users.length ? (
                <tr>
                  <td colSpan={6} style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>
                    {t('admin.users.loading')}
                  </td>
                </tr>
              ) : users.length ? (
                users.map(user => (
                  <tr key={user.id}>
                    <td>{`${user.firstName} ${user.lastName}`.trim() || user.email}</td>
                    <td className="admin-users__col-email">
                      <span className="admin-users__email" title={user.email}>
                        {user.email}
                      </span>
                    </td>
                    <td>{user.role.toUpperCase()}</td>
                    <td>{auditDateFormatter.format(new Date(user.created_at))}</td>
                    <td>
                      <span
                        className={`admin-status ${
                          user.isActive ? 'admin-status--approved' : 'admin-status--rejected'
                        }`}
                      >
                        {user.isActive ? t('admin.users.status.active') : t('admin.users.status.suspended')}
                      </span>
                    </td>
                    <td>
                      <div className="admin-users__actions" role="group" aria-label={t('admin.users.table.action')}>
                        <Button
                          variant="outline"
                          onClick={() => handleToggleActive(user)}
                          disabled={updatingId === user.id}
                          className="admin-users__icon-btn"
                          title={user.isActive ? t('admin.users.actions.suspend') : t('admin.users.actions.reactivate')}
                          aria-label={user.isActive ? t('admin.users.actions.suspend') : t('admin.users.actions.reactivate')}
                          data-tooltip={user.isActive ? t('admin.users.actions.suspend') : t('admin.users.actions.reactivate')}
                        >
                          {user.isActive ? (
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-users__icon">
                              <path d="M8 6v12M16 6v12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-users__icon">
                              <path d="M9 7l8 5-8 5z" fill="currentColor" />
                            </svg>
                          )}
                          <span className="sr-only">
                            {user.isActive ? t('admin.users.actions.suspend') : t('admin.users.actions.reactivate')}
                          </span>
                        </Button>
                        {!user.isPro ? (
                          <Button
                            variant="ghost"
                            onClick={() => handlePromote(user.id)}
                            disabled={updatingId === user.id}
                            className="admin-users__icon-btn"
                            title={t('admin.users.actions.promote')}
                            aria-label={t('admin.users.actions.promote')}
                            data-tooltip={t('admin.users.actions.promote')}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-users__icon">
                              <path
                                d="M12 3l2.65 5.36 5.92.86-4.29 4.18 1.01 5.9L12 16.8l-5.29 2.78 1.01-5.9-4.29-4.18 5.92-.86L12 3z"
                                fill="currentColor"
                              />
                            </svg>
                            <span className="sr-only">{t('admin.users.actions.promote')}</span>
                          </Button>
                        ) : null}
                        <Button
                          variant="danger"
                          onClick={() => handleDelete(user.id)}
                          disabled={updatingId === user.id}
                          className="admin-users__icon-btn"
                          title={t('admin.users.actions.delete')}
                          aria-label={t('admin.users.actions.delete')}
                          data-tooltip={t('admin.users.actions.delete')}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-users__icon">
                            <path
                              d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
                              fill="currentColor"
                            />
                          </svg>
                          <span className="sr-only">{t('admin.users.actions.delete')}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>
                    {t('admin.users.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 ? (
            <div className="listings-pagination" style={{ marginTop: '12px' }}>
              <Button
                variant="ghost"
                onClick={() => setPage(current => Math.max(1, current - 1))}
                disabled={page <= 1 || isLoading}
              >
                {t('pagination.previous')}
              </Button>
              <span>{t('pagination.pageIndicator', { page, total: totalPages })}</span>
              <Button
                variant="ghost"
                onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || isLoading}
              >
                {t('pagination.next')}
              </Button>
            </div>
          ) : null}
        </div>

        <section className="dashboard-section" style={{ marginTop: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}
          >
            <h2 style={{ margin: 0 }}>{t('admin.users.audit.title')}</h2>
            <Button variant="ghost" onClick={() => void loadAudit()} disabled={isAuditLoading}>
              {t('actions.refresh')}
            </Button>
          </div>
          {isAuditLoading ? (
            <p style={{ color: 'var(--color-text-muted)' }}>{t('admin.users.audit.loading')}</p>
          ) : auditEvents.length ? (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {auditEvents.map(event => (
                <li
                  key={event.id}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '12px'
                    }}
                  >
                    <strong>{event.action}</strong>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      {auditDateFormatter.format(new Date(event.created_at))}
                    </span>
                  </div>
                  {event.details ? (
                    <p style={{ marginTop: '6px', color: 'var(--color-text-muted)' }}>{event.details}</p>
                  ) : null}
                  <p style={{ marginTop: '6px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {event.actorName ?? t('admin.users.audit.system')}
                    {event.ipAddress ? ` · ${event.ipAddress}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--color-text-muted)' }}>{t('admin.users.audit.empty')}</p>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
