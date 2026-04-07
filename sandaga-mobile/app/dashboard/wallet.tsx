import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { paymentsApi } from '@/features/payments/payments.api'
import { usersApi } from '@/features/users/users.api'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

type TxTypeFilter = 'all' | 'topup' | 'withdrawal' | 'release'
type TxStatusFilter = 'all' | 'completed' | 'pending' | 'failed'

const txTypeLabel: Record<string, string> = {
  topup: 'Recharge',
  hold: 'Réservation',
  release: 'Versement',
  refund: 'Remboursement',
  withdrawal: 'Retrait',
  adjustment: 'Ajustement'
}

function formatMoney(amount: number, currency: string) {
  return `${Math.round(amount).toLocaleString('fr-FR')} ${currency}`
}

function isValidCameroonMobileNumber(value?: string | null) {
  if (!value) return false
  const normalized = value.replace(/[\s().-]/g, '')
  return /^(\+237|237)?6\d{8}$/.test(normalized)
}

export default function DashboardWalletScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [topupAmount, setTopupAmount] = useState('')
  const [topupMethod, setTopupMethod] = useState<'mobile_money' | 'card'>('mobile_money')
  const [topupOperator, setTopupOperator] = useState<'mtn' | 'orange'>('mtn')
  const [topupPhone, setTopupPhone] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [filterType, setFilterType] = useState<TxTypeFilter>('all')
  const [filterStatus, setFilterStatus] = useState<TxStatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const summaryQuery = useQuery({
    queryKey: ['payments', 'wallet', 'summary'],
    queryFn: () => paymentsApi.walletSummary()
  })

  const meQuery = useQuery({
    queryKey: ['users', 'me', 'wallet'],
    queryFn: () => usersApi.me()
  })

  const txParams = useMemo(() => {
    const params = new URLSearchParams()
    if (filterType !== 'all') params.set('type', filterType)
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (dateFrom.trim()) params.set('from', dateFrom.trim())
    if (dateTo.trim()) params.set('to', dateTo.trim())
    return params
  }, [dateFrom, dateTo, filterStatus, filterType])

  const txQuery = useInfiniteQuery({
    queryKey: ['payments', 'wallet', 'transactions', txParams.toString()],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams(txParams.toString())
      params.set('limit', '30')
      params.set('offset', String(pageParam))
      return paymentsApi.walletTransactions(params)
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((total, page) => total + page.items.length, 0)
      return loaded < lastPage.total ? loaded : undefined
    }
  })

  const topupMutation = useMutation({
    mutationFn: (payload: { amount: number; currency: string; paymentMethod: 'mobile_money' | 'card' }) =>
      paymentsApi.walletTopup(payload),
    onSuccess: result => {
      setTopupAmount('')
      setTopupPhone('')
      queryClient.invalidateQueries({ queryKey: ['payments', 'wallet', 'summary'] })
      queryClient.invalidateQueries({ queryKey: ['payments', 'wallet', 'transactions'] })
      if (result?.paymentUrl) {
        void Linking.openURL(result.paymentUrl).catch(() => {
          Alert.alert('Portefeuille', `Recharge initiée. Ouvre ce lien pour continuer: ${result.paymentUrl}`)
        })
        return
      }
      Alert.alert('Portefeuille', 'Recharge initiée. Vous serez notifié après confirmation.')
    },
    onError: err => Alert.alert('Portefeuille', err instanceof Error ? err.message : 'Impossible de lancer la recharge.')
  })

  const withdrawMutation = useMutation({
    mutationFn: (payload: { amount: number; currency: string }) => paymentsApi.walletWithdraw(payload),
    onSuccess: () => {
      setWithdrawAmount('')
      queryClient.invalidateQueries({ queryKey: ['payments', 'wallet', 'summary'] })
      queryClient.invalidateQueries({ queryKey: ['payments', 'wallet', 'transactions'] })
      Alert.alert('Portefeuille', 'Retrait lancé. Vous recevrez une confirmation dès validation.')
    },
    onError: err => Alert.alert('Portefeuille', err instanceof Error ? err.message : 'Impossible de lancer le retrait.')
  })

  const currency = summaryQuery.data?.currency ?? meQuery.data?.walletCurrency ?? 'XAF'
  const balance = Number(summaryQuery.data?.balance ?? 0)
  const payoutNetwork = meQuery.data?.settings?.payoutMobileNetwork ?? null
  const payoutNumber = meQuery.data?.settings?.payoutMobileNumber ?? null
  const payoutConfigured = Boolean(payoutNetwork && isValidCameroonMobileNumber(payoutNumber))
  const txItems = useMemo(() => txQuery.data?.pages.flatMap(page => page.items ?? []) ?? [], [txQuery.data])
  const topupAmountNumber = Number(topupAmount)
  const topupAmountValid = Number.isFinite(topupAmountNumber) && topupAmountNumber > 0
  const normalizedTopupPhone = topupPhone.trim()
  const topupPhoneValid = topupMethod !== 'mobile_money' || isValidCameroonMobileNumber(normalizedTopupPhone)
  const topupPhoneInvalid =
    topupMethod === 'mobile_money' && normalizedTopupPhone.length > 0 && !topupPhoneValid
  const canSubmitTopup = topupAmountValid && topupPhoneValid

  const withdrawAmountNumber = Number(withdrawAmount)
  const withdrawAmountValid = Number.isFinite(withdrawAmountNumber) && withdrawAmountNumber > 0
  const withdrawTooHigh = withdrawAmountValid && withdrawAmountNumber > balance
  const canSubmitWithdraw = withdrawAmountValid && payoutConfigured && !withdrawTooHigh

  const handleTopup = () => {
    if (!topupAmountValid) {
      Alert.alert('Portefeuille', 'Montant de recharge invalide.')
      return
    }
    if (topupMethod === 'mobile_money') {
      if (!topupPhoneValid) {
        Alert.alert('Portefeuille', 'Saisissez un numéro camerounais valide pour la recharge Mobile Money.')
        return
      }
    }

    topupMutation.mutate({
      amount: topupAmountNumber,
      currency,
      paymentMethod: topupMethod,
      paymentOperator: topupMethod === 'mobile_money' ? topupOperator : undefined,
      paymentPhone: topupMethod === 'mobile_money' ? normalizedTopupPhone : undefined
    })
  }

  const handleWithdraw = () => {
    if (!payoutConfigured) {
      Alert.alert('Retrait', 'Configurez votre Mobile Money dans Paramètres avant de retirer.', [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Ouvrir Paramètres', onPress: () => router.push('/dashboard/settings') }
      ])
      return
    }
    if (!withdrawAmountValid) {
      Alert.alert('Portefeuille', 'Montant de retrait invalide.')
      return
    }
    if (withdrawTooHigh) {
      Alert.alert('Portefeuille', 'Solde insuffisant pour ce retrait.')
      return
    }
    withdrawMutation.mutate({ amount: withdrawAmountNumber, currency })
  }

  return (
    <ScreenScaffold title="Portefeuille" subtitle="Rechargez et retirez vos gains en toute sécurité.">
      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Solde disponible</Text>
        <Text style={styles.balanceValue}>{formatMoney(balance, currency)}</Text>
        <Text style={styles.balanceHint}>
          {payoutConfigured ? `Retraits vers ${payoutNetwork?.toUpperCase()} (${payoutNumber})` : 'Mobile Money non configuré'}
        </Text>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Recharger</Text>
        <View style={styles.segment}>
          <Pressable
            style={[styles.segmentItem, topupMethod === 'mobile_money' && styles.segmentItemActive]}
            onPress={() => setTopupMethod('mobile_money')}
          >
            <Text style={[styles.segmentLabel, topupMethod === 'mobile_money' && styles.segmentLabelActive]}>Mobile Money</Text>
          </Pressable>
          <Pressable style={[styles.segmentItem, topupMethod === 'card' && styles.segmentItemActive]} onPress={() => setTopupMethod('card')}>
            <Text style={[styles.segmentLabel, topupMethod === 'card' && styles.segmentLabelActive]}>Carte</Text>
          </Pressable>
        </View>
        {topupMethod === 'mobile_money' ? (
          <>
            <View style={styles.segment}>
              <Pressable
                style={[styles.segmentItem, topupOperator === 'mtn' && styles.segmentItemActive]}
                onPress={() => setTopupOperator('mtn')}
              >
                <Text style={[styles.segmentLabel, topupOperator === 'mtn' && styles.segmentLabelActive]}>MTN</Text>
              </Pressable>
              <Pressable
                style={[styles.segmentItem, topupOperator === 'orange' && styles.segmentItemActive]}
                onPress={() => setTopupOperator('orange')}
              >
                <Text style={[styles.segmentLabel, topupOperator === 'orange' && styles.segmentLabelActive]}>Orange</Text>
              </Pressable>
            </View>
            <TextInput
              value={topupPhone}
              onChangeText={setTopupPhone}
              placeholder="Numéro Mobile Money (+2376XXXXXXXX)"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
              style={styles.input}
            />
            {topupPhoneInvalid ? (
              <Text style={styles.error}>Numéro camerounais invalide. Utilise +2376XXXXXXXX.</Text>
            ) : null}
          </>
        ) : null}
        <TextInput
          value={topupAmount}
          onChangeText={setTopupAmount}
          placeholder="Montant"
          placeholderTextColor={colors.placeholder}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        {!topupAmountValid && topupAmount.trim().length > 0 ? (
          <Text style={styles.error}>Montant invalide.</Text>
        ) : null}
        <Pressable
          style={[styles.primaryButton, (!canSubmitTopup || topupMutation.isPending) && { opacity: 0.6 }]}
          disabled={!canSubmitTopup || topupMutation.isPending}
          onPress={handleTopup}
        >
          <Text style={styles.primaryButtonText}>Lancer la recharge</Text>
        </Pressable>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Retirer</Text>
        <TextInput
          value={withdrawAmount}
          onChangeText={setWithdrawAmount}
          placeholder="Montant"
          placeholderTextColor={colors.placeholder}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        {!withdrawAmountValid && withdrawAmount.trim().length > 0 ? (
          <Text style={styles.error}>Montant invalide.</Text>
        ) : null}
        {withdrawTooHigh ? <Text style={styles.error}>Solde insuffisant pour ce retrait.</Text> : null}
        <Pressable
          style={[styles.primaryButton, (!canSubmitWithdraw || withdrawMutation.isPending) && { opacity: 0.6 }]}
          disabled={!canSubmitWithdraw || withdrawMutation.isPending}
          onPress={handleWithdraw}
        >
          <Text style={styles.primaryButtonText}>Lancer le retrait</Text>
        </Pressable>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Historique</Text>
        <View style={styles.segment}>
          <Pressable style={[styles.segmentItem, filterType === 'all' && styles.segmentItemActive]} onPress={() => setFilterType('all')}>
            <Text style={[styles.segmentLabel, filterType === 'all' && styles.segmentLabelActive]}>Tous</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentItem, filterType === 'topup' && styles.segmentItemActive]}
            onPress={() => setFilterType('topup')}
          >
            <Text style={[styles.segmentLabel, filterType === 'topup' && styles.segmentLabelActive]}>Recharges</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentItem, filterType === 'withdrawal' && styles.segmentItemActive]}
            onPress={() => setFilterType('withdrawal')}
          >
            <Text style={[styles.segmentLabel, filterType === 'withdrawal' && styles.segmentLabelActive]}>Retraits</Text>
          </Pressable>
        </View>
        <View style={styles.segment}>
          <Pressable style={[styles.segmentItem, filterStatus === 'all' && styles.segmentItemActive]} onPress={() => setFilterStatus('all')}>
            <Text style={[styles.segmentLabel, filterStatus === 'all' && styles.segmentLabelActive]}>Tous statuts</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentItem, filterStatus === 'completed' && styles.segmentItemActive]}
            onPress={() => setFilterStatus('completed')}
          >
            <Text style={[styles.segmentLabel, filterStatus === 'completed' && styles.segmentLabelActive]}>Terminés</Text>
          </Pressable>
        </View>
        <TextInput
          value={dateFrom}
          onChangeText={setDateFrom}
          placeholder="Date début (YYYY-MM-DD)"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
        <TextInput
          value={dateTo}
          onChangeText={setDateTo}
          placeholder="Date fin (YYYY-MM-DD)"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
        {txQuery.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        <FlatList
          scrollEnabled={false}
          data={txItems}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={dashboardStyles.empty}>Aucune transaction.</Text>}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListFooterComponent={
            txItems.length > 0
              ? txQuery.hasNextPage
                ? <LoadMoreButton onPress={() => void txQuery.fetchNextPage()} disabled={txQuery.isFetchingNextPage} label={txQuery.isFetchingNextPage ? 'Chargement...' : 'Charger plus'} />
                : null
              : null
          }
          renderItem={({ item }) => (
            <View style={styles.txCard}>
              <View style={styles.txRow}>
                <Text style={styles.txType}>{txTypeLabel[item.type] ?? item.type}</Text>
                <Text style={styles.txAmount}>{formatMoney(Number(item.amount), item.currency)}</Text>
              </View>
              <Text style={styles.txMeta}>Statut: {item.status}</Text>
              <Text style={styles.txMeta}>{new Date(item.created_at).toLocaleString('fr-FR')}</Text>
            </View>
          )}
        />
      </View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  balanceValue: {
    color: colors.primary,
    fontSize: typography.titleXl,
    fontWeight: typography.weightBlack
  },
  balanceHint: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.caption
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surfaceRaised
  },
  segmentItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  segmentLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  segmentLabelActive: {
    color: colors.primary
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    color: colors.text,
    marginTop: spacing.xs
  },
  error: {
    marginTop: spacing.xs,
    color: colors.danger,
    fontSize: typography.caption
  },
  primaryButton: {
    marginTop: spacing.sm,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold
  },
  txCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs
  },
  txType: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  txAmount: {
    color: colors.primary,
    fontWeight: typography.weightBold
  },
  txMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  }
})
