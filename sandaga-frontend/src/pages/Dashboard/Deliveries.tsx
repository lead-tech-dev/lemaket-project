import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { apiGet, apiPatch, apiPost } from '../../utils/api'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import type { Delivery, DeliveryStatus } from '../../types/deliveries'

function formatName(user?: { firstName: string; lastName: string } | null) {
  if (!user) return '—'
  return `${user.firstName} ${user.lastName}`.trim()
}

export default function Deliveries() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const { t } = useI18n()
  const [mine, setMine] = useState<Delivery[]>([])
  const [available, setAvailable] = useState<Delivery[]>([])
  const [activeTab, setActiveTab] = useState<'mine' | 'available'>('mine')
  const [loading, setLoading] = useState(false)
  const [pickupCodes, setPickupCodes] = useState<Record<string, string>>({})

  const isCourierEnabled = Boolean((user?.settings as Record<string, unknown> | undefined)?.isCourier)
  const isCourierApproved = user?.courierVerificationStatus === 'approved'
  const isCourier = isCourierEnabled && isCourierApproved

  const loadMine = useCallback(async () => {
    const response = await apiGet<Delivery[]>('/deliveries/mine')
    setMine(response)
  }, [])

  const loadAvailable = useCallback(async () => {
    if (!isCourier) {
      setAvailable([])
      return
    }
    const response = await apiGet<Delivery[]>('/deliveries/available')
    setAvailable(response)
  }, [isCourier])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadMine(), loadAvailable()])
    } catch (err) {
      console.error('Unable to load deliveries', err)
      addToast({
        variant: 'error',
        title: t('dashboard.deliveries.toasts.title'),
        message: t('dashboard.deliveries.toasts.loadError')
      })
    } finally {
      setLoading(false)
    }
  }, [addToast, loadAvailable, loadMine, t])

  useEffect(() => {
    refresh()
  }, [refresh])

  const runAction = useCallback(
    async (action: () => Promise<void>, errorMessage: string) => {
      try {
        await action()
      } catch (err) {
        console.error('Delivery action failed', err)
        addToast({ variant: 'error', title: t('dashboard.deliveries.toasts.title'), message: errorMessage })
      }
    },
    [addToast, t]
  )

  const handleAccept = (id: string) =>
    runAction(async () => {
      await apiPost(`/deliveries/${id}/accept`)
      await refresh()
    }, t('dashboard.deliveries.toasts.acceptError'))

  const handleStatusUpdate = (id: string, status: DeliveryStatus) =>
    runAction(async () => {
      await apiPatch(`/deliveries/${id}/status`, { status })
      await refresh()
    }, t('dashboard.deliveries.toasts.statusError'))

  const handleGetPickupCode = (id: string) =>
    runAction(async () => {
      const response = await apiGet<{ code: string }>(`/deliveries/${id}/pickup/code`)
      setPickupCodes(prev => ({ ...prev, [id]: response.code }))
    }, t('dashboard.deliveries.toasts.pickupCodeError'))

  const handleConfirmPickup = (id: string) => {
    const code = window.prompt(t('dashboard.deliveries.prompt.pickupCode'))
    if (!code) return
    return runAction(async () => {
      await apiPost(`/deliveries/${id}/pickup/confirm`, { code: code.trim() })
      await refresh()
    }, t('dashboard.deliveries.toasts.confirmPickupError'))
  }

  const handleGetDeliveryCode = (id: string) =>
    runAction(async () => {
      await apiGet<{ sent: boolean }>(`/deliveries/${id}/delivery/code`)
      addToast({
        variant: 'success',
        title: t('dashboard.deliveries.toasts.deliveryCodeSentTitle'),
        message: t('dashboard.deliveries.toasts.deliveryCodeSentMessage')
      })
    }, t('dashboard.deliveries.toasts.deliveryCodeError'))

  const handleConfirmDelivery = (id: string) => {
    const code = window.prompt(t('dashboard.deliveries.prompt.deliveryCode'))
    if (!code) return
    return runAction(async () => {
      await apiPost(`/deliveries/${id}/delivery/confirm`, { code: code.trim() })
      await refresh()
    }, t('dashboard.deliveries.toasts.confirmDeliveryError'))
  }

  const handleRelease = (id: string) =>
    runAction(async () => {
      await apiPost(`/deliveries/${id}/escrow/release`)
      await refresh()
      addToast({
        variant: 'success',
        title: t('dashboard.deliveries.toasts.releaseTitle'),
        message: t('dashboard.deliveries.toasts.releaseMessage')
      })
    }, t('dashboard.deliveries.toasts.releaseError'))

  const deliveriesToShow = useMemo(
    () => (activeTab === 'mine' ? mine : available),
    [activeTab, available, mine]
  )

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('dashboard.deliveries.title')}</h1>
            <p>{t('dashboard.deliveries.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? t('dashboard.deliveries.refreshing') : t('dashboard.deliveries.refresh')}
          </Button>
        </header>

        <div className="card" style={{ padding: '16px' }}>
          <div className="dashboard-tabs">
            <button
              type="button"
              className={`dashboard-tab ${activeTab === 'mine' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('mine')}
            >
              {t('dashboard.deliveries.tabs.mine')}
            </button>
            <button
              type="button"
              className={`dashboard-tab ${activeTab === 'available' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('available')}
              disabled={!isCourier}
            >
              {t('dashboard.deliveries.tabs.available')}
            </button>
          </div>

          {!isCourier && activeTab === 'available' ? (
            <p style={{ marginTop: '16px', color: '#6b7280' }}>
              {isCourierEnabled
                ? t('dashboard.deliveries.courierPendingValidation')
                : t('dashboard.deliveries.courierNotEnabled')}
            </p>
          ) : null}
        </div>

        {loading ? (
          <p style={{ color: '#6b7280' }}>{t('dashboard.deliveries.loading')}</p>
        ) : deliveriesToShow.length ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {deliveriesToShow.map(delivery => (
              <div key={delivery.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{delivery.listing.title}</h3>
                    <p style={{ margin: '6px 0', color: '#6b7280' }}>
                      {delivery.pickupAddress ?? t('dashboard.deliveries.pickupAddressFallback')}
                      {' → '}
                      {delivery.dropoffAddress ?? t('dashboard.deliveries.dropoffAddressFallback')}
                    </p>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                      {t('dashboard.deliveries.parties', {
                        buyer: formatName(delivery.buyer),
                        seller: formatName(delivery.seller)
                      })}
                    </p>
                    {typeof delivery.distanceKm === 'number' ? (
                      <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
                        {t('dashboard.deliveries.distance', { distance: delivery.distanceKm.toFixed(1) })}
                      </p>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{delivery.status}</div>
                    {delivery.price ? (
                      <div style={{ color: '#0f172a' }}>
                        {Number(delivery.price).toLocaleString('fr-FR')} {delivery.currency}
                      </div>
                    ) : null}
                    {delivery.escrowStatus && delivery.escrowStatus !== 'none' ? (
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                        {t('dashboard.deliveries.escrow', { status: delivery.escrowStatus })}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {activeTab === 'available' ? (
                    <Button onClick={() => handleAccept(delivery.id)}>{t('dashboard.deliveries.actions.accept')}</Button>
                  ) : null}
                  {delivery.buyer?.id === user?.id &&
                  delivery.escrowStatus === 'held' &&
                  (delivery.status === 'delivered' || delivery.handoverMode === 'pickup') ? (
                    <Button variant="outline" onClick={() => handleRelease(delivery.id)}>
                      {t('dashboard.deliveries.actions.confirmReceipt')}
                    </Button>
                  ) : null}
                  {delivery.courier?.id === user?.id &&
                  delivery.status === 'accepted' &&
                  delivery.escrowStatus === 'held' ? (
                    <Button variant="outline" onClick={() => handleConfirmPickup(delivery.id)}>
                      {t('dashboard.deliveries.actions.confirmPickupCode')}
                    </Button>
                  ) : null}
                  {delivery.courier?.id === user?.id &&
                  delivery.status === 'accepted' &&
                  delivery.escrowStatus !== 'held' ? (
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      {t('dashboard.deliveries.escrowPending')}
                    </span>
                  ) : null}
                  {delivery.courier?.id === user?.id && delivery.status === 'picked_up' ? (
                    <Button variant="outline" onClick={() => handleConfirmDelivery(delivery.id)}>
                      {t('dashboard.deliveries.actions.confirmDelivery')}
                    </Button>
                  ) : null}
                  {delivery.seller?.id === user?.id &&
                  delivery.status === 'accepted' ? (
                    <Button variant="outline" onClick={() => handleGetPickupCode(delivery.id)}>
                      {t('dashboard.deliveries.actions.handoverParcel')}
                    </Button>
                  ) : null}
                  {delivery.buyer?.id === user?.id &&
                  delivery.status === 'picked_up' ? (
                    <Button variant="outline" onClick={() => handleGetDeliveryCode(delivery.id)}>
                      {t('dashboard.deliveries.actions.resendCode')}
                    </Button>
                  ) : null}
                </div>
                {pickupCodes[delivery.id] ? (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      border: '1px solid rgba(148,163,184,0.3)',
                      display: 'inline-block'
                    }}
                  >
                    {t('dashboard.deliveries.pickupCodeLabel')} <strong>{pickupCodes[delivery.id]}</strong>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6b7280' }}>{t('dashboard.deliveries.empty')}</p>
        )}
      </div>
    </DashboardLayout>
  )
}
