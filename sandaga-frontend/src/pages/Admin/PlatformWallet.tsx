import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
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
  const { t } = useI18n()
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
  // Offset du « charger plus » via ref, pour ne pas faire dépendre
  // loadTransactions de transactions.length (sinon boucle de refetch).
  const txCountRef = useRef(0)
  const summaryAbortRef = useRef<AbortController | null>(null)
  const txAbortRef = useRef<AbortController | null>(null)

  const loadSummary = useCallback(() => {
    summaryAbortRef.current?.abort()
    const controller = new AbortController()
    summaryAbortRef.current = controller
    setLoading(true)
    apiGet<WalletSummary>('/admin/platform-wallet', { signal: controller.signal })
      .then(setSummary)
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('Unable to load platform wallet', err)
        addToast({
          variant: 'error',
          title: t('admin.platformWallet.toast.title'),
          message: t('admin.platformWallet.toast.loadSummaryError')
        })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
  }, [addToast, t])

  const loadTransactions = useCallback(
    (mode: 'reset' | 'more' = 'reset') => {
      const limit = 20
      const offset = mode === 'more' ? txCountRef.current : 0
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset)
      })
      if (filterType !== 'all') params.set('type', filterType)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      txAbortRef.current?.abort()
      const controller = new AbortController()
      txAbortRef.current = controller
      if (mode === 'reset') {
        setTxLoading(true)
      } else {
        setTxLoadingMore(true)
      }
      apiGet<WalletTransactionsResponse>(
        `/admin/platform-wallet/transactions?${params.toString()}`,
        { signal: controller.signal }
      )
        .then(data => {
          const items = data.items ?? []
          if (mode === 'reset') {
            setTransactions(items)
            txCountRef.current = items.length
          } else {
            setTransactions(prev => {
              const next = [...prev, ...items]
              txCountRef.current = next.length
              return next
            })
          }
          setTransactionsTotal(data.total ?? 0)
        })
        .catch(err => {
          if (controller.signal.aborted) return
          console.error('Unable to load platform wallet transactions', err)
          addToast({
            variant: 'error',
            title: t('admin.platformWallet.toast.title'),
            message: t('admin.platformWallet.toast.loadTransactionsError')
          })
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setTxLoading(false)
            setTxLoadingMore(false)
          }
        })
    },
    [addToast, t, filterType, filterStatus, dateFrom, dateTo]
  )

  // Le solde se charge une seule fois (loadSummary est stable).
  useEffect(() => {
    loadSummary()
    return () => summaryAbortRef.current?.abort()
  }, [loadSummary])

  // Transactions : montage + changement de filtre, sans boucle (loadTransactions
  // ne dépend plus de transactions.length).
  useEffect(() => {
    loadTransactions('reset')
    return () => txAbortRef.current?.abort()
  }, [loadTransactions])

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
        title: t('admin.platformWallet.toast.title'),
        message: t('admin.platformWallet.toast.exportError')
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
      topup: t('admin.platformWallet.type.topup'),
      hold: t('admin.platformWallet.type.hold'),
      release: t('admin.platformWallet.type.release'),
      refund: t('admin.platformWallet.type.refund'),
      withdrawal: t('admin.platformWallet.type.withdrawal'),
      adjustment: t('admin.platformWallet.type.adjustment')
    }),
    [t]
  )

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="admin-header">
          <div>
            <h1>{t('admin.platformWallet.title')}</h1>
            <p>{t('admin.platformWallet.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={loadSummary} disabled={loading}>
            {t('admin.platformWallet.refresh')}
          </Button>
        </header>

        <section className="admin-section">
          <div className="card" style={{ padding: '20px', maxWidth: '520px' }}>
            <h3 style={{ marginTop: 0 }}>{t('admin.platformWallet.currentBalance')}</h3>
            {loading ? (
              <p>{t('admin.platformWallet.loading')}</p>
            ) : summary ? (
              <>
                <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
                  {formatMoney(summary.balance, summary.currency)}
                </p>
                <p style={{ marginTop: '6px', color: '#64748b' }}>
                  {t('admin.platformWallet.account', { email: summary.email })}
                </p>
              </>
            ) : (
              <p>{t('admin.platformWallet.emptyValue')}</p>
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
              <h3 style={{ marginTop: 0 }}>{t('admin.platformWallet.history')}</h3>
              <Button variant="outline" onClick={handleExport}>
                {t('admin.platformWallet.exportCsv')}
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Button
                type="button"
                variant={filterType === 'all' ? 'primary' : 'outline'}
                onClick={() => setFilterType('all')}
              >
                {t('admin.platformWallet.filters.typeAll')}
              </Button>
              <Button
                type="button"
                variant={filterType === 'release' ? 'primary' : 'outline'}
                onClick={() => setFilterType('release')}
              >
                {t('admin.platformWallet.filters.typeRelease')}
              </Button>
              <Button
                type="button"
                variant={filterType === 'adjustment' ? 'primary' : 'outline'}
                onClick={() => setFilterType('adjustment')}
              >
                {t('admin.platformWallet.filters.typeAdjustment')}
              </Button>
              <Button
                type="button"
                variant={filterType === 'refund' ? 'primary' : 'outline'}
                onClick={() => setFilterType('refund')}
              >
                {t('admin.platformWallet.filters.typeRefund')}
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Button
                type="button"
                variant={filterStatus === 'all' ? 'primary' : 'outline'}
                onClick={() => setFilterStatus('all')}
              >
                {t('admin.platformWallet.filters.statusAll')}
              </Button>
              <Button
                type="button"
                variant={filterStatus === 'completed' ? 'primary' : 'outline'}
                onClick={() => setFilterStatus('completed')}
              >
                {t('admin.platformWallet.filters.statusCompleted')}
              </Button>
              <Button
                type="button"
                variant={filterStatus === 'pending' ? 'primary' : 'outline'}
                onClick={() => setFilterStatus('pending')}
              >
                {t('admin.platformWallet.filters.statusPending')}
              </Button>
              <Button
                type="button"
                variant={filterStatus === 'failed' ? 'primary' : 'outline'}
                onClick={() => setFilterStatus('failed')}
              >
                {t('admin.platformWallet.filters.statusFailed')}
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <FormField label={t('admin.platformWallet.dateFrom')} htmlFor="platform-wallet-date-from">
                <Input
                  id="platform-wallet-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={event => setDateFrom(event.target.value)}
                />
              </FormField>
              <FormField label={t('admin.platformWallet.dateTo')} htmlFor="platform-wallet-date-to">
                <Input
                  id="platform-wallet-date-to"
                  type="date"
                  value={dateTo}
                  onChange={event => setDateTo(event.target.value)}
                />
              </FormField>
            </div>
            {txLoading ? (
              <p>{t('admin.platformWallet.loading')}</p>
            ) : transactions.length === 0 ? (
              <p>{t('admin.platformWallet.empty')}</p>
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
                          ? t('admin.platformWallet.status.completed')
                          : tx.status === 'pending'
                            ? t('admin.platformWallet.status.pending')
                            : t('admin.platformWallet.status.failed')}
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
                  {txLoadingMore ? t('admin.platformWallet.loading') : t('admin.platformWallet.loadMore')}
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
