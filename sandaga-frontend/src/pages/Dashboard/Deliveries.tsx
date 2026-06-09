import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { apiGet, apiPatch, apiPost } from '../../utils/api'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import type { Delivery, DeliveryStatus } from '../../types/deliveries'

function formatName(user?: { firstName: string; lastName: string } | null) {
  if (!user) return '—'
  return `${user.firstName} ${user.lastName}`.trim()
}

export default function Deliveries() {
  const { user } = useAuth()
  const { addToast } = useToast()
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
        title: 'Livraisons',
        message: "Impossible de charger les livraisons."
      })
    } finally {
      setLoading(false)
    }
  }, [addToast, loadAvailable, loadMine])

  useEffect(() => {
    refresh()
  }, [refresh])

  const runAction = useCallback(
    async (action: () => Promise<void>, errorMessage: string) => {
      try {
        await action()
      } catch (err) {
        console.error('Delivery action failed', err)
        addToast({ variant: 'error', title: 'Livraisons', message: errorMessage })
      }
    },
    [addToast]
  )

  const handleAccept = (id: string) =>
    runAction(async () => {
      await apiPost(`/deliveries/${id}/accept`)
      await refresh()
    }, "Impossible d'accepter la course.")

  const handleStatusUpdate = (id: string, status: DeliveryStatus) =>
    runAction(async () => {
      await apiPatch(`/deliveries/${id}/status`, { status })
      await refresh()
    }, 'Impossible de mettre à jour le statut.')

  const handleGetPickupCode = (id: string) =>
    runAction(async () => {
      const response = await apiGet<{ code: string }>(`/deliveries/${id}/pickup/code`)
      setPickupCodes(prev => ({ ...prev, [id]: response.code }))
    }, 'Impossible de récupérer le code de remise.')

  const handleConfirmPickup = (id: string) => {
    const code = window.prompt('Entrez le code de remise fourni par le vendeur')
    if (!code) return
    return runAction(async () => {
      await apiPost(`/deliveries/${id}/pickup/confirm`, { code: code.trim() })
      await refresh()
    }, 'Code de remise invalide ou confirmation impossible.')
  }

  const handleGetDeliveryCode = (id: string) =>
    runAction(async () => {
      await apiGet<{ sent: boolean }>(`/deliveries/${id}/delivery/code`)
      addToast({
        variant: 'success',
        title: 'Code envoyé',
        message: 'Le code de réception a été envoyé par SMS.'
      })
    }, "Impossible d'envoyer le code de réception.")

  const handleConfirmDelivery = (id: string) => {
    const code = window.prompt('Entrez le code de réception fourni par l’acheteur')
    if (!code) return
    return runAction(async () => {
      await apiPost(`/deliveries/${id}/delivery/confirm`, { code: code.trim() })
      await refresh()
    }, 'Code de réception invalide ou confirmation impossible.')
  }

  const handleRelease = (id: string) =>
    runAction(async () => {
      await apiPost(`/deliveries/${id}/escrow/release`)
      await refresh()
      addToast({
        variant: 'success',
        title: 'Paiement libéré',
        message: 'Les fonds ont été libérés au vendeur.'
      })
    }, 'Impossible de libérer le paiement sécurisé.')

  const deliveriesToShow = useMemo(
    () => (activeTab === 'mine' ? mine : available),
    [activeTab, available, mine]
  )

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>Livraisons</h1>
            <p>Gérez vos demandes et courses en cours.</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? 'Actualisation...' : 'Rafraîchir'}
          </Button>
        </header>

        <div className="card" style={{ padding: '16px' }}>
          <div className="dashboard-tabs">
            <button
              type="button"
              className={`dashboard-tab ${activeTab === 'mine' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('mine')}
            >
              Mes livraisons
            </button>
            <button
              type="button"
              className={`dashboard-tab ${activeTab === 'available' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('available')}
              disabled={!isCourier}
            >
              Courses disponibles
            </button>
          </div>

          {!isCourier && activeTab === 'available' ? (
            <p style={{ marginTop: '16px', color: '#6b7280' }}>
              {isCourierEnabled
                ? 'Votre profil livreur doit être validé pour accéder aux courses.'
                : 'Active le mode livreur dans tes paramètres pour voir les courses.'}
            </p>
          ) : null}
        </div>

        {loading ? (
          <p style={{ color: '#6b7280' }}>Chargement...</p>
        ) : deliveriesToShow.length ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {deliveriesToShow.map(delivery => (
              <div key={delivery.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{delivery.listing.title}</h3>
                    <p style={{ margin: '6px 0', color: '#6b7280' }}>
                      {delivery.pickupAddress ?? 'Adresse de départ non définie'}
                      {' → '}
                      {delivery.dropoffAddress ?? 'Adresse d’arrivée non définie'}
                    </p>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                      Acheteur: {formatName(delivery.buyer)} · Vendeur: {formatName(delivery.seller)}
                    </p>
                    {typeof delivery.distanceKm === 'number' ? (
                      <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
                        Distance: {delivery.distanceKm.toFixed(1)} km
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
                        Escrow: {delivery.escrowStatus}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {activeTab === 'available' ? (
                    <Button onClick={() => handleAccept(delivery.id)}>Accepter la course</Button>
                  ) : null}
                  {delivery.buyer?.id === user?.id &&
                  delivery.escrowStatus === 'held' &&
                  (delivery.status === 'delivered' || delivery.handoverMode === 'pickup') ? (
                    <Button variant="outline" onClick={() => handleRelease(delivery.id)}>
                      Confirmer la réception
                    </Button>
                  ) : null}
                  {delivery.courier?.id === user?.id &&
                  delivery.status === 'accepted' &&
                  delivery.escrowStatus === 'held' ? (
                    <Button variant="outline" onClick={() => handleConfirmPickup(delivery.id)}>
                      Confirmer le code de remise
                    </Button>
                  ) : null}
                  {delivery.courier?.id === user?.id &&
                  delivery.status === 'accepted' &&
                  delivery.escrowStatus !== 'held' ? (
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      Paiement sécurisé en attente
                    </span>
                  ) : null}
                  {delivery.courier?.id === user?.id && delivery.status === 'picked_up' ? (
                    <Button variant="outline" onClick={() => handleConfirmDelivery(delivery.id)}>
                      Confirmer la livraison
                    </Button>
                  ) : null}
                  {delivery.seller?.id === user?.id &&
                  delivery.status === 'accepted' ? (
                    <Button variant="outline" onClick={() => handleGetPickupCode(delivery.id)}>
                      Remettre le colis
                    </Button>
                  ) : null}
                  {delivery.buyer?.id === user?.id &&
                  delivery.status === 'picked_up' ? (
                    <Button variant="outline" onClick={() => handleGetDeliveryCode(delivery.id)}>
                      Renvoyer le code par SMS
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
                    Code de remise : <strong>{pickupCodes[delivery.id]}</strong>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6b7280' }}>Aucune livraison pour le moment.</p>
        )}
      </div>
    </DashboardLayout>
  )
}
