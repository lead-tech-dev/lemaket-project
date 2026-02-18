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

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)

    const fetchAllUsers = async () => {
      try {
        const aggregated: AdminUser[] = []
        const limit = 100
        let page = 1
        let total = 0

        while (active) {
          const response = await apiGet<Paginated<AdminUser>>(
            `/users?page=${page}&limit=${limit}`
          )
          if (!active) {
            return
          }

          aggregated.push(...response.data)
          total = response.total

          if (aggregated.length >= total || response.data.length < limit) {
            break
          }

          page += 1
        }

        if (active) {
          setUsers(aggregated)
        }
      } catch (err) {
        console.error('Unable to load users', err)
        if (!active) {
          return
        }
        const message =
          err instanceof Error ? err.message : t('admin.users.toast.loadErrorMessage')
        setError(message)
        addToast({ variant: 'error', title: t('admin.users.toast.loadErrorTitle'), message })
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void fetchAllUsers()

    return () => {
      active = false
    }
  }, [addToast, t])

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


  const filteredUsers = useMemo(() => {
    if (!search.trim()) {
      return users
    }
    const value = search.toLowerCase()
    return users.filter(user =>
      [user.firstName, user.lastName, user.email]
        .filter(Boolean)
        .some(field => field!.toLowerCase().includes(value))
    )
  }, [search, users])

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
              <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>
                {t('admin.users.export.progress', { progress: exportProgress })}
              </span>
            ) : null}
          </div>
        </header>

        <div className="admin-card">
          <div className="admin-card__meta">
            <strong>
              {users.length === 1
                ? t('admin.users.count.single', { count: users.length })
                : t('admin.users.count.multiple', { count: users.length })}
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
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.users.table.name')}</th>
                <th>{t('admin.users.table.email')}</th>
                <th>{t('admin.users.table.role')}</th>
                <th>{t('admin.users.table.signup')}</th>
                <th>{t('admin.users.table.status')}</th>
                <th>{t('admin.users.table.action')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !filteredUsers.length ? (
                <tr>
                  <td colSpan={6} style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('admin.users.loading')}
                  </td>
                </tr>
              ) : filteredUsers.length ? (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>{`${user.firstName} ${user.lastName}`.trim() || user.email}</td>
                    <td>{user.email}</td>
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
                      <div className="auth-form__actions" style={{ gap: '12px' }}>
                        <Button
                          variant="outline"
                          onClick={() => handleToggleActive(user)}
                          disabled={updatingId === user.id}
                        >
                          {user.isActive ? t('admin.users.actions.suspend') : t('admin.users.actions.reactivate')}
                        </Button>
                        {!user.isPro ? (
                          <Button
                            variant="ghost"
                            onClick={() => handlePromote(user.id)}
                            disabled={updatingId === user.id}
                          >
                            {t('admin.users.actions.promote')}
                          </Button>
                        ) : null}
                        <Button
                          variant="danger"
                          onClick={() => handleDelete(user.id)}
                          disabled={updatingId === user.id}
                        >
                          {t('admin.users.actions.delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '1rem', color: '#6c757d' }}>
                    {t('admin.users.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
            <p style={{ color: '#6c757d' }}>{t('admin.users.audit.loading')}</p>
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
                    border: '1px solid #e5e7eb',
                    background: '#fff'
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
                    <span style={{ color: '#6c757d', fontSize: '0.8rem' }}>
                      {auditDateFormatter.format(new Date(event.created_at))}
                    </span>
                  </div>
                  {event.details ? (
                    <p style={{ marginTop: '6px', color: '#4b5563' }}>{event.details}</p>
                  ) : null}
                  <p style={{ marginTop: '6px', color: '#6c757d', fontSize: '0.85rem' }}>
                    {event.actorName ?? t('admin.users.audit.system')}
                    {event.ipAddress ? ` · ${event.ipAddress}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#6c757d' }}>{t('admin.users.audit.empty')}</p>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
