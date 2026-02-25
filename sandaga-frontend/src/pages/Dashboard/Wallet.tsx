import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import { apiGet, apiPost } from '../../utils/api'

type WalletSummary = {
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

function isValidCameroonMobileNumber(value: string) {
  const normalized = value.replace(/[\s().-]/g, '')
  return /^(\+237|237)?6\d{8}$/.test(normalized)
}

export default function Wallet() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(true)
  const [txLoadingMore, setTxLoadingMore] = useState(false)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [transactionsTotal, setTransactionsTotal] = useState(0)
  const [filterType, setFilterType] = useState<'all' | 'topup' | 'withdrawal' | 'release'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'failed'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [topupAmount, setTopupAmount] = useState('')
  const [topupMethod, setTopupMethod] = useState<'mobile_money' | 'card'>('mobile_money')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const payoutSettings = (user?.settings ?? {}) as Record<string, unknown>
  const payoutNetwork =
    typeof payoutSettings.payoutMobileNetwork === 'string'
      ? payoutSettings.payoutMobileNetwork.trim()
      : ''
  const payoutNumber =
    typeof payoutSettings.payoutMobileNumber === 'string'
      ? payoutSettings.payoutMobileNumber.trim()
      : ''
  const payoutConfigured = Boolean(
    payoutNetwork &&
      payoutNumber &&
      isValidCameroonMobileNumber(payoutNumber)
  )
  const withdrawAmountNumber = Number(withdrawAmount)
  const hasValidWithdrawAmount = Number.isFinite(withdrawAmountNumber) && withdrawAmountNumber > 0
  const currentBalance = Number(summary?.balance ?? 0)
  const hasBalance = currentBalance > 0
  const hasEnoughBalance = hasValidWithdrawAmount ? currentBalance >= withdrawAmountNumber : hasBalance

  const loadSummary = useCallback(() => {
    setLoading(true)
    apiGet<WalletSummary>('/payments/wallet')
      .then(data => setSummary(data))
      .catch(err => {
        console.error('Unable to load wallet', err)
        addToast({
          variant: 'error',
          title: 'Wallet',
          message: 'Impossible de charger votre solde.'
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
      apiGet<WalletTransactionsResponse>(`/payments/wallet/transactions?${params.toString()}`)
        .then(data => {
          if (mode === 'reset') {
            setTransactions(data.items ?? [])
          } else {
            setTransactions(prev => [...prev, ...(data.items ?? [])])
          }
          setTransactionsTotal(data.total ?? 0)
        })
      .catch(err => {
        console.error('Unable to load wallet transactions', err)
        addToast({
          variant: 'error',
          title: 'Wallet',
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
    loadTransactions()
  }, [loadSummary, loadTransactions])

  useEffect(() => {
    loadTransactions('reset')
  }, [filterType, filterStatus, dateFrom, dateTo, loadTransactions])

  const handleTopup = async () => {
    if (!topupAmount.trim()) return
    const amount = Number(topupAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast({ variant: 'error', title: 'Wallet', message: 'Montant invalide.' })
      return
    }
    setSubmitting(true)
    try {
      const response = await apiPost<{ paymentUrl?: string }>(
        '/payments/wallet/topup',
        {
          amount,
          currency: summary?.currency ?? 'XAF',
          paymentMethod: topupMethod
        }
      )
      if (response?.paymentUrl) {
        window.open(response.paymentUrl, '_blank', 'noopener,noreferrer')
      }
      addToast({
        variant: 'success',
        title: 'Wallet',
        message: 'Recharge initiée. Vous serez notifié après confirmation.'
      })
      setTopupAmount('')
      loadTransactions()
    } catch (err) {
      console.error('Wallet topup failed', err)
      addToast({
        variant: 'error',
        title: 'Wallet',
        message: 'Impossible de lancer la recharge.'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount.trim()) return
    const amount = Number(withdrawAmount)
    if (!payoutConfigured) {
      addToast({
        variant: 'info',
        title: 'Wallet',
        message: 'Configurez votre Mobile Money dans Paramètres avant de retirer.'
      })
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast({ variant: 'error', title: 'Wallet', message: 'Montant invalide.' })
      return
    }
    if (summary && amount > Number(summary.balance ?? 0)) {
      addToast({ variant: 'error', title: 'Wallet', message: 'Solde insuffisant pour ce retrait.' })
      return
    }
    setSubmitting(true)
    try {
      await apiPost('/payments/wallet/withdraw', {
        amount,
        currency: summary?.currency ?? 'XAF'
      })
      addToast({
        variant: 'success',
        title: 'Wallet',
        message: 'Retrait en cours. Vous recevrez une notification.'
      })
      setWithdrawAmount('')
      loadSummary()
      loadTransactions()
    } catch (err) {
      console.error('Wallet withdraw failed', err)
      addToast({
        variant: 'error',
        title: 'Wallet',
        message: 'Impossible de lancer le retrait.'
      })
    } finally {
      setSubmitting(false)
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

  const formatAmount = (amount: string, currency: string) => {
    const value = Number(amount)
    if (!Number.isFinite(value)) return `${amount} ${currency}`
    return formatMoney(value, currency)
  }

  const typeLabels: Record<string, string> = {
    topup: 'Recharge',
    hold: 'Réservation',
    release: 'Versement',
    refund: 'Remboursement',
    withdrawal: 'Retrait',
    adjustment: 'Ajustement'
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('type', filterType)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      const csv = await apiGet<string>(
        `/payments/wallet/transactions/export?${params.toString()}`
      )
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'wallet-transactions.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Wallet export failed', err)
      addToast({
        variant: 'error',
        title: 'Wallet',
        message: 'Impossible de télécharger le CSV.'
      })
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>Wallet</h1>
            <p>Rechargez et retirez vos gains en toute sécurité.</p>
          </div>
          <Button variant="outline" onClick={loadSummary} disabled={loading}>
            Actualiser
          </Button>
        </header>

        <section className="dashboard-section">
          <div className="card" style={{ padding: '20px', maxWidth: '520px' }}>
            <h3 style={{ marginTop: 0 }}>Solde actuel</h3>
            {loading ? (
              <p>Chargement...</p>
            ) : summary ? (
              <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
                {formatMoney(summary.balance, summary.currency)}
              </p>
            ) : (
              <p>—</p>
            )}
          </div>
        </section>

        <section className="dashboard-section">
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
                variant={filterType === 'topup' ? 'primary' : 'outline'}
                onClick={() => setFilterType('topup')}
              >
                Recharges
              </Button>
              <Button
                type="button"
                variant={filterType === 'withdrawal' ? 'primary' : 'outline'}
                onClick={() => setFilterType('withdrawal')}
              >
                Retraits
              </Button>
              <Button
                type="button"
                variant={filterType === 'release' ? 'primary' : 'outline'}
                onClick={() => setFilterType('release')}
              >
                Versements
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
              <FormField label="Du" htmlFor="wallet-date-from">
                <Input
                  id="wallet-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={event => setDateFrom(event.target.value)}
                />
              </FormField>
              <FormField label="Au" htmlFor="wallet-date-to">
                <Input
                  id="wallet-date-to"
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
                        {formatAmount(tx.amount, tx.currency)}
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

        <section className="dashboard-section">
          <div className="card" style={{ padding: '20px', maxWidth: '640px' }}>
            <h3 style={{ marginTop: 0 }}>Recharger le wallet</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <FormField label="Montant" htmlFor="wallet-topup">
                <Input
                  id="wallet-topup"
                  type="number"
                  min="1"
                  value={topupAmount}
                  onChange={event => setTopupAmount(event.target.value)}
                  placeholder="Montant en FCFA"
                />
              </FormField>
              <FormField label="Moyen de paiement">
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Button
                    type="button"
                    variant={topupMethod === 'mobile_money' ? 'primary' : 'outline'}
                    onClick={() => setTopupMethod('mobile_money')}
                  >
                    Mobile Money
                  </Button>
                  <Button
                    type="button"
                    variant={topupMethod === 'card' ? 'primary' : 'outline'}
                    onClick={() => setTopupMethod('card')}
                  >
                    Carte bancaire
                  </Button>
                </div>
              </FormField>
              <Button onClick={handleTopup} disabled={submitting}>
                {submitting ? 'Traitement...' : 'Recharger'}
              </Button>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="card" style={{ padding: '20px', maxWidth: '640px' }}>
            <h3 style={{ marginTop: 0 }}>Retirer mes gains</h3>
            <div
              style={{
                marginBottom: '14px',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                background: '#f8fafc',
                display: 'grid',
                gap: '8px'
              }}
            >
              <strong style={{ color: '#0f172a' }}>Checklist avant retrait</strong>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#334155' }}>
                  1. Mobile Money configuré
                </span>
                <span style={{ color: payoutConfigured ? '#15803d' : '#b45309', fontWeight: 600 }}>
                  {payoutConfigured ? 'OK' : 'À compléter'}
                </span>
              </div>
              {!payoutConfigured ? (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/dashboard/settings#payout-settings')}
                  >
                    Configurer mon Mobile Money
                  </Button>
                </div>
              ) : null}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#334155' }}>
                  2. Solde disponible
                </span>
                <span style={{ color: hasBalance ? '#15803d' : '#b45309', fontWeight: 600 }}>
                  {hasBalance ? 'OK' : 'Insuffisant'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#334155' }}>
                  3. Montant valide et inférieur au solde
                </span>
                <span style={{ color: hasEnoughBalance ? '#15803d' : '#b45309', fontWeight: 600 }}>
                  {hasEnoughBalance ? 'OK' : 'À vérifier'}
                </span>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <FormField label="Montant" htmlFor="wallet-withdraw">
                <Input
                  id="wallet-withdraw"
                  type="number"
                  min="1"
                  value={withdrawAmount}
                  onChange={event => setWithdrawAmount(event.target.value)}
                  placeholder="Montant en FCFA"
                />
              </FormField>
              <Button
                variant="outline"
                onClick={handleWithdraw}
                disabled={submitting || !payoutConfigured || !hasValidWithdrawAmount || !hasEnoughBalance}
              >
                {submitting ? 'Traitement...' : 'Retirer'}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
