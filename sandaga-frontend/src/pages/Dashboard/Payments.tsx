import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../utils/api'
import { PaymentMethodModal, type PaymentMethodForm } from '../../components/ui/PaymentMethodModal'
import { useToast } from '../../components/ui/Toast'
import type {
  CheckoutSessionStatus,
  PaymentInvoice,
  PaymentMethod,
  PaymentRecord,
  PaymentSubscription
} from '../../types/payment'
import { useI18n } from '../../contexts/I18nContext'

const STATUS_BADGE: Record<string, string> = {
  completed: 'admin-status--approved',
  pending: 'admin-status--pending',
  failed: 'admin-status--rejected',
  refunded: 'admin-status--rejected'
}

const VERIFICATION_BADGE: Record<string, string> = {
  verified: 'admin-status--approved',
  pending: 'admin-status--pending',
  failed: 'admin-status--rejected',
  not_required: 'admin-status--pending'
}

const SUBSCRIPTION_BADGE: Record<string, string> = {
  active: 'admin-status--approved',
  paused: 'admin-status--pending',
  canceled: 'admin-status--rejected',
  expired: 'admin-status--rejected'
}

function formatPaymentMethod(
  method: PaymentMethod,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (method.label && method.label.trim().length > 0) {
    return method.label
  }

  if (method.type === 'card') {
    const identifier = method.last4 ? `**** ${method.last4}` : ''
    const brand = method.brand ?? t('dashboard.payments.method.cardFallback')
    return `${brand} ${identifier}`.trim()
  }

  if (method.type === 'wallet') {
    return t('dashboard.payments.method.wallet')
  }

  if (method.type === 'transfer') {
    return t('dashboard.payments.method.transfer')
  }

  if (method.type === 'cash') {
    return t('dashboard.payments.method.cash')
  }

  return method.type
}

function formatDate(
  value: string | null | undefined,
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  if (!value) {
    return t('dashboard.payments.date.empty')
  }
  try {
    return new Date(value).toLocaleDateString(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return value
  }
}

function formatAmount(
  amount: number | string,
  currency: string,
  locale: string
): string {
  const numericAmount =
    typeof amount === 'number' ? amount : Number.isNaN(Number(amount)) ? amount : Number(amount)

  if (typeof numericAmount === 'number' && Number.isFinite(numericAmount)) {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(numericAmount)
    } catch {
      return `${numericAmount.toLocaleString(locale)} ${currency}`
    }
  }

  return `${amount} ${currency}`
}

function isRenewalSoon(date?: string | null): boolean {
  if (!date) {
    return false
  }
  const timestamp = new Date(date).getTime()
  if (Number.isNaN(timestamp)) {
    return false
  }
  const diff = timestamp - Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return diff > 0 && diff <= sevenDays
}

export default function Payments() {
  const { locale, t } = useI18n()
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [invoices, setInvoices] = useState<PaymentRecord[]>([])
  const [subscriptions, setSubscriptions] = useState<PaymentSubscription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingMethodId, setUpdatingMethodId] = useState<string | null>(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [verifyingMethod, setVerifyingMethod] = useState<PaymentMethod | null>(null)
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
  const [verificationStep, setVerificationStep] = useState<'prompt' | 'confirm'>('prompt')
  const [verificationRedirectUrl, setVerificationRedirectUrl] = useState<string | null>(null)
  const [isVerificationLoading, setIsVerificationLoading] = useState(false)
  const [updatingSubscriptionId, setUpdatingSubscriptionId] = useState<string | null>(null)
  const [reminderRequests, setReminderRequests] = useState<Record<string, boolean>>({})
  const [isFinalizingSession, setIsFinalizingSession] = useState(false)
  const finalizedSessionsRef = useRef<Set<string>>(new Set())
  const location = useLocation()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const statusLabels = useMemo(
    () => ({
      pending: t('dashboard.payments.status.pending'),
      completed: t('dashboard.payments.status.completed'),
      failed: t('dashboard.payments.status.failed'),
      refunded: t('dashboard.payments.status.refunded')
    }),
    [t]
  )

  const verificationStatusLabels = useMemo(
    () => ({
      not_required: t('dashboard.payments.verification.notRequired'),
      pending: t('dashboard.payments.verification.pending'),
      verified: t('dashboard.payments.verification.verified'),
      failed: t('dashboard.payments.verification.failed')
    }),
    [t]
  )

  const subscriptionStatusLabels = useMemo(
    () => ({
      active: t('dashboard.payments.subscription.active'),
      paused: t('dashboard.payments.subscription.paused'),
      canceled: t('dashboard.payments.subscription.canceled'),
      expired: t('dashboard.payments.subscription.expired')
    }),
    [t]
  )

  const loadPayments = useCallback(
    async (signal?: AbortSignal, options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }
      setError(null)

      try {
        const [methodsData, invoicesData, subscriptionsData] = await Promise.all([
          apiGet<PaymentMethod[]>('/payments/methods', { signal }),
          apiGet<PaymentRecord[]>('/payments/invoices', { signal }),
          apiGet<PaymentSubscription[]>('/payments/subscriptions', { signal })
        ])

        if (signal?.aborted) {
          return
        }

        setMethods(methodsData)
        setInvoices(invoicesData)
        setSubscriptions(subscriptionsData)
      } catch (err) {
        if (signal?.aborted) {
          return
        }
        console.error('Unable to load payment data', err)
        const message =
          err instanceof Error
            ? err.message
            : t('dashboard.payments.loadError')
        setError(message)
        addToast({ variant: 'error', title: t('dashboard.payments.loadTitle'), message })
      } finally {
        if (signal?.aborted) {
          return
        }
        if (!options?.silent) {
          setIsLoading(false)
        } else {
          setIsRefreshing(false)
        }
      }
    },
    [addToast, t]
  )

  const finalizeSession = useCallback(
    async (sessionId: string) => {
      setIsFinalizingSession(true)
      try {
        const result = await apiGet<CheckoutSessionStatus>(`/payments/checkout/sessions/${sessionId}`)

        if (result.mode === 'payment') {
          const status = result.paymentStatus ?? null
          if (status === 'paid' || status === 'no_payment_required') {
            addToast({
              variant: 'success',
              title: t('dashboard.payments.checkout.confirmedTitle'),
              message: t('dashboard.payments.checkout.confirmedMessage')
            })
          } else if (status === 'unpaid') {
            addToast({
              variant: 'error',
              title: t('dashboard.payments.checkout.cancelTitle'),
              message: t('dashboard.payments.checkout.cancelMessage')
            })
          } else {
            addToast({
              variant: 'info',
              title: t('dashboard.payments.checkout.pendingTitle'),
              message: t('dashboard.payments.checkout.pendingMessage')
            })
          }
        } else if (result.mode === 'subscription') {
          const label = result.subscriptionStatus
            ? subscriptionStatusLabels[result.subscriptionStatus] ?? t('dashboard.payments.subscription.statusFallback')
            : t('dashboard.payments.subscription.statusFallback')
          addToast({
            variant: result.subscriptionStatus === 'active' ? 'success' : 'info',
            title: t('dashboard.payments.subscription.updatedTitle'),
            message: t('dashboard.payments.subscription.updatedMessage', { status: label })
          })
        }

        await loadPayments(undefined, { silent: true })
      } catch (err) {
        console.error('Unable to finalize Stripe session', err)
      addToast({
        variant: 'error',
        title: t('dashboard.payments.checkout.confirmErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.payments.checkout.confirmErrorMessage')
      })
      } finally {
        setIsFinalizingSession(false)
      }
    },
    [addToast, loadPayments, subscriptionStatusLabels, t]
  )

  useEffect(() => {
    const controller = new AbortController()

    loadPayments(controller.signal)

    return () => controller.abort()
  }, [loadPayments])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const sessionId = params.get('session_id')

    if (!sessionId || finalizedSessionsRef.current.has(sessionId)) {
      return
    }

    finalizedSessionsRef.current.add(sessionId)

    ;(async () => {
      await finalizeSession(sessionId)
      const nextParams = new URLSearchParams(location.search)
      nextParams.delete('session_id')
      nextParams.delete('status')
      navigate(
        {
          pathname: location.pathname,
          search: nextParams.toString() ? `?${nextParams.toString()}` : ''
        },
        { replace: true }
      )
    })()
  }, [location.pathname, location.search, finalizeSession, navigate])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const status = params.get('status')
    const sessionId = params.get('session_id')

    if (status === 'cancel' && !sessionId) {
      addToast({
        variant: 'info',
        title: t('dashboard.payments.checkout.canceledTitle'),
        message: t('dashboard.payments.checkout.canceledMessage')
      })
      params.delete('status')
      navigate(
        {
          pathname: location.pathname,
          search: params.toString() ? `?${params.toString()}` : ''
        },
        { replace: true }
      )
    }
  }, [location.pathname, location.search, addToast, navigate])

  const handleSaveMethod = async (data: PaymentMethodForm) => {
    const payload = {
      ...data,
      holderName: data.holderName.trim(),
      label: data.label && data.label.length > 0 ? data.label.trim() : undefined,
      isDefault: Boolean(data.isDefault)
    }

    try {
      if (editingMethod) {
        await apiPatch<PaymentMethod>(`/payments/methods/${editingMethod.id}`, payload)
        addToast({
          variant: 'success',
          title: t('dashboard.payments.methods.updatedTitle'),
          message: t('dashboard.payments.methods.updatedMessage')
        })
      } else {
        await apiPost<PaymentMethod>('/payments/methods', payload)
        addToast({
          variant: 'success',
          title: t('dashboard.payments.methods.createdTitle'),
          message: t('dashboard.payments.methods.createdMessage')
        })
      }

      setIsModalOpen(false)
      setEditingMethod(null)
      await loadPayments(undefined, { silent: true })
    } catch (err) {
      console.error('Unable to save payment method', err)
      addToast({
        variant: 'error',
        title: t('dashboard.payments.methods.saveErrorTitle'),
        message: err instanceof Error ? err.message : t('dashboard.payments.methods.saveErrorMessage')
      })
    }
  }

  const handleDeleteMethod = async (id: string) => {
    if (!window.confirm(t('dashboard.payments.methods.deleteConfirm'))) {
      return
    }

    try {
      setDeletingId(id)
      await apiDelete(`/payments/methods/${id}`)
      addToast({
        variant: 'info',
        title: t('dashboard.payments.methods.deletedTitle'),
        message: t('dashboard.payments.methods.deletedMessage')
      })
      await loadPayments(undefined, { silent: true })
    } catch (err) {
      console.error('Unable to delete payment method', err)
      addToast({
        variant: 'error',
        title: t('dashboard.payments.methods.deleteErrorTitle'),
        message: err instanceof Error ? err.message : t('dashboard.payments.methods.deleteErrorMessage')
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleSetDefaultMethod = async (method: PaymentMethod) => {
    if (method.isDefault) {
      return
    }
    try {
      setUpdatingMethodId(method.id)
      await apiPatch<PaymentMethod>(`/payments/methods/${method.id}`, { isDefault: true })
      addToast({
        variant: 'success',
        title: t('dashboard.payments.methods.defaultTitle'),
        message: t('dashboard.payments.methods.defaultMessage', {
          method: formatPaymentMethod(method, t)
        })
      })
      await loadPayments(undefined, { silent: true })
    } catch (err) {
      console.error('Unable to update default method', err)
      addToast({
        variant: 'error',
        title: t('dashboard.payments.methods.defaultErrorTitle'),
        message: err instanceof Error ? err.message : t('dashboard.payments.methods.defaultErrorMessage')
      })
    } finally {
      setUpdatingMethodId(null)
    }
  }

  const handleRefresh = () => loadPayments(undefined, { silent: true })

  const handleOpenModal = (method?: PaymentMethod) => {
    setEditingMethod(method ?? null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingMethod(null)
  }

  const handleOpenVerification = (method: PaymentMethod) => {
    setVerifyingMethod(method)
    setVerificationStep('prompt')
    setVerificationRedirectUrl(null)
    setIsVerificationModalOpen(true)
  }

  const handleBeginVerification = async () => {
    if (!verifyingMethod) {
      return
    }
    try {
      setIsVerificationLoading(true)
      const response = await apiPost<{ redirectUrl?: string }>(
        `/payments/methods/${verifyingMethod.id}/verify`
      )
      if (response?.redirectUrl) {
        setVerificationRedirectUrl(response.redirectUrl)
        const popup = window.open(response.redirectUrl, '_blank', 'noopener')
        if (!popup) {
          addToast({
            variant: 'info',
            title: t('dashboard.payments.verification.popupTitle'),
            message: t('dashboard.payments.verification.popupMessage')
          })
        }
      }
      setVerificationStep('confirm')
    } catch (err) {
      console.error('Unable to start verification', err)
      addToast({
        variant: 'error',
        title: t('dashboard.payments.verification.startErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.payments.verification.startErrorMessage')
      })
    } finally {
      setIsVerificationLoading(false)
    }
  }

  const handleCompleteVerification = async (success: boolean) => {
    if (!verifyingMethod) {
      return
    }
    try {
      setIsVerificationLoading(true)
      await apiPost(`/payments/methods/${verifyingMethod.id}/confirm`, { success })
      addToast({
        variant: success ? 'success' : 'error',
        title: success
          ? t('dashboard.payments.verification.successTitle')
          : t('dashboard.payments.verification.failedTitle'),
        message: success
          ? t('dashboard.payments.verification.successMessage')
          : t('dashboard.payments.verification.failedMessage')
      })
    } catch (err) {
      console.error('Unable to confirm verification', err)
      addToast({
        variant: 'error',
        title: success
          ? t('dashboard.payments.verification.confirmErrorTitle')
          : t('dashboard.payments.verification.failedTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.payments.verification.confirmErrorMessage')
      })
    } finally {
      setIsVerificationLoading(false)
      setIsVerificationModalOpen(false)
      setVerificationStep('prompt')
      setVerificationRedirectUrl(null)
      setVerifyingMethod(null)
      await loadPayments(undefined, { silent: true })
    }
  }

  const handleCloseVerification = () => {
    if (isVerificationLoading) {
      return
    }
    setIsVerificationModalOpen(false)
    setVerificationStep('prompt')
    setVerificationRedirectUrl(null)
    setVerifyingMethod(null)
  }

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      setDownloadingInvoiceId(invoiceId)
      const data = await apiGet<PaymentInvoice>(`/payments/invoices/${invoiceId}`)
      const url = data.downloadUrl ?? data.invoice.invoiceUrl
      if (!url) {
        throw new Error(t('dashboard.payments.invoices.noFile'))
      }
      const popup = window.open(url, '_blank', 'noopener')
      if (!popup) {
        addToast({
          variant: 'info',
          title: t('dashboard.payments.invoices.popupTitle'),
          message:
            t('dashboard.payments.invoices.popupMessage')
        })
      } else {
        addToast({
          variant: 'success',
          title: t('dashboard.payments.invoices.readyTitle'),
          message: t('dashboard.payments.invoices.readyMessage')
        })
      }
    } catch (err) {
      console.error('Unable to download invoice', err)
      addToast({
        variant: 'error',
        title: t('dashboard.payments.invoices.downloadErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.payments.invoices.downloadErrorMessage')
      })
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  const handleCancelSubscription = async (subscription: PaymentSubscription) => {
    try {
      setUpdatingSubscriptionId(subscription.id)
      await apiPost(`/payments/subscriptions/${subscription.id}/cancel`)
      addToast({
        variant: 'info',
        title: t('dashboard.payments.subscription.cancelTitle'),
        message: t('dashboard.payments.subscription.cancelMessage', {
          name: subscription.planName
        })
      })
      await loadPayments(undefined, { silent: true })
    } catch (err) {
      console.error('Unable to cancel subscription', err)
      addToast({
        variant: 'error',
        title: t('dashboard.payments.subscription.actionErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.payments.subscription.cancelErrorMessage')
      })
    } finally {
      setUpdatingSubscriptionId(null)
    }
  }

  const handleResumeSubscription = async (subscription: PaymentSubscription) => {
    try {
      setUpdatingSubscriptionId(subscription.id)
      await apiPost(`/payments/subscriptions/${subscription.id}/resume`)
      addToast({
        variant: 'success',
        title: t('dashboard.payments.subscription.resumeTitle'),
        message: t('dashboard.payments.subscription.resumeMessage', {
          name: subscription.planName
        })
      })
      await loadPayments(undefined, { silent: true })
    } catch (err) {
      console.error('Unable to resume subscription', err)
      addToast({
        variant: 'error',
        title: t('dashboard.payments.subscription.actionErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.payments.subscription.resumeErrorMessage')
      })
    } finally {
      setUpdatingSubscriptionId(null)
    }
  }

  const handleScheduleReminder = (subscription: PaymentSubscription) => {
    setReminderRequests(prev => ({ ...prev, [subscription.id]: true }))
    addToast({
      variant: 'success',
      title: t('dashboard.payments.subscription.reminderTitle'),
      message: subscription.nextRenewalAt
        ? t('dashboard.payments.subscription.reminderMessageWithDate', {
            date: formatDate(subscription.nextRenewalAt, numberLocale, t)
          })
        : t('dashboard.payments.subscription.reminderMessageNoDate')
    })
  }

  const renderVerificationStatus = (method: PaymentMethod) => (
    <span className={`admin-status ${VERIFICATION_BADGE[method.verificationStatus]}`}>
      {verificationStatusLabels[method.verificationStatus]}
    </span>
  )

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('dashboard.payments.title')}</h1>
            <p>{t('dashboard.payments.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || isFinalizingSession}
          >
            {isRefreshing ? t('dashboard.payments.refreshing') : t('dashboard.payments.refresh')}
          </Button>
        </header>

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p style={{ padding: '1.5rem 0', color: '#6c757d' }}>
            {t('dashboard.payments.loading')}
          </p>
        ) : (
          <>
            <section className="dashboard-section">
              <div className="dashboard-section__head">
                <h2>{t('dashboard.payments.methods.title')}</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={isRefreshing || isFinalizingSession}
                  >
                    {isRefreshing ? t('dashboard.payments.refreshing') : t('dashboard.payments.refresh')}
                  </Button>
                  <Button variant="outline" onClick={() => handleOpenModal()}>
                    {t('dashboard.payments.methods.add')}
                  </Button>
                </div>
              </div>

              {methods.length === 0 ? (
                <div className="card" style={{ padding: '24px' }}>
                  <h3>{t('dashboard.payments.methods.emptyTitle')}</h3>
                  <p>
                    {t('dashboard.payments.methods.emptyDescription')}
                  </p>
                  <Button onClick={() => handleOpenModal()}>
                    {t('dashboard.payments.methods.emptyCta')}
                  </Button>
                </div>
              ) : (
                <div className="payment-methods">
                  {methods.map(method => (
                    <div className="card" key={method.id} style={{ gap: '6px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        <strong>{formatPaymentMethod(method, t)}</strong>
                        {method.isDefault ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              textTransform: 'uppercase',
                              color: '#0d6efd',
                              fontWeight: 600
                            }}
                          >
                            {t('dashboard.payments.methods.defaultBadge')}
                          </span>
                        ) : null}
                      </div>
                      <span>
                        {t('dashboard.payments.methods.typeLabel')} {formatPaymentMethod({ ...method, label: undefined }, t)}
                      </span>
                      {method.holderName ? (
                        <span>
                          {t('dashboard.payments.methods.holderLabel')} {method.holderName}
                        </span>
                      ) : null}
                      {method.mandateReference ? (
                        <span>
                          {t('dashboard.payments.methods.mandateLabel')}{' '}
                          <strong>{method.mandateReference}</strong>
                        </span>
                      ) : null}
                      <div>{renderVerificationStatus(method)}</div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '12px',
                          marginTop: '12px'
                        }}
                      >
                        <Button variant="ghost" onClick={() => handleOpenModal(method)}>
                          {t('dashboard.payments.methods.edit')}
                        </Button>
                        {!method.isDefault ? (
                          <Button
                            variant="ghost"
                            onClick={() => handleSetDefaultMethod(method)}
                            disabled={updatingMethodId === method.id}
                          >
                            {updatingMethodId === method.id
                              ? t('dashboard.payments.methods.settingDefault')
                              : t('dashboard.payments.methods.setDefault')}
                          </Button>
                        ) : null}
                        {method.type === 'card' ? (
                          <Button variant="ghost" onClick={() => handleOpenVerification(method)}>
                            {method.verificationStatus === 'verified'
                              ? t('dashboard.payments.verification.review')
                              : t('dashboard.payments.verification.verify')}
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteMethod(method.id)}
                          disabled={
                            deletingId === method.id || updatingMethodId === method.id
                          }
                        >
                          {deletingId === method.id
                            ? t('dashboard.payments.methods.deleting')
                            : t('dashboard.payments.methods.delete')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>


            <section className="dashboard-section">
              <h2>{t('dashboard.payments.history.title')}</h2>
              {invoices.length > 0 ? (
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.payments.history.columns.invoice')}</th>
                      <th>{t('dashboard.payments.history.columns.date')}</th>
                      <th>{t('dashboard.payments.history.columns.amount')}</th>
                      <th>{t('dashboard.payments.history.columns.method')}</th>
                      <th>{t('dashboard.payments.history.columns.description')}</th>
                      <th>{t('dashboard.payments.history.columns.status')}</th>
                      <th>{t('dashboard.payments.history.columns.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(invoice => (
                      <tr key={invoice.id}>
                        <td>{invoice.invoiceNumber ?? invoice.id}</td>
                        <td>{formatDate(invoice.created_at, numberLocale, t)}</td>
                        <td>{formatAmount(invoice.amount, invoice.currency, numberLocale)}</td>
                        <td>
                          {invoice.paymentMethod
                            ? formatPaymentMethod(invoice.paymentMethod, t)
                            : t('dashboard.payments.date.empty')}
                        </td>
                        <td>{invoice.description ?? t('dashboard.payments.date.empty')}</td>
                        <td>
                          <span className={`admin-status ${STATUS_BADGE[invoice.status]}`}>
                            {statusLabels[invoice.status] ?? invoice.status}
                          </span>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            onClick={() => handleDownloadInvoice(invoice.id)}
                            disabled={downloadingInvoiceId === invoice.id}
                          >
                            {downloadingInvoiceId === invoice.id
                              ? t('dashboard.payments.history.downloading')
                              : t('dashboard.payments.history.download')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="card" style={{ padding: '24px' }}>
                  <h3>{t('dashboard.payments.history.emptyTitle')}</h3>
                  <p>
                    {t('dashboard.payments.history.emptyDescription')}
                  </p>
                </div>
              )}
            </section>

            <section className="dashboard-section">
              <div className="dashboard-section__head">
                <h2>{t('dashboard.payments.subscription.title')}</h2>
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isRefreshing || isFinalizingSession}
                >
                  {isRefreshing ? t('dashboard.payments.refreshing') : t('dashboard.payments.refresh')}
                </Button>
              </div>

              {subscriptions.length === 0 ? (
                <div className="card" style={{ padding: '24px' }}>
                  <h3>{t('dashboard.payments.subscription.emptyTitle')}</h3>
                  <p>
                    {t('dashboard.payments.subscription.emptyDescription')}
                  </p>
                </div>
              ) : (
                <div className="payment-methods">
                  {subscriptions.map(subscription => {
                    const hasReminder = Boolean(reminderRequests[subscription.id])
                    const renewalSoon = isRenewalSoon(subscription.nextRenewalAt)
                    return (
                      <div className="card" key={subscription.id} style={{ gap: '8px' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <strong>{subscription.planName}</strong>
                          <span className={`admin-status ${SUBSCRIPTION_BADGE[subscription.status]}`}>
                            {subscriptionStatusLabels[subscription.status]}
                          </span>
                        </div>
                        <span>
                          {t('dashboard.payments.subscription.amountLabel')}{' '}
                          {formatAmount(subscription.amount, subscription.currency, numberLocale)}
                        </span>
                        <span>
                          {t('dashboard.payments.subscription.autoRenewLabel')}{' '}
                          {subscription.autoRenew
                            ? t('dashboard.payments.subscription.autoRenewOn')
                            : t('dashboard.payments.subscription.autoRenewOff')}
                        </span>
                        <span>
                          {t('dashboard.payments.subscription.nextRenewalLabel')}{' '}
                          {subscription.nextRenewalAt
                            ? `${formatDate(subscription.nextRenewalAt, numberLocale, t)}${
                                renewalSoon ? ` • ${t('dashboard.payments.subscription.renewalSoon')}` : ''
                              }`
                            : t('dashboard.payments.date.empty')}
                        </span>
                        {subscription.paymentMethod ? (
                          <span>
                            {t('dashboard.payments.subscription.chargedOn')}{' '}
                            {formatPaymentMethod(subscription.paymentMethod, t)}
                          </span>
                        ) : null}
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px',
                            marginTop: '12px'
                          }}
                        >
                          {subscription.autoRenew ? (
                            <Button
                              variant="ghost"
                              onClick={() => handleCancelSubscription(subscription)}
                              disabled={updatingSubscriptionId === subscription.id}
                            >
                              {updatingSubscriptionId === subscription.id
                                ? t('dashboard.payments.subscription.canceling')
                                : t('dashboard.payments.subscription.cancel')}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              onClick={() => handleResumeSubscription(subscription)}
                              disabled={updatingSubscriptionId === subscription.id}
                            >
                              {updatingSubscriptionId === subscription.id
                                ? t('dashboard.payments.subscription.resuming')
                                : t('dashboard.payments.subscription.resume')}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            onClick={() => handleScheduleReminder(subscription)}
                            disabled={hasReminder}
                          >
                            {hasReminder
                              ? t('dashboard.payments.subscription.reminderSet')
                              : t('dashboard.payments.subscription.reminder')}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <PaymentMethodModal
          key={editingMethod?.id ?? 'new'}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleSaveMethod}
          method={editingMethod}
        />

        <Modal
          open={isVerificationModalOpen}
          onClose={handleCloseVerification}
          title={t('dashboard.payments.verification.modalTitle')}
          description={
            verifyingMethod
              ? t('dashboard.payments.verification.modalDescription', {
                  method: formatPaymentMethod(verifyingMethod, t)
                })
              : undefined
          }
        >
          {verificationStep === 'prompt' ? (
            <>
              <p>
                {t('dashboard.payments.verification.prompt')}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button
                  onClick={handleBeginVerification}
                  disabled={isVerificationLoading}
                >
                  {isVerificationLoading
                    ? t('dashboard.payments.verification.opening')
                    : t('dashboard.payments.verification.start')}
                </Button>
                <Button variant="ghost" onClick={handleCloseVerification} disabled={isVerificationLoading}>
                  {t('dashboard.payments.verification.close')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>
                {t('dashboard.payments.verification.confirmPrompt')}
              </p>
              {verificationRedirectUrl ? (
                <Button
                  variant="ghost"
                  onClick={() => window.open(verificationRedirectUrl, '_blank', 'noopener')}
                  style={{ marginBottom: '12px' }}
                >
                  {t('dashboard.payments.verification.reopen')}
                </Button>
              ) : null}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button
                  onClick={() => handleCompleteVerification(true)}
                  disabled={isVerificationLoading}
                >
                  {isVerificationLoading
                    ? t('dashboard.payments.verification.confirming')
                    : t('dashboard.payments.verification.markVerified')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleCompleteVerification(false)}
                  disabled={isVerificationLoading}
                >
                  {t('dashboard.payments.verification.reportFailure')}
                </Button>
              </div>
            </>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  )
}
