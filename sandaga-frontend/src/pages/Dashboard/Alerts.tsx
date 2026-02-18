import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Input } from '../../components/ui/Input'
import { apiDelete, apiGet, apiPatch } from '../../utils/api'
import { useToast } from '../../components/ui/Toast'
import type { Alert } from '../../types/alert'
import {
  PRICE_BANDS,
  RADIUS_OPTIONS,
  getPriceBandLabel,
  resolvePriceBand
} from '../../constants/filters'
import { useI18n } from '../../contexts/I18nContext'
import { useCategories } from '../../hooks/useCategories'

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return '—'
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function buildSummary(alert: Alert, fallback: string): string {
  const parts = [alert.term, alert.location].filter(Boolean)
  return parts.length ? parts.join(' · ') : fallback
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editAlert, setEditAlert] = useState<Alert | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    term: '',
    location: '',
    sellerType: 'all',
    priceBand: 'all',
    radius: ''
  })
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const { categories } = useCategories({ activeOnly: false })
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(category => {
      if (category.slug) {
        map.set(category.slug, category.name)
      }
    })
    return map
  }, [categories])

  const categoryLabel = (slug?: string | null) => {
    if (!slug) return null
    return categoryMap.get(slug) ?? slug
  }

  const sellerLabel = (value?: string | null) => {
    if (!value || value === 'all') {
      return t('filters.sellerType.all')
    }
    if (value === 'pro') {
      return t('filters.sellerType.pro')
    }
    if (value === 'individual') {
      return t('filters.sellerType.individual')
    }
    return value
  }

  const priceBandLabel = (id?: string | null) => {
    if (!id) return null
    const key = `filters.priceBand.${id}`
    const label = getPriceBandLabel(t, id)
    return label === key ? id : label
  }

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiGet<Alert[]>('/alerts', { signal: controller.signal })
      .then(data => setAlerts(data))
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        console.error('Unable to load alerts', err)
        setError(
          err instanceof Error
            ? err.message
            : t('alerts.loadError')
        )
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [])

  const handleDelete = async (id: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      await apiDelete(`/alerts/${id}`)
      setAlerts(prev => prev.filter(alert => alert.id !== id))
      addToast({
        variant: 'info',
        title: t('alerts.toast.deletedTitle'),
        message: t('alerts.toast.deletedMessage')
      })
    } catch (err) {
      console.error('Unable to delete alert', err)
      addToast({
        variant: 'error',
        title: t('alerts.toast.deleteErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('alerts.toast.deleteErrorMessage')
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggle = async (alert: Alert) => {
    if (updatingId) return
    setUpdatingId(alert.id)
    try {
      const updated = await apiPatch<Alert>(`/alerts/${alert.id}`, {
        isActive: !alert.isActive
      })
      setAlerts(prev =>
        prev.map(item => (item.id === alert.id ? updated : item))
      )
      addToast({
        variant: 'success',
        title: updated.isActive ? t('alerts.toast.enabledTitle') : t('alerts.toast.disabledTitle'),
        message: t('alerts.toast.updatedMessage')
      })
    } catch (err) {
      console.error('Unable to update alert', err)
      addToast({
        variant: 'error',
        title: t('alerts.toast.updateErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('alerts.toast.updateErrorMessage')
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const openEditModal = (alert: Alert) => {
    setEditAlert(alert)
    setEditForm({
      term: alert.term ?? '',
      location: alert.location ?? '',
      sellerType: alert.sellerType ?? 'all',
      priceBand: alert.priceBand ?? 'all',
      radius: alert.radiusKm ? String(alert.radiusKm) : ''
    })
    setFormError(null)
    setIsEditOpen(true)
  }

  const closeEditModal = () => {
    if (isSaving) return
    setIsEditOpen(false)
    setEditAlert(null)
    setFormError(null)
  }

  const handleEditChange = (field: keyof typeof editForm, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editAlert) return

    const term = editForm.term.trim()
    const location = editForm.location.trim()
    const hasCriteria =
      term ||
      location ||
      editAlert.categorySlug ||
      (editForm.sellerType && editForm.sellerType !== 'all') ||
      (editForm.priceBand && editForm.priceBand !== 'all') ||
      (editForm.radius && editForm.radius.trim() !== '')
    if (!hasCriteria) {
      setFormError(t('alerts.form.missingCriteria'))
      return
    }

    setIsSaving(true)
    setFormError(null)
    try {
      const payload = {
        term,
        location,
        sellerType: editForm.sellerType || 'all',
        priceBand: editForm.priceBand || 'all',
        radius: editForm.radius ? Number(editForm.radius) : null
      }
      const updated = await apiPatch<Alert>(`/alerts/${editAlert.id}`, payload)
      setAlerts(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      addToast({
        variant: 'success',
        title: t('alerts.toast.updatedTitle'),
        message: t('alerts.toast.updatedSaved')
      })
      setIsEditOpen(false)
      setEditAlert(null)
    } catch (err) {
      console.error('Unable to update alert', err)
      setFormError(
        err instanceof Error
          ? err.message
          : t('alerts.form.updateError')
      )
    } finally {
      setIsSaving(false)
    }
  }

  const rows = useMemo(
    () =>
      alerts.map(alert => {
        const priceBand = resolvePriceBand(alert.priceBand ?? undefined)
        const priceLabel = priceBandLabel(priceBand?.id ?? alert.priceBand ?? null)
        const categoryName = categoryLabel(alert.categorySlug)
        const filters = [
          categoryName ? `${t('filters.category.label')}: ${categoryName}` : null,
          sellerLabel(alert.sellerType),
          priceLabel,
          alert.radiusKm ? `${alert.radiusKm} km` : null
        ].filter(Boolean)

        return {
          alert,
          summary: buildSummary(alert, t('alerts.summary.fallback')),
          filters: filters.length ? filters.join(' · ') : t('alerts.filters.none')
        }
      }),
    [alerts, t, categoryMap]
  )

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('alerts.title')}</h1>
            <p>{t('alerts.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/search')}>
            {t('alerts.cta.create')}
          </Button>
        </header>

        <section className="dashboard-section">
          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}

          {isLoading ? (
            <p style={{ padding: '1.5rem 0', color: '#6c757d' }}>
              {t('alerts.loading')}
            </p>
          ) : null}

          {!isLoading && !alerts.length ? (
            <div className="card" style={{ padding: '24px' }}>
              <h2>{t('alerts.empty.title')}</h2>
              <p>{t('alerts.empty.description')}</p>
              <Button onClick={() => navigate('/search')}>
                {t('alerts.empty.cta')}
              </Button>
            </div>
          ) : null}

          {alerts.length ? (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>{t('alerts.table.alert')}</th>
                  <th>{t('alerts.table.filters')}</th>
                  <th>{t('alerts.table.status')}</th>
                  <th>{t('alerts.table.created')}</th>
                  <th>{t('alerts.table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ alert, summary, filters }) => (
                  <tr key={alert.id}>
                    <td>{summary}</td>
                    <td>{filters}</td>
                    <td>
                      <span
                        className={`admin-status ${
                          alert.isActive ? 'admin-status--approved' : 'admin-status--rejected'
                        }`}
                      >
                        {alert.isActive ? t('alerts.status.active') : t('alerts.status.inactive')}
                      </span>
                    </td>
                    <td>{formatDate(alert.created_at, dateLocale)}</td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => openEditModal(alert)}
                        disabled={isSaving || updatingId === alert.id}
                      >
                        {t('alerts.actions.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleToggle(alert)}
                        disabled={updatingId === alert.id}
                      >
                        {updatingId === alert.id
                          ? t('alerts.actions.updating')
                          : alert.isActive
                          ? t('alerts.actions.disable')
                          : t('alerts.actions.enable')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleDelete(alert.id)}
                        disabled={deletingId === alert.id}
                      >
                        {deletingId === alert.id
                          ? t('alerts.actions.deleting')
                          : t('alerts.actions.delete')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
      <Modal
        open={isEditOpen}
        title={t('alerts.modal.title')}
        description={t('alerts.modal.description')}
        onClose={closeEditModal}
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'grid', gap: '16px' }}>
          <label className="form-field">
            <div className="form-field__head">
              <span className="form-field__label">{t('alerts.form.keyword')}</span>
            </div>
            <div className="form-field__control">
              <Input
                value={editForm.term}
                onChange={event => handleEditChange('term', event.target.value)}
                placeholder={t('alerts.form.keywordPlaceholder')}
              />
            </div>
          </label>

          <label className="form-field">
            <div className="form-field__head">
              <span className="form-field__label">{t('alerts.form.location')}</span>
            </div>
            <div className="form-field__control">
              <Input
                value={editForm.location}
                onChange={event => handleEditChange('location', event.target.value)}
                placeholder={t('alerts.form.locationPlaceholder')}
              />
            </div>
          </label>

          <div className="form-field">
            <div className="form-field__head">
              <span className="form-field__label">{t('filters.sellerType.label')}</span>
            </div>
            <div className="form-field__control">
              <Select
                value={editForm.sellerType}
                onChange={value => handleEditChange('sellerType', String(value))}
                options={[
                  { value: 'all', label: t('filters.sellerType.all') },
                  { value: 'individual', label: t('filters.sellerType.individual') },
                  { value: 'pro', label: t('filters.sellerType.pro') }
                ]}
              />
            </div>
          </div>

          <div className="form-field">
            <div className="form-field__head">
              <span className="form-field__label">{t('filters.price.label')}</span>
            </div>
            <div className="form-field__control">
              <Select
                value={editForm.priceBand}
                onChange={value => handleEditChange('priceBand', String(value))}
                options={PRICE_BANDS.map(band => ({
                  value: band.id,
                  label: priceBandLabel(band.id) ?? band.id
                }))}
              />
            </div>
          </div>

          <div className="form-field">
            <div className="form-field__head">
              <span className="form-field__label">{t('filters.radius.label')}</span>
            </div>
            <div className="form-field__control">
              <Select
                value={editForm.radius}
                onChange={value => handleEditChange('radius', String(value))}
                options={[
                  { value: '', label: t('filters.radius.all') },
                  ...RADIUS_OPTIONS.map(option => ({
                    value: option.value,
                    label: option.label
                  }))
                ]}
              />
            </div>
          </div>

          {formError ? (
            <p className="form-field__error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="auth-form__actions" style={{ justifyContent: 'flex-end', gap: '12px' }}>
            <Button variant="ghost" type="button" onClick={closeEditModal} disabled={isSaving}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t('alerts.actions.saving') : t('actions.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
