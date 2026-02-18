import { useEffect, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import { apiGet } from '../../utils/api'
import type { Order } from '../../types/order'
import { useToast } from '../../components/ui/Toast'

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de paiement',
  paid: 'Payée',
  paid_waiting_delivery: 'Payée (en attente de livraison)',
  courier_assigned: 'Livreur assigné',
  picked_up: 'Colis récupéré',
  in_transit: 'En transit',
  delivered: 'Livrée',
  completed: 'Terminée',
  cancelled: 'Annulée'
}

export default function Orders() {
  const { addToast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    apiGet<Order[]>('/orders/mine')
      .then(data => {
        if (!active) return
        setOrders(data ?? [])
      })
      .catch(err => {
        console.error('Unable to load orders', err)
        addToast({
          variant: 'error',
          title: 'Commandes',
          message: "Impossible de charger vos commandes."
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [addToast])

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>Commandes</h1>
            <p>Suivez vos achats et ventes sécurisées.</p>
          </div>
        </header>

        {loading ? (
          <p style={{ color: '#6b7280' }}>Chargement...</p>
        ) : orders.length ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {orders.map(order => (
              <div key={order.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{order.listing?.title ?? 'Annonce'}</h3>
                    <p style={{ margin: '6px 0', color: '#64748b' }}>
                      Mode: {order.handoverMode === 'delivery' ? 'Livraison' : 'Remise en main propre'}
                    </p>
                    <p style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>
                      Total: {Number(order.totalAmount).toLocaleString('fr-FR')} {order.currency}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <p style={{ marginTop: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>
                      {new Date(order.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6b7280' }}>Aucune commande pour le moment.</p>
        )}
      </div>
    </DashboardLayout>
  )
}
