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
          <p className="ui-feedback">Chargement...</p>
        ) : orders.length ? (
          <div className="orders-list">
            {orders.map(order => (
              <div key={order.id} className="card orders-item">
                <div className="orders-item__row">
                  <div className="orders-item__main">
                    <h3>{order.listing?.title ?? 'Annonce'}</h3>
                    <p className="orders-item__mode">
                      Mode: {order.handoverMode === 'delivery' ? 'Livraison' : 'Remise en main propre'}
                    </p>
                    <p className="orders-item__total">
                      Total: {Number(order.totalAmount).toLocaleString('fr-FR')} {order.currency}
                    </p>
                  </div>
                  <div className="orders-item__meta">
                    <span className="badge">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <p className="orders-item__date">
                      {new Date(order.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="ui-feedback">Aucune commande pour le moment.</p>
        )}
      </div>
    </DashboardLayout>
  )
}
