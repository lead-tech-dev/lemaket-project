import { useCallback, useEffect, useMemo, useState, type MouseEventHandler, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { apiDelete, apiGet } from '../../utils/api'
import { useToast } from '../../components/ui/Toast'
import type { Category } from '../../types/category'
import type { AuditEvent } from '../../types/admin'
import { fetchAuditTrail } from '../../utils/admin-api'
import { useExportJob } from '../../hooks/useExportJob'
import { useI18n } from '../../contexts/I18nContext'

type IconProps = {
  size?: number
}

const EditIcon = ({ size = 18 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 21v-4.5L15.75 4.75a1.5 1.5 0 0 1 2.12 0l1.38 1.38a1.5 1.5 0 0 1 0 2.12L7.5 20.5Z" />
    <path d="M14.5 6.5 18 10" />
  </svg>
)

const DeleteIcon = ({ size = 18 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </svg>
)

const styles = {
  iconActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#475569',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  iconButtonDanger: {
    color: '#dc2626',
    borderColor: '#fecaca',
    background: '#fff7f7'
  }
} as const

type IconButtonVariant = 'default' | 'danger'

type IconButtonProps = {
  label: string
  onClick: MouseEventHandler<HTMLButtonElement>
  variant?: IconButtonVariant
  children: ReactNode
}

const IconButton = ({ label, onClick, variant = 'default', children }: IconButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    style={{
      ...styles.iconButton,
      ...(variant === 'danger' ? styles.iconButtonDanger : {})
    }}
  >
    {children}
  </button>
)

const isParentCategory = (category: Category): boolean => {
  const parentId = category.parentId ?? (category as any).parent?.id ?? null
  const hasChildren = Array.isArray(category.children) && category.children.length > 0
  return !parentId || hasChildren
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [isAuditLoading, setIsAuditLoading] = useState(false)
  const { addToast } = useToast()
  const { t, locale } = useI18n()
  const auditDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short'
      }),
    [locale]
  )

  const { startExport, isRunning: isExportRunning, progress: exportProgress } = useExportJob('categories', {
    onStart: () =>
      addToast({
        variant: 'info',
        title: t('admin.categories.export.startTitle'),
        message: t('admin.categories.export.startMessage')
      }),
    onDownload: filename =>
      addToast({
        variant: 'success',
        title: t('admin.categories.export.doneTitle'),
        message: t('admin.categories.export.doneMessage', { filename })
      }),
    onError: message =>
      addToast({
        variant: 'error',
        title: t('admin.categories.export.errorTitle'),
        message
      })
  })

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)

    apiGet<Category[]>('/categories')
      .then(data => {
        if (!active) return
        setCategories(data)
      })
      .catch(err => {
        console.error('Unable to load categories', err)
        if (!active) return
        const message =
          err instanceof Error
            ? err.message
            : t('admin.categories.loadError')
        setError(message)
        addToast({ variant: 'error', title: t('admin.categories.toast.errorTitle'), message })
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

  const loadAudit = useCallback(async () => {
    setIsAuditLoading(true)
    try {
      const events = await fetchAuditTrail('categories', undefined, 10)
      setAuditEvents(events)
    } catch (err) {
      console.error('Unable to load category audit trail', err)
    } finally {
      setIsAuditLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAudit()
  }, [loadAudit])

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.categories.confirmDelete'))) {
      return
    }
    try {
      await apiDelete(`/categories/${id}`)
      setCategories(prev => prev.filter(category => category.id !== id))
      addToast({
        variant: 'info',
        title: t('admin.categories.toast.deletedTitle'),
        message: t('admin.categories.toast.deletedMessage')
      })
      void loadAudit()
    } catch (err) {
      console.error('Unable to delete category', err)
      addToast({
        variant: 'error',
        title: t('admin.categories.toast.errorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('admin.categories.deleteError')
      })
    }
  }

  const filteredCategories = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase()
    return categories.filter(category => {
      if (statusFilter !== 'all') {
        const isActive = Boolean(category.isActive)
        if (statusFilter === 'active' && !isActive) {
          return false
        }
        if (statusFilter === 'inactive' && isActive) {
          return false
        }
      }
      if (!trimmed) {
        return true
      }
      const haystack = [category.name, category.slug, category.description ?? '']
        .join(' ')
        .toLowerCase()
      return haystack.includes(trimmed)
    })
  }, [categories, searchQuery, statusFilter])

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('admin.categories.title')}</h1>
            <p>{t('admin.categories.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              variant="outline"
              onClick={() => startExport('csv')}
              disabled={isExportRunning}
            >
              {t('admin.categories.export.csv')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => startExport('xlsx')}
              disabled={isExportRunning}
            >
              {t('admin.categories.export.excel')}
            </Button>
            {isExportRunning ? (
              <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>
                {t('admin.categories.export.progress', { progress: exportProgress })}
              </span>
            ) : null}
            <Button onClick={() => window.location.assign('/admin/categories/new')}>
              {t('admin.categories.add')}
            </Button>
          </div>
        </header>

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '16px'
          }}
        >
          <div style={{ flex: '1 1 320px', maxWidth: '420px', display: 'flex', gap: '8px' }}>
            <Input
              placeholder={t('admin.categories.searchPlaceholder')}
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              aria-label={t('admin.categories.searchPlaceholder')}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSearchQuery('')}
              disabled={!searchQuery.trim()}
            >
              {t('admin.categories.searchClear')}
            </Button>
          </div>
          <div style={{ minWidth: '200px', flex: '0 0 auto' }}>
            <Select
              value={statusFilter}
              onChange={value => setStatusFilter(String(value))}
              options={[
                { value: 'all', label: t('admin.categories.statusFilter.all') },
                { value: 'active', label: t('admin.categories.statusFilter.active') },
                { value: 'inactive', label: t('admin.categories.statusFilter.inactive') }
              ]}
              placeholder={t('admin.categories.statusFilter.label')}
            />
          </div>
        </div>

        <section className="admin-grid">
          {isLoading && !categories.length ? (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {t('admin.categories.loading')}
            </p>
          ) : filteredCategories.length ? (
            filteredCategories.map(category => (
              <div key={category.id} className="admin-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>{category.name}</strong>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: category.isActive ? '#ecfdf3' : '#f3f4f6',
                      color: category.isActive ? '#15803d' : '#6b7280',
                      border: `1px solid ${category.isActive ? '#bbf7d0' : '#e5e7eb'}`
                    }}
                  >
                    {category.isActive
                      ? t('admin.categories.status.active')
                      : t('admin.categories.status.inactive')}
                  </span>
                </div>
                <span>{category.description ?? t('admin.categories.emptyDescription')}</span>
                <div
                  className="auth-form__actions"
                  style={{ gap: '12px', justifyContent: 'flex-start', alignItems: 'center' }}
                >
                  <div style={styles.iconActions}>
                    <IconButton
                      label={t('admin.categories.actions.edit')}
                      onClick={() =>
                        window.location.assign(`/admin/categories/new?id=${category.id}`)
                      }
                    >
                      <EditIcon size={16} />
                    </IconButton>
                    <IconButton
                      label={t('admin.categories.actions.delete')}
                      variant="danger"
                      onClick={() => handleDelete(category.id)}
                    >
                      <DeleteIcon size={16} />
                    </IconButton>
                  </div>
                  {!isParentCategory(category) ? (
                    <Link to={`/admin/categories/${category.id}/form`}>
                      <Button variant="outline">{t('admin.categories.actions.formBuilder')}</Button>
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      disabled
                      title={t('admin.categories.actions.formBuilderDisabled')}
                      style={{ opacity: 0.5, cursor: 'not-allowed' }}
                    >
                      {t('admin.categories.actions.formBuilder')}
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : categories.length ? (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {t('admin.categories.searchEmpty')}
            </p>
          ) : (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {t('admin.categories.empty')}
            </p>
          )}
        </section>

        <section className="dashboard-section" style={{ marginTop: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}
          >
            <h2 style={{ margin: 0 }}>{t('admin.categories.audit.title')}</h2>
            <Button variant="ghost" onClick={() => void loadAudit()} disabled={isAuditLoading}>
              {t('actions.refresh')}
            </Button>
          </div>
          {isAuditLoading ? (
            <p style={{ color: '#6c757d' }}>{t('admin.categories.audit.loading')}</p>
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
                    {event.actorName ?? t('admin.categories.audit.system')}
                    {event.ipAddress ? ` · ${event.ipAddress}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#6c757d' }}>{t('admin.categories.audit.empty')}</p>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
