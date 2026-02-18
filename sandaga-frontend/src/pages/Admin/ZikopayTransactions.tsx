import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { apiGet } from '../../utils/api'

type ZikopayTransaction = {
  id: string
  amount: string
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  description?: string | null
  reference?: string | null
  method?: string | null
  customerEmail?: string | null
  customerName?: string | null
  created_at: string
}

type ZikopayTransactionsResponse = {
  items: ZikopayTransaction[]
  total: number
}

export default function ZikopayTransactions() {
  const { addToast } = useToast()
  const [transactions, setTransactions] = useState<ZikopayTransaction[]>([])
  const [transactionsTotal, setTransactionsTotal] = useState(0)
  const [txLoading, setTxLoading] = useState(true)
  const [txLoadingMore, setTxLoadingMore] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed' | 'refunded'>('all')
  const [methodFilter, setMethodFilter] = useState<'all' | 'card' | 'mobile_money'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')

  const loadTransactions = useCallback(
    (mode: 'reset' | 'more' = 'reset') => {
      const limit = 20
      const offset = mode === 'more' ? transactions.length : 0
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset)
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (methodFilter !== 'all') params.set('method', methodFilter)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (search.trim()) params.set('search', search.trim())
      if (mode === 'reset') {
        setTxLoading(true)
      } else {
        setTxLoadingMore(true)
      }
      apiGet<ZikopayTransactionsResponse>(`/admin/zikopay/transactions?${params.toString()}`)
        .then(data => {
          if (mode === 'reset') {
            setTransactions(data.items ?? [])
          } else {
            setTransactions(prev => [...prev, ...(data.items ?? [])])
          }
          setTransactionsTotal(data.total ?? 0)
        })
        .catch(err => {
          console.error('Unable to load Zikopay transactions', err)
          addToast({
            variant: 'error',
            title: 'Transactions Zikopay',
            message: 'Impossible de charger les transactions.'
          })
        })
        .finally(() => {
          setTxLoading(false)
          setTxLoadingMore(false)
        })
    },
    [addToast, dateFrom, dateTo, methodFilter, search, statusFilter, transactions.length]
  )

  useEffect(() => {
    loadTransactions('reset')
  }, [loadTransactions])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadTransactions('reset')
    }, 300)
    return () => window.clearTimeout(timer)
  }, [statusFilter, methodFilter, dateFrom, dateTo, search, loadTransactions])

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (methodFilter !== 'all') params.set('method', methodFilter)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (search.trim()) params.set('search', search.trim())
      const csv = await apiGet<string>(`/admin/zikopay/transactions/export?${params.toString()}`)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'zikopay-transactions.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Zikopay export failed', err)
      addToast({
        variant: 'error',
        title: 'Transactions Zikopay',
        message: 'Impossible de télécharger le CSV.'
      })
    }
  }

  const formatMoney = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount)
    } catch {
      return `${amount.toLocaleString('fr-FR')} ${currency}`
    }
  }

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(value))
    } catch {
      return value
    }
  }

  const statusLabel = (status: ZikopayTransaction['status']) => {
    if (status === 'completed') return 'Confirmé'
    if (status === 'pending') return 'En attente'
    if (status === 'failed') return 'Échec'
    if (status === 'refunded') return 'Remboursé'
    return status
  }

  const statusStyle = (status: ZikopayTransaction['status']) => {
    if (status === 'completed') return { background: '#dcfce7', color: '#166534' }
    if (status === 'pending') return { background: '#fef9c3', color: '#854d0e' }
    if (status === 'failed') return { background: '#fee2e2', color: '#991b1b' }
    if (status === 'refunded') return { background: '#e0e7ff', color: '#3730a3' }
    return { background: '#e2e8f0', color: '#334155' }
  }

  const methodLabel = (method?: string | null) => {
    if (!method) return '—'
    const normalized = method.toLowerCase()
    if (normalized.startsWith('mobile_money')) {
      const parts = normalized.split(':')
      const operator = parts[1]
      if (operator) {
        const operatorLabel =
          operator.includes('orange') ? 'Orange' : operator.includes('mtn') ? 'MTN' : operator
        return `Mobile Money (${operatorLabel})`
      }
      return 'Mobile Money'
    }
    if (normalized.includes('card')) return 'Carte bancaire'
    return method
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="admin-header">
          <div>
            <h1>Transactions Zikopay</h1>
            <p>Suivi des paiements sécurisés et Mobile Money via Zikopay.</p>
          </div>
          <Button variant="outline" onClick={() => loadTransactions('reset')} disabled={txLoading}>
            Actualiser
          </Button>
        </header>

        <section className="admin-section">
          <div className="card" style={{ padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <h3 style={{ marginTop: 0 }}>Historique</h3>
              <Button variant="outline" onClick={handleExport}>
                Export CSV
              </Button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Button
                type="button"
                variant={statusFilter === 'all' ? 'primary' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                Tous statuts
              </Button>
              <Button
                type="button"
                variant={statusFilter === 'completed' ? 'primary' : 'outline'}
                onClick={() => setStatusFilter('completed')}
              >
                Confirmés
              </Button>
              <Button
                type="button"
                variant={statusFilter === 'pending' ? 'primary' : 'outline'}
                onClick={() => setStatusFilter('pending')}
              >
                En attente
              </Button>
              <Button
                type="button"
                variant={statusFilter === 'failed' ? 'primary' : 'outline'}
                onClick={() => setStatusFilter('failed')}
              >
                Échecs
              </Button>
              <Button
                type="button"
                variant={statusFilter === 'refunded' ? 'primary' : 'outline'}
                onClick={() => setStatusFilter('refunded')}
              >
                Remboursés
              </Button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Button
                type="button"
                variant={methodFilter === 'all' ? 'primary' : 'outline'}
                onClick={() => setMethodFilter('all')}
              >
                Toutes méthodes
              </Button>
              <Button
                type="button"
                variant={methodFilter === 'card' ? 'primary' : 'outline'}
                onClick={() => setMethodFilter('card')}
              >
                Carte bancaire
              </Button>
              <Button
                type="button"
                variant={methodFilter === 'mobile_money' ? 'primary' : 'outline'}
                onClick={() => setMethodFilter('mobile_money')}
              >
                Mobile Money
              </Button>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <FormField label="Recherche" htmlFor="zikopay-search">
                <Input
                  id="zikopay-search"
                  placeholder="Email ou référence"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </FormField>
              <FormField label="Du" htmlFor="zikopay-date-from">
                <Input
                  id="zikopay-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={event => setDateFrom(event.target.value)}
                />
              </FormField>
              <FormField label="Au" htmlFor="zikopay-date-to">
                <Input
                  id="zikopay-date-to"
                  type="date"
                  value={dateTo}
                  onChange={event => setDateTo(event.target.value)}
                />
              </FormField>
            </div>

            {txLoading ? (
              <p>Chargement...</p>
            ) : transactions.length === 0 ? (
              <p>Aucune transaction pour le moment.</p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {transactions.map(tx => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 0',
                      borderBottom: '1px solid rgba(15,23,42,0.08)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {formatMoney(Number(tx.amount), tx.currency)}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Méthode: {methodLabel(tx.method)}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {tx.reference ? `Ref: ${tx.reference}` : 'Référence en attente'}
                      </div>
                      {tx.customerEmail ? (
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          {tx.customerName ? `${tx.customerName} · ` : ''}
                          {tx.customerEmail}
                        </div>
                      ) : null}
                      {tx.description ? (
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{tx.description}</div>
                      ) : null}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          ...statusStyle(tx.status)
                        }}
                      >
                        {statusLabel(tx.status)}
                      </span>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {formatDate(tx.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!txLoading && transactions.length < transactionsTotal && (
              <div style={{ marginTop: '12px' }}>
                <Button
                  variant="outline"
                  onClick={() => loadTransactions('more')}
                  disabled={txLoadingMore}
                >
                  {txLoadingMore ? 'Chargement...' : 'Charger plus'}
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
