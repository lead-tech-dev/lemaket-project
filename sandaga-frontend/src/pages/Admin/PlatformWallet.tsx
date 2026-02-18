import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { apiGet } from '../../utils/api'

type WalletSummary = {
  userId: string
  email: string
  balance: number
  currency: string
}

type WalletTransaction = {
  id: string
  type: string
  amount: string
  currency: string
  status: 'completed' | 'pending' | 'failed'
  created_at: string
}

type WalletTransactionsResponse = {
  items: WalletTransaction[]
  total: number
}

export default function PlatformWallet() {
  const { addToast } = useToast()
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(true)
  const [txLoadingMore, setTxLoadingMore] = useState(false)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [transactionsTotal, setTransactionsTotal] = useState(0)
  const [filterType, setFilterType] = useState<
    'all' | 'topup' | 'withdrawal' | 'release' | 'adjustment' | 'refund'
  >('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'failed'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadSummary = useCallback(() => {
    setLoading(true)
    apiGet<WalletSummary>('/admin/platform-wallet')
      .then(setSummary)
      .catch(err => {
        console.error('Unable to load platform wallet', err)
        addToast({
          variant: 'error',
          title: 'Wallet plateforme',
          message: 'Impossible de charger le wallet plateforme.'
        })
      })
      .finally(() => setLoading(false))
  }, [addToast])

  const loadTransactions = useCallback(
    (mode: 'reset' | 'more' = 'reset') => {
      const limit = 20
      const offset = mode === 'more' ? transactions.length : 0
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset)
      })
      if (filterType !== 'all') params.set('type', filterType)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (mode === 'reset') {
        setTxLoading(true)
      } else {
        setTxLoadingMore(true)
      }
      apiGet<WalletTransactionsResponse>(`/admin/platform-wallet/transactions?${params.toString()}`)
        .then(data => {
          if (mode === 'reset') {
            setTransactions(data.items ?? [])
          } else {
            setTransactions(prev => [...prev, ...(data.items ?? [])])
          }
          setTransactionsTotal(data.total ?? 0)
        })
        .catch(err => {
          console.error('Unable to load platform wallet transactions', err)
          addToast({
            variant: 'error',
            title: 'Wallet plateforme',
            message: 'Impossible de charger les transactions.'
          })
        })
        .finally(() => {
          setTxLoading(false)
          setTxLoadingMore(false)
        })
    },
    [addToast, filterType, filterStatus, dateFrom, dateTo, transactions.length]
  )

  useEffect(() => {
    loadSummary()
    loadTransactions('reset')
  }, [loadSummary, loadTransactions])

  useEffect(() => {
    loadTransactions('reset')
  }, [filterType, filterStatus, dateFrom, dateTo, loadTransactions])

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('type', filterType)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      const csv = await apiGet<string>(
        `/admin/platform-wallet/transactions/export?${params.toString()}`
      )
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'platform-wallet-transactions.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Platform wallet export failed', err)
      addToast({
        variant: 'error',
        title: 'Wallet plateforme',
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

  const typeLabels: Record<string, string> = useMemo(
    () => ({
      topup: 'Recharge',
      hold: 'Réservation',
      release: 'Versement',
      refund: 'Remboursement',
      withdrawal: 'Retrait',
      adjustment: 'Commission'
    }),
    []
  )

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="admin-header">
          <div>
            <h1>Wallet plateforme</h1>
            <p>Suivi des commissions et flux financiers de la plateforme.</p>
          </div>
          <Button variant="outline" onClick={loadSummary} disabled={loading}>
            Actualiser
          </Button>
        </header>

        <section className="admin-section">
          <div className="card" style={{ padding: '20px', maxWidth: '520px' }}>
            <h3 style={{ marginTop: 0 }}>Solde actuel</h3>
            {loading ? (
              <p>Chargement...</p>
            ) : summary ? (
              <>
                <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
                  {formatMoney(summary.balance, summary.currency)}
                </p>
                <p style={{ marginTop: '6px', color: '#64748b' }}>
                  Compte: {summary.email}
                </p>
              </>
            ) : (
              <p>—</p>
            )}
          </div>
        </section>

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
              <h3 style={{ marginTop: 0 }}>Historique des transactions</h3>
              <Button variant="outline" onClick={handleExport}>
                Export CSV
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Button
                type="button"
                variant={filterType === 'all' ? 'primary' : 'outline'}
                onClick={() => setFilterType('all')}
              >
                Toutes
              </Button>
              <Button
                type="button"
                variant={filterType === 'release' ? 'primary' : 'outline'}
                onClick={() => setFilterType('release')}
              >
                Versements
              </Button>
              <Button
                type="button"
                variant={filterType === 'adjustment' ? 'primary' : 'outline'}
                onClick={() => setFilterType('adjustment')}
              >
                Commissions
              </Button>
              <Button
                type="button"
                variant={filterType === 'refund' ? 'primary' : 'outline'}
                onClick={() => setFilterType('refund')}
              >
                Remboursements
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Button
                type="button"
                variant={filterStatus === 'all' ? 'primary' : 'outline'}
                onClick={() => setFilterStatus('all')}
              >
                Tous statuts
              </Button>
              <Button
                type="button"
                variant={filterStatus === 'completed' ? 'primary' : 'outline'}
                onClick={() => setFilterStatus('completed')}
              >
                Confirmés
              </Button>
              <Button
                type="button"
                variant={filterStatus === 'pending' ? 'primary' : 'outline'}
                onClick={() => setFilterStatus('pending')}
              >
                En attente
              </Button>
              <Button
                type="button"
                variant={filterStatus === 'failed' ? 'primary' : 'outline'}
                onClick={() => setFilterStatus('failed')}
              >
                Échecs
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <FormField label="Du" htmlFor="platform-wallet-date-from">
                <Input
                  id="platform-wallet-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={event => setDateFrom(event.target.value)}
                />
              </FormField>
              <FormField label="Au" htmlFor="platform-wallet-date-to">
                <Input
                  id="platform-wallet-date-to"
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
                        {typeLabels[tx.type] ?? tx.type}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {formatDate(tx.created_at)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>
                        {formatMoney(Number(tx.amount), tx.currency)}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {tx.status === 'completed'
                          ? 'Confirmé'
                          : tx.status === 'pending'
                            ? 'En attente'
                            : 'Échec'}
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
