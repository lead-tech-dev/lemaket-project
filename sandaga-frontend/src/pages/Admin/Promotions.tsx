import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { FormField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import {
  createAdminPromotion,
  deleteAdminPromotion,
  fetchAdminPromotions,
  transitionAdminPromotionStatus,
  updateAdminPromotion
} from '../../utils/admin-api'
import type { PromotionPayload } from '../../utils/admin-api'
import type { AdminPromotion, PromotionStatus, PromotionType } from '../../types/admin'

type PromotionFormState = {
  name: string
  type: PromotionType
  status: PromotionStatus
  startDate: string
  endDate: string
  budget: string
  description: string
  listingId: string
}

type PromotionFormErrors = Partial<Record<keyof PromotionFormState, string>>

const buildPromotionTypes = (
  t: (key: string, values?: Record<string, string | number>) => string
): Array<{ value: PromotionType; label: string }> => [
  { value: 'featured', label: t('admin.promotions.types.featured') },
  { value: 'boost', label: t('admin.promotions.types.boost') },
  { value: 'premium', label: t('admin.promotions.types.premium') },
  { value: 'highlight', label: t('admin.promotions.types.highlight') }
]

const buildStatusLabels = (
  t: (key: string, values?: Record<string, string | number>) => string
): Record<PromotionStatus, string> => ({
  draft: t('admin.promotions.status.draft'),
  scheduled: t('admin.promotions.status.scheduled'),
  active: t('admin.promotions.status.active'),
  completed: t('admin.promotions.status.completed'),
  cancelled: t('admin.promotions.status.cancelled')
})

const STATUS_BADGES: Record<PromotionStatus, string> = {
  draft: 'admin-status--pending',
  scheduled: 'admin-status--pending',
  active: 'admin-status--approved',
  completed: 'admin-status--neutral',
  cancelled: 'admin-status--rejected'
}

const STATUS_TRANSITIONS: Record<PromotionStatus, PromotionStatus[]> = {
  draft: ['scheduled', 'active', 'cancelled'],
  scheduled: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
}

const buildStatusTransitionLabels = (
  t: (key: string, values?: Record<string, string | number>) => string
): Partial<Record<PromotionStatus, Partial<Record<PromotionStatus, string>>>> => ({
  draft: {
    scheduled: t('admin.promotions.transitions.schedule'),
    active: t('admin.promotions.transitions.activate'),
    cancelled: t('admin.promotions.transitions.cancel')
  },
  scheduled: {
    active: t('admin.promotions.transitions.launch'),
    cancelled: t('admin.promotions.transitions.cancel')
  },
  active: {
    completed: t('admin.promotions.transitions.complete'),
    cancelled: t('admin.promotions.transitions.cancel')
  }
})

const buildStatusOptions = (
  statusLabels: Record<PromotionStatus, string>
): Array<{ value: PromotionStatus; label: string }> => [
  { value: 'draft', label: statusLabels.draft },
  { value: 'scheduled', label: statusLabels.scheduled },
  { value: 'active', label: statusLabels.active },
  { value: 'completed', label: statusLabels.completed },
  { value: 'cancelled', label: statusLabels.cancelled }
]

function toInputDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const tzOffset = date.getTimezoneOffset() * 60000
  const localISOTime = new Date(date.getTime() - tzOffset).toISOString()
  return localISOTime.slice(0, 16)
}

function fromInputDateTime(value: string): string {
  return new Date(value).toISOString()
}

function buildDefaultForm(): PromotionFormState {
  const now = new Date()
  now.setSeconds(0, 0)
  const start = new Date(now.getTime() + 60 * 60 * 1000)
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)

  return {
    name: '',
    type: 'featured',
    status: 'draft',
    startDate: toInputDateTime(start),
    endDate: toInputDateTime(end),
    budget: '500',
    description: '',
    listingId: ''
  }
}

function formatSchedule(start: string, end: string, formatter: Intl.DateTimeFormat) {
  return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}`
}

export default function Promotions() {
  const { t, locale } = useI18n()
  const localeTag = locale === 'fr' ? 'fr-FR' : 'en-US'
  const promotionTypes = useMemo(() => buildPromotionTypes(t), [t])
  const statusLabels = useMemo(() => buildStatusLabels(t), [t])
  const statusTransitionLabels = useMemo(() => buildStatusTransitionLabels(t), [t])
  const statusOptions = useMemo(() => buildStatusOptions(statusLabels), [statusLabels])
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(localeTag, {
        style: 'currency',
        currency: 'XAF',
        minimumFractionDigits: 2
      }),
    [localeTag]
  )
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }),
    [localeTag]
  )
  const [promotions, setPromotions] = useState<AdminPromotion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<AdminPromotion | null>(null)
  const [form, setForm] = useState<PromotionFormState>(() => buildDefaultForm())
  const [formErrors, setFormErrors] = useState<PromotionFormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { addToast } = useToast()

  const loadPromotions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchAdminPromotions()
      setPromotions(
        data
          .slice()
          .sort(
            (a, b) =>
              new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          )
      )
    } catch (err) {
      console.error('Unable to load promotions', err)
      const message =
        err instanceof Error
          ? err.message
          : t('admin.promotions.toast.loadErrorMessage')
      setError(message)
      addToast({
        variant: 'error',
        title: t('admin.promotions.toast.loadErrorTitle'),
        message
      })
    } finally {
      setIsLoading(false)
    }
  }, [addToast, t])

  useEffect(() => {
    void loadPromotions()
  }, [loadPromotions])

  const sortedPromotions = useMemo(
    () =>
      promotions.slice().sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      ),
    [promotions]
  )

  const openCreateModal = () => {
    setEditingPromotion(null)
    setForm(buildDefaultForm())
    setFormErrors({})
    setIsModalOpen(true)
  }

  const openEditModal = (promotion: AdminPromotion) => {
    setEditingPromotion(promotion)
    setForm({
      name: promotion.name,
      type: promotion.type,
      status: promotion.status,
      startDate: toInputDateTime(promotion.startDate),
      endDate: toInputDateTime(promotion.endDate),
      budget: String(promotion.budget ?? ''),
      description: promotion.description ?? '',
      listingId: promotion.listingId ?? ''
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const openDuplicateModal = (promotion: AdminPromotion) => {
    setEditingPromotion(null)
    setForm({
      name: t('admin.promotions.duplicateName', { name: promotion.name }),
      type: promotion.type,
      status: 'draft',
      startDate: toInputDateTime(new Date()),
      endDate: toInputDateTime(
        new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000)
      ),
      budget: String(promotion.budget ?? ''),
      description: promotion.description ?? '',
      listingId: promotion.listingId ?? ''
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingPromotion(null)
    setForm(buildDefaultForm())
    setFormErrors({})
  }

  const handleFormChange = <Key extends keyof PromotionFormState>(
    field: Key,
    value: PromotionFormState[Key]
  ) => {
    setForm(previous => ({ ...previous, [field]: value }))
  }

  const validateForm = (): { payload: PromotionPayload | null; errors: PromotionFormErrors } => {
    const errors: PromotionFormErrors = {}
    if (!form.name.trim()) {
      errors.name = t('admin.promotions.form.errors.name')
    }
    if (!form.startDate) {
      errors.startDate = t('admin.promotions.form.errors.startDate')
    }
    if (!form.endDate) {
      errors.endDate = t('admin.promotions.form.errors.endDate')
    }

    const start = form.startDate ? new Date(form.startDate) : null
    const end = form.endDate ? new Date(form.endDate) : null
    if (start && end && start > end) {
      errors.endDate = t('admin.promotions.form.errors.endAfterStart')
    }

    const budgetValue = Number.parseFloat(form.budget)
    if (Number.isNaN(budgetValue) || budgetValue < 0) {
      errors.budget = t('admin.promotions.form.errors.budget')
    }

    if (Object.keys(errors).length) {
      return { payload: null, errors }
    }

    const payload: PromotionPayload = {
      name: form.name.trim(),
      type: form.type,
      status: form.status,
      startDate: fromInputDateTime(form.startDate),
      endDate: fromInputDateTime(form.endDate),
      budget: Number(budgetValue.toFixed(2)),
      description: form.description.trim() || undefined,
      listingId: form.listingId.trim() || undefined
    }

    return { payload, errors }
  }

  const handleSubmit = async () => {
    const { payload, errors } = validateForm()
    setFormErrors(errors)
    if (!payload) {
      return
    }

    setIsSaving(true)
    try {
      let saved: AdminPromotion
      if (editingPromotion) {
        saved = await updateAdminPromotion(editingPromotion.id, payload)
        setPromotions(prev =>
          prev.map(promotion =>
            promotion.id === saved.id ? saved : promotion
          )
        )
        addToast({
          variant: 'success',
          title: t('admin.promotions.toast.updatedTitle'),
          message: t('admin.promotions.toast.updatedMessage')
        })
      } else {
        saved = await createAdminPromotion(payload)
        setPromotions(prev =>
          [saved, ...prev].sort(
            (a, b) =>
              new Date(b.startDate).getTime() -
              new Date(a.startDate).getTime()
          )
        )
        addToast({
          variant: 'success',
          title: t('admin.promotions.toast.createdTitle'),
          message: t('admin.promotions.toast.createdMessage')
        })
      }
      closeModal()
    } catch (err) {
      console.error('Unable to save promotion', err)
      addToast({
        variant: 'error',
        title: t('admin.promotions.toast.saveErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('admin.promotions.toast.saveErrorMessage')
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleStatusTransition = async (
    promotion: AdminPromotion,
    status: PromotionStatus
  ) => {
    setStatusUpdatingId(promotion.id)
    try {
      const updated = await transitionAdminPromotionStatus(
        promotion.id,
        status
      )
      setPromotions(prev =>
        prev.map(item => (item.id === updated.id ? updated : item))
      )
      addToast({
        variant: 'success',
        title: t('admin.promotions.toast.statusUpdatedTitle'),
        message: t('admin.promotions.toast.statusUpdatedMessage', {
          status: statusLabels[updated.status]
        })
      })
    } catch (err) {
      console.error('Unable to transition promotion status', err)
      addToast({
        variant: 'error',
        title: t('admin.promotions.toast.statusErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('admin.promotions.toast.statusErrorMessage')
      })
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleDelete = async (promotion: AdminPromotion) => {
    if (!window.confirm(t('admin.promotions.deleteConfirm', { name: promotion.name }))) {
      return
    }
    setDeletingId(promotion.id)
    try {
      await deleteAdminPromotion(promotion.id)
      setPromotions(prev => prev.filter(item => item.id !== promotion.id))
      addToast({
        variant: 'info',
        title: t('admin.promotions.toast.deletedTitle'),
        message: t('admin.promotions.toast.deletedMessage')
      })
    } catch (err) {
      console.error('Unable to delete promotion', err)
      addToast({
        variant: 'error',
        title: t('admin.promotions.toast.deleteErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('admin.promotions.toast.deleteErrorMessage')
      })
    } finally {
      setDeletingId(null)
    }
  }

  const modalFooter = (
    <div className="auth-form__actions" style={{ justifyContent: 'flex-end', gap: '12px' }}>
      <Button variant="ghost" onClick={closeModal} disabled={isSaving}>
        {t('actions.cancel')}
      </Button>
      <Button onClick={handleSubmit} disabled={isSaving}>
        {isSaving ? t('admin.promotions.saving') : t('actions.save')}
      </Button>
    </div>
  )

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('admin.promotions.title')}</h1>
            <p>{t('admin.promotions.subtitle')}</p>
          </div>
          <Button onClick={openCreateModal}>{t('admin.promotions.create')}</Button>
        </header>

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading && !sortedPromotions.length ? (
          <p style={{ padding: '1rem', color: '#6c757d' }}>
            {t('admin.promotions.loading')}
          </p>
        ) : null}

        <section className="admin-grid">
          {sortedPromotions.length ? (
            sortedPromotions.map(promotion => (
              <article key={promotion.id} className="admin-card">
                <div className="admin-card__meta">
                  <div>
                    <strong>{promotion.name}</strong>
                    <p style={{ color: '#6c757d', marginTop: '4px' }}>
                      {promotionTypes.find(option => option.value === promotion.type)?.label ??
                        promotion.type.toUpperCase()}
                    </p>
                  </div>
                  <span
                    className={`admin-status ${STATUS_BADGES[promotion.status]}`}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {statusLabels[promotion.status]}
                  </span>
                </div>
                <ul className="admin-card__details">
                  <li>
                    <span>{t('admin.promotions.details.period')}</span>
                    <strong>{formatSchedule(promotion.startDate, promotion.endDate, dateTimeFormatter)}</strong>
                  </li>
                  <li>
                    <span>{t('admin.promotions.details.budget')}</span>
                    <strong>{currencyFormatter.format(promotion.budget ?? 0)}</strong>
                  </li>
                  {promotion.listing ? (
                    <li>
                      <span>{t('admin.promotions.details.listing')}</span>
                      <strong>{promotion.listing.title}</strong>
                    </li>
                  ) : null}
                </ul>
                {promotion.description ? (
                  <p style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                    {promotion.description}
                  </p>
                ) : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                  <Button variant="outline" onClick={() => openEditModal(promotion)}>
                    {t('admin.promotions.actions.edit')}
                  </Button>
                  <Button variant="ghost" onClick={() => openDuplicateModal(promotion)}>
                    {t('admin.promotions.actions.duplicate')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleDelete(promotion)}
                    disabled={deletingId === promotion.id}
                  >
                    {deletingId === promotion.id
                      ? t('admin.promotions.deleting')
                      : t('admin.promotions.actions.delete')}
                  </Button>
                </div>

                {STATUS_TRANSITIONS[promotion.status].length ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginTop: '16px',
                      borderTop: '1px solid #e5e7eb',
                      paddingTop: '12px'
                    }}
                  >
                    {STATUS_TRANSITIONS[promotion.status].map(nextStatus => (
                      <Button
                        key={nextStatus}
                        variant={nextStatus === 'cancelled' ? 'ghost' : 'outline'}
                        onClick={() => handleStatusTransition(promotion, nextStatus)}
                        disabled={statusUpdatingId === promotion.id}
                      >
                        {statusUpdatingId === promotion.id
                          ? t('admin.promotions.statusUpdating')
                          : statusTransitionLabels[promotion.status]?.[nextStatus] ??
                            statusLabels[nextStatus]}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          ) : !isLoading ? (
            <p style={{ padding: '1rem', color: '#6c757d' }}>
              {t('admin.promotions.empty')}
            </p>
          ) : null}
        </section>

        <Modal
          open={isModalOpen}
          onClose={isSaving ? undefined : closeModal}
          title={
            editingPromotion
              ? t('admin.promotions.modal.editTitle')
              : t('admin.promotions.modal.createTitle')
          }
          footer={modalFooter}
        >
          <div style={{ display: 'grid', gap: '16px' }}>
            <FormField
              label={t('admin.promotions.form.name')}
              required
              htmlFor="promotion-name"
              error={formErrors.name}
            >
              <input
                id="promotion-name"
                className="input"
                value={form.name}
                onChange={event => handleFormChange('name', event.target.value)}
                placeholder={t('admin.promotions.form.namePlaceholder')}
              />
            </FormField>
            <FormField label={t('admin.promotions.form.type')} required htmlFor="promotion-type">
              <select
                id="promotion-type"
                className="input"
                value={form.type}
                onChange={event =>
                  handleFormChange('type', event.target.value as PromotionType)
                }
              >
                {promotionTypes.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label={t('admin.promotions.form.status')}
              required
              htmlFor="promotion-status"
              hint={t('admin.promotions.form.statusHint')}
            >
              <select
                id="promotion-status"
                className="input"
                value={form.status}
                onChange={event =>
                  handleFormChange('status', event.target.value as PromotionStatus)
                }
                disabled={Boolean(editingPromotion && !['draft', 'scheduled'].includes(editingPromotion.status))}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label={t('admin.promotions.form.startDate')}
              required
              htmlFor="promotion-start"
              error={formErrors.startDate}
            >
              <input
                id="promotion-start"
                type="datetime-local"
                className="input"
                value={form.startDate}
                onChange={event => handleFormChange('startDate', event.target.value)}
              />
            </FormField>
            <FormField
              label={t('admin.promotions.form.endDate')}
              required
              htmlFor="promotion-end"
              error={formErrors.endDate}
            >
              <input
                id="promotion-end"
                type="datetime-local"
                className="input"
                value={form.endDate}
                onChange={event => handleFormChange('endDate', event.target.value)}
              />
            </FormField>
            <FormField
              label={t('admin.promotions.form.budget')}
              required
              htmlFor="promotion-budget"
              error={formErrors.budget}
            >
              <input
                id="promotion-budget"
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={form.budget}
                onChange={event => handleFormChange('budget', event.target.value)}
              />
            </FormField>
            <FormField
              label={t('admin.promotions.form.listing')}
              htmlFor="promotion-listing"
              hint={t('admin.promotions.form.listingHint')}
            >
              <input
                id="promotion-listing"
                className="input"
                value={form.listingId}
                onChange={event => handleFormChange('listingId', event.target.value)}
              />
            </FormField>
            <FormField label={t('admin.promotions.form.description')} htmlFor="promotion-description">
              <textarea
                id="promotion-description"
                className="input"
                rows={3}
                value={form.description}
                onChange={event => handleFormChange('description', event.target.value)}
                placeholder={t('admin.promotions.form.descriptionPlaceholder')}
              />
            </FormField>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  )
}
