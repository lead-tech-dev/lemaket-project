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
  updateAdminPromotionPaymentStatus,
  updateAdminPromotion
} from '../../utils/admin-api'
import type { PromotionPayload } from '../../utils/admin-api'
import type {
  AdminPromotion,
  PromotionPaymentStatus,
  PromotionStatus,
  PromotionType
} from '../../types/admin'

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
type CampaignFormStep = 0 | 1 | 2

const buildPromotionTypes = (
  t: (key: string, values?: Record<string, string | number>) => string
): { value: PromotionType; label: string }[] => [
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

const PAYMENT_BADGES: Record<PromotionPaymentStatus, string> = {
  unpaid: 'admin-status--rejected',
  pending: 'admin-status--pending',
  paid: 'admin-status--approved',
  failed: 'admin-status--rejected'
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
): { value: PromotionStatus; label: string }[] => [
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
  const [activeStep, setActiveStep] = useState<CampaignFormStep>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [paymentUpdatingId, setPaymentUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { addToast } = useToast()

  const paymentLabels = useMemo<Record<PromotionPaymentStatus, string>>(
    () =>
      locale === 'fr'
        ? {
            unpaid: 'Non payé',
            pending: 'En attente',
            paid: 'Payé',
            failed: 'Échoué'
          }
        : {
            unpaid: 'Unpaid',
            pending: 'Pending',
            paid: 'Paid',
            failed: 'Failed'
          },
    [locale]
  )

  const normalizePromotion = useCallback(
    (promotion: AdminPromotion): AdminPromotion => ({
      ...promotion,
      paymentStatus: promotion.paymentStatus ?? 'unpaid',
      paymentId: promotion.paymentId ?? null
    }),
    []
  )

  const loadPromotions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchAdminPromotions()
      setPromotions(
        data
          .map(normalizePromotion)
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
  }, [addToast, normalizePromotion, t])

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
    setActiveStep(0)
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
    setActiveStep(0)
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
    setActiveStep(0)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingPromotion(null)
    setForm(buildDefaultForm())
    setFormErrors({})
    setActiveStep(0)
  }

  const handleFormChange = <Key extends keyof PromotionFormState>(
    field: Key,
    value: PromotionFormState[Key]
  ) => {
    setForm(previous => ({ ...previous, [field]: value }))
  }

  const validateForm = (): { payload: PromotionPayload | null; errors: PromotionFormErrors } => {
    const errors: PromotionFormErrors = {}
    const now = new Date()
    const invalidListingMessage =
      locale === 'fr'
        ? 'Identifiant annonce invalide (UUID attendu).'
        : 'Invalid listing id (UUID expected).'

    if (!form.name.trim()) {
      errors.name = t('admin.promotions.form.errors.name')
    }
    if (
      (form.status === 'scheduled' || form.status === 'active') &&
      (!editingPromotion || editingPromotion.paymentStatus !== 'paid')
    ) {
      errors.status =
        locale === 'fr'
          ? 'La campagne doit être payée avant planification/activation.'
          : 'Campaign must be paid before scheduling/activation.'
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

    if (start && form.status === 'scheduled' && start <= now) {
      errors.startDate =
        locale === 'fr'
          ? 'Une campagne planifiée doit démarrer dans le futur.'
          : 'A scheduled campaign must start in the future.'
    }

    if (start && form.status === 'active' && start > now) {
      errors.startDate =
        locale === 'fr'
          ? 'Une campagne active ne peut pas démarrer dans le futur.'
          : 'An active campaign cannot start in the future.'
    }

    if (
      end &&
      (form.status === 'completed' || form.status === 'cancelled') &&
      end > now
    ) {
      errors.endDate =
        locale === 'fr'
          ? 'Ce statut nécessite une date de fin passée.'
          : 'This status requires an end date in the past.'
    }

    const budgetValue = Number.parseFloat(form.budget)
    if (Number.isNaN(budgetValue) || budgetValue < 0) {
      errors.budget = t('admin.promotions.form.errors.budget')
    }

    if (form.listingId.trim()) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(form.listingId.trim())) {
        errors.listingId = invalidListingMessage
      }
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

  const validateStep = (step: CampaignFormStep): boolean => {
    const { errors } = validateForm()
    const stepFields: Record<CampaignFormStep, (keyof PromotionFormState)[]> = {
      0: ['name', 'type', 'status'],
      1: ['listingId', 'description'],
      2: ['startDate', 'endDate', 'budget']
    }
    const scopedErrors = Object.fromEntries(
      Object.entries(errors).filter(([key]) =>
        stepFields[step].includes(key as keyof PromotionFormState)
      )
    ) as PromotionFormErrors

    // Remplace les erreurs des champs de l'étape : applique les erreurs
    // courantes ET efface celles des champs désormais valides (sinon une
    // erreur corrigée reste affichée jusqu'au prochain validateForm complet).
    setFormErrors(previous => {
      const next = { ...previous }
      for (const field of stepFields[step]) {
        if (scopedErrors[field]) {
          next[field] = scopedErrors[field]
        } else {
          delete next[field]
        }
      }
      return next
    })
    return Object.keys(scopedErrors).length === 0
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
        saved = normalizePromotion(await updateAdminPromotion(editingPromotion.id, payload))
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
        saved = normalizePromotion(await createAdminPromotion(payload))
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

  const handlePaymentStatusUpdate = async (
    promotion: AdminPromotion,
    paymentStatus: PromotionPaymentStatus
  ) => {
    setPaymentUpdatingId(promotion.id)
    try {
      let paymentId: string | null | undefined = undefined
      if (paymentStatus === 'paid') {
        const input = window.prompt(
          locale === 'fr'
            ? 'Référence de paiement (UUID) requise pour marquer cette campagne comme payée.'
            : 'Payment reference (UUID) is required to mark this campaign as paid.',
          promotion.paymentId ?? ''
        )
        if (input === null) {
          setPaymentUpdatingId(null)
          return
        }
        paymentId = input.trim() || null
      }

      const updated = normalizePromotion(
        await updateAdminPromotionPaymentStatus(promotion.id, {
          paymentStatus,
          paymentId
        })
      )
      setPromotions(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      addToast({
        variant: 'success',
        title: locale === 'fr' ? 'Paiement mis à jour' : 'Payment updated',
        message:
          locale === 'fr'
            ? `La campagne est désormais: ${paymentLabels[updated.paymentStatus]}.`
            : `Campaign is now: ${paymentLabels[updated.paymentStatus]}.`
      })
    } catch (err) {
      console.error('Unable to update campaign payment status', err)
      addToast({
        variant: 'error',
        title: t('admin.promotions.toast.statusErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : locale === 'fr'
              ? 'Impossible de mettre à jour le statut de paiement.'
              : 'Unable to update payment status.'
      })
    } finally {
      setPaymentUpdatingId(null)
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

  const goToNextStep = () => {
    if (!validateStep(activeStep)) {
      return
    }
    setActiveStep(previous => (previous < 2 ? ((previous + 1) as CampaignFormStep) : previous))
  }

  const goToPreviousStep = () => {
    setActiveStep(previous => (previous > 0 ? ((previous - 1) as CampaignFormStep) : previous))
  }

  const modalFooter = (
    <div className="auth-form__actions" style={{ justifyContent: 'flex-end', gap: '12px' }}>
      <Button type="button" variant="ghost" onClick={closeModal} disabled={isSaving}>
        {t('actions.cancel')}
      </Button>
      {activeStep > 0 ? (
        <Button type="button" variant="outline" onClick={goToPreviousStep} disabled={isSaving}>
          {t('actions.previousStep')}
        </Button>
      ) : null}
      {activeStep < 2 ? (
        <Button type="button" onClick={goToNextStep} disabled={isSaving}>
          {t('actions.nextStep')}
        </Button>
      ) : (
        <Button type="button" onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? t('admin.promotions.saving') : t('actions.save')}
        </Button>
      )}
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
          <Button
            type="button"
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              openCreateModal()
            }}
          >
            {t('admin.promotions.create')}
          </Button>
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
              <article key={promotion.id} className="admin-card admin-promo-card">
                <div className="admin-card__meta admin-promo-card__meta">
                  <div className="admin-promo-card__identity">
                    <strong className="admin-promo-card__title">{promotion.name}</strong>
                    <p className="admin-promo-card__type">
                      {promotionTypes.find(option => option.value === promotion.type)?.label ??
                        promotion.type.toUpperCase()}
                    </p>
                  </div>
                  <span
                    className={`admin-status ${STATUS_BADGES[promotion.status]}`}
                    style={{ textTransform: 'capitalize', alignSelf: 'center' }}
                  >
                    {statusLabels[promotion.status]}
                  </span>
                </div>
                <div className="admin-card__meta admin-promo-card__payment-row">
                  <span className="admin-promo-card__payment-label">
                    {locale === 'fr' ? 'Paiement campagne' : 'Campaign payment'}
                  </span>
                  <span
                    className={`admin-status admin-promo-card__payment-badge ${PAYMENT_BADGES[promotion.paymentStatus ?? 'unpaid']}`}
                  >
                    {paymentLabels[promotion.paymentStatus ?? 'unpaid']}
                  </span>
                </div>
                <ul className="admin-card__details admin-promo-card__details">
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
                  <p className="admin-promo-card__description">
                    {promotion.description}
                  </p>
                ) : null}

                <div className="admin-promo-card__actions">
                  <Button type="button" variant="outline" onClick={() => openEditModal(promotion)}>
                    {t('admin.promotions.actions.edit')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => openDuplicateModal(promotion)}>
                    {t('admin.promotions.actions.duplicate')}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => handleDelete(promotion)}
                    disabled={deletingId === promotion.id}
                  >
                    {deletingId === promotion.id
                      ? t('admin.promotions.deleting')
                      : t('admin.promotions.actions.delete')}
                  </Button>
                  {promotion.paymentStatus !== 'paid' ? (
                    <Button
                      type="button"
                      variant="accent"
                      onClick={() => handlePaymentStatusUpdate(promotion, 'paid')}
                      disabled={paymentUpdatingId === promotion.id}
                    >
                      {paymentUpdatingId === promotion.id
                        ? locale === 'fr'
                          ? 'Mise à jour paiement…'
                          : 'Updating payment…'
                        : locale === 'fr'
                          ? 'Marquer payé'
                          : 'Mark as paid'}
                    </Button>
                  ) : null}
                </div>

                {STATUS_TRANSITIONS[promotion.status].length ? (
                  <div className="admin-promo-card__transitions">
                    {STATUS_TRANSITIONS[promotion.status].map(nextStatus => (
                      <Button
                        type="button"
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
          closeOnBackdrop={false}
          title={
            editingPromotion
              ? t('admin.promotions.modal.editTitle')
              : t('admin.promotions.modal.createTitle')
          }
          footer={modalFooter}
        >
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                t('admin.promotions.form.name'),
                t('admin.promotions.form.listing'),
                t('admin.promotions.form.startDate')
              ].map((label, index) => (
                <span
                  key={label}
                  className={`admin-status ${activeStep === index ? 'admin-status--approved' : 'admin-status--pending'}`}
                  style={{ textTransform: 'none' }}
                >
                  {index + 1}. {label}
                </span>
              ))}
            </div>

            {activeStep === 0 ? (
              <>
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
                  error={formErrors.status}
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
              </>
            ) : null}

            {activeStep === 1 ? (
              <>
                <FormField
                  label={t('admin.promotions.form.listing')}
                  htmlFor="promotion-listing"
                  hint={t('admin.promotions.form.listingHint')}
                  error={formErrors.listingId}
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
              </>
            ) : null}

            {activeStep === 2 ? (
              <>
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
              </>
            ) : null}
          </div>
        </Modal>
      </div>
    </AdminLayout>
  )
}
