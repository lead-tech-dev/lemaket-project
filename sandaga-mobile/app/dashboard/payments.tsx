import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { paymentsApi } from '@/features/payments/payments.api'
import { useClientPagination } from '@/core/pagination/useClientPagination'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

function formatMoney(amount: number | string, currency: string) {
  const numeric = Number(amount)
  if (Number.isFinite(numeric)) {
    return `${Math.round(numeric).toLocaleString('fr-FR')} ${currency}`
  }
  return `${amount} ${currency}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR')
}

function normalizeCameroonMobileNumber(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  const local = digits.startsWith('237') ? digits.slice(3) : digits
  if (!/^6\d{8}$/.test(local)) {
    return null
  }
  return `+237${local}`
}

function isProviderPhonePrefixMatch(provider: 'mtn' | 'orange', normalizedPhone: string): boolean {
  const local = normalizedPhone.replace('+237', '')
  if (provider === 'mtn') {
    return /^(65[0-4]|67\d|68\d)\d{6}$/.test(local)
  }
  return /^(65[5-9]|69\d)\d{6}$/.test(local)
}

function providerHint(provider: 'mtn' | 'orange'): string {
  return provider === 'orange'
    ? 'Préfixes Orange: 655-659, 69x'
    : 'Préfixes MTN: 650-654, 67x, 68x'
}

const statusLabel: Record<string, string> = {
  completed: 'Terminée',
  pending: 'En attente',
  failed: 'Échouée',
  refunded: 'Remboursée'
}

function statusTone(status: string) {
  switch (status) {
    case 'completed':
      return { bg: colors.successSoft, text: colors.success }
    case 'pending':
      return { bg: colors.warningSoft, text: colors.warning }
    case 'failed':
    case 'refunded':
      return { bg: colors.dangerSurface, text: colors.danger }
    default:
      return { bg: colors.surfaceMuted, text: colors.text }
  }
}

export default function DashboardPaymentsScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState<'mtn' | 'orange'>('mtn')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [label, setLabel] = useState('')
  const [createMethodError, setCreateMethodError] = useState<string | null>(null)
  const [invoiceStatus, setInvoiceStatus] = useState<'all' | 'pending' | 'completed' | 'failed' | 'refunded'>('all')
  const [invoiceQuery, setInvoiceQuery] = useState('')

  const methodsQuery = useQuery({
    queryKey: ['payments', 'methods'],
    queryFn: () => paymentsApi.methods()
  })
  const invoicesQuery = useQuery({
    queryKey: ['payments', 'invoices'],
    queryFn: () => paymentsApi.invoices()
  })
  const createMethodMutation = useMutation({
    mutationFn: () =>
      paymentsApi.createMethod({
        type: 'wallet',
        externalId: normalizeCameroonMobileNumber(phoneNumber) ?? phoneNumber.trim(),
        holderName: holderName.trim() || undefined,
        label: label.trim() || (mobileMoneyProvider === 'orange' ? 'Orange Money' : 'MTN Mobile Money'),
        provider: mobileMoneyProvider
      }),
    onSuccess: () => {
      setPhoneNumber('')
      setHolderName('')
      setLabel('')
      setCreateMethodError(null)
      queryClient.invalidateQueries({ queryKey: ['payments', 'methods'] })
      Alert.alert('Paiements', 'Moyen de paiement ajouté.')
    },
    onError: err =>
      setCreateMethodError(
        err instanceof Error ? err.message : 'Impossible d’ajouter ce moyen de paiement.'
      )
  })

  const deleteMethodMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.removeMethod(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments', 'methods'] })
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.updateMethod(id, { isDefault: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments', 'methods'] })
  })

  const verifyMethodMutation = useMutation({
    mutationFn: async (id: string) => {
      const begin = await paymentsApi.beginVerification(id)
      await paymentsApi.confirmVerification(id, true)
      return begin
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ['payments', 'methods'] })
      Alert.alert(
        'Paiements',
        result.redirectUrl
          ? `Vérification lancée puis confirmée. URL: ${result.redirectUrl}`
          : 'Vérification confirmée.'
      )
    },
    onError: err => Alert.alert('Paiements', err instanceof Error ? err.message : 'Vérification impossible.')
  })

  const normalizedPhone = useMemo(
    () => normalizeCameroonMobileNumber(phoneNumber),
    [phoneNumber]
  )
  const isProviderPhoneValid = useMemo(
    () => (normalizedPhone ? isProviderPhonePrefixMatch(mobileMoneyProvider, normalizedPhone) : false),
    [mobileMoneyProvider, normalizedPhone]
  )
  const canCreateMethod = useMemo(
    () => holderName.trim().length >= 2 && Boolean(normalizedPhone) && isProviderPhoneValid,
    [holderName, normalizedPhone, isProviderPhoneValid]
  )
  const methodsPagination = useClientPagination(methodsQuery.data, 6)
  const filteredInvoices = useMemo(() => {
    const query = invoiceQuery.trim().toLowerCase()
    return (invoicesQuery.data ?? [])
      .filter(item => invoiceStatus === 'all' || item.status === invoiceStatus)
      .filter(item => {
        if (!query) return true
        const haystack = [
          item.description,
          item.invoiceNumber,
          item.reference,
          item.provider,
          item.paymentMethod?.label,
          item.paymentMethod?.provider,
          item.paymentMethod?.type
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(query)
      })
  }, [invoiceQuery, invoiceStatus, invoicesQuery.data])
  const invoicesPagination = useClientPagination(filteredInvoices, 8, invoiceStatus)

  return (
    <ScreenScaffold title="Paiements" subtitle="Gérez vos moyens de paiement et vos factures.">
      <View style={[dashboardStyles.sectionCard, styles.promoCard]}>
        <View style={{ flex: 1 }}>
          <Text style={dashboardStyles.sectionTitle}>Promotions & boosts</Text>
          <Text style={styles.promoText}>
            Lance une mise en avant, suis ton checkout et retrouve les paiements liés à la visibilité de tes annonces.
          </Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/dashboard/promotions')}>
          <Text style={styles.primaryButtonText}>Ouvrir promotions</Text>
        </Pressable>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Ajouter un moyen de paiement</Text>
        <Text style={styles.inputLabel}>Type</Text>
        <View style={styles.segment}>
          {([
            { id: 'mtn', label: 'MTN Mobile Money' },
            { id: 'orange', label: 'Orange Money' }
          ] as const).map(option => (
            <Pressable
              key={option.id}
              style={[styles.segmentItem, mobileMoneyProvider === option.id && styles.segmentItemActive]}
              onPress={() => {
                setCreateMethodError(null)
                setMobileMoneyProvider(option.id)
              }}
            >
              <Text style={[styles.segmentLabel, mobileMoneyProvider === option.id && styles.segmentLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={label}
          onChangeText={value => {
            setCreateMethodError(null)
            setLabel(value)
          }}
          placeholder="Libellé (ex: Mobile Money principal - optionnel)"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
        <TextInput
          value={phoneNumber}
          onChangeText={value => {
            setCreateMethodError(null)
            setPhoneNumber(value)
          }}
          placeholder="Numéro Mobile Money (+2376XXXXXXXX)"
          placeholderTextColor={colors.placeholder}
          keyboardType="phone-pad"
          style={styles.input}
        />
        <Text style={styles.inputHint}>{providerHint(mobileMoneyProvider)}</Text>
        {phoneNumber.trim().length > 0 && !normalizedPhone ? (
          <Text style={styles.errorText}>Numéro camerounais invalide. Format: +2376XXXXXXXX.</Text>
        ) : null}
        {phoneNumber.trim().length > 0 && normalizedPhone && !isProviderPhoneValid ? (
          <Text style={styles.errorText}>
            {mobileMoneyProvider === 'orange'
              ? 'Le numéro ne correspond pas à Orange Money.'
              : 'Le numéro ne correspond pas à MTN Mobile Money.'}
          </Text>
        ) : null}
        {createMethodError ? <Text style={styles.errorText}>{createMethodError}</Text> : null}
        <TextInput
          value={holderName}
          onChangeText={value => {
            setCreateMethodError(null)
            setHolderName(value)
          }}
          placeholder="Titulaire"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
        <Pressable
          style={[styles.primaryButton, (!canCreateMethod || createMethodMutation.isPending) && { opacity: 0.6 }]}
          disabled={!canCreateMethod || createMethodMutation.isPending}
          onPress={() => createMethodMutation.mutate()}
        >
          <Text style={styles.primaryButtonText}>Ajouter</Text>
        </Pressable>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Mes moyens de paiement</Text>
        {methodsQuery.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        <FlatList
          scrollEnabled={false}
          data={methodsPagination.visibleItems}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={dashboardStyles.empty}>Aucun moyen de paiement.</Text>}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListFooterComponent={methodsPagination.hasMore ? <LoadMoreButton onPress={methodsPagination.loadMore} /> : null}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {item.label || `${item.type}${item.last4 ? ` •••• ${item.last4}` : ''}`}
              </Text>
              <Text style={styles.meta}>Statut: {item.verificationStatus}</Text>
              {item.isDefault ? <Text style={styles.badge}>Par défaut</Text> : null}
              <View style={styles.inlineActions}>
                {!item.isDefault ? (
                  <Pressable style={styles.secondaryButton} onPress={() => setDefaultMutation.mutate(item.id)}>
                    <Text style={styles.secondaryButtonText}>Définir par défaut</Text>
                  </Pressable>
                ) : null}
                {item.verificationStatus !== 'verified' ? (
                  <Pressable style={styles.secondaryButton} onPress={() => verifyMethodMutation.mutate(item.id)}>
                    <Text style={styles.secondaryButtonText}>Vérifier</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    Alert.alert('Paiements', 'Supprimer ce moyen de paiement ?', [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMethodMutation.mutate(item.id) }
                    ])
                  }
                >
                  <Text style={styles.secondaryButtonText}>Supprimer</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Factures / paiements</Text>
        {invoicesQuery.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        <TextInput
          value={invoiceQuery}
          onChangeText={setInvoiceQuery}
          placeholder="Rechercher une facture, référence..."
          placeholderTextColor={colors.placeholder}
          style={styles.invoiceSearch}
        />
        <View style={styles.segment}>
          {(['all', 'pending', 'completed', 'failed', 'refunded'] as const).map(status => (
            <Pressable
              key={status}
              style={[styles.segmentItem, invoiceStatus === status && styles.segmentItemActive]}
              onPress={() => setInvoiceStatus(status)}
            >
              <Text style={[styles.segmentLabel, invoiceStatus === status && styles.segmentLabelActive]}>
                {status === 'all'
                  ? 'Tous'
                  : status === 'pending'
                    ? 'En attente'
                    : status === 'completed'
                      ? 'Terminées'
                      : status === 'failed'
                        ? 'Échouées'
                        : 'Remboursées'}
              </Text>
            </Pressable>
          ))}
        </View>
        <FlatList
          scrollEnabled={false}
          data={invoicesPagination.visibleItems}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={dashboardStyles.empty}>Aucun paiement enregistré.</Text>}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListFooterComponent={invoicesPagination.hasMore ? <LoadMoreButton onPress={invoicesPagination.loadMore} /> : null}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push({ pathname: '/dashboard/payments/[id]', params: { id: item.id } })}>
              <View style={styles.invoiceTopRow}>
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                  {item.description || 'Paiement'}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusTone(item.status).bg }]}>
                  <Text style={[styles.statusBadgeText, { color: statusTone(item.status).text }]}>
                    {statusLabel[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>{formatMoney(item.amount, item.currency)}</Text>
              <Text style={styles.meta}>{formatDate(item.created_at)}</Text>
              <View style={styles.invoiceActions}>
                <Text style={styles.detailHint}>Voir le détail</Text>
                {item.invoiceUrl ? (
                  <Pressable
                    style={styles.inlineLink}
                    onPress={() => {
                      void Linking.openURL(item.invoiceUrl as string).catch(() => {
                        Alert.alert('Paiements', item.invoiceUrl ?? 'Lien indisponible')
                      })
                    }}
                  >
                    <Text style={styles.inlineLinkText}>Facture</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.invoiceHint}>Aucune facture disponible</Text>
                )}
              </View>
            </Pressable>
          )}
        />
      </View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  promoCard: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primarySoftStrong,
    gap: spacing.sm
  },
  promoText: {
    color: colors.muted,
    fontSize: typography.bodySm
  },
  inputLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold,
    marginBottom: spacing.xs
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    flexWrap: 'wrap'
  },
  segmentItem: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
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
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md
  },
  title: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  meta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  detailHint: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  invoiceSearch: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm
  },
  errorText: {
    marginTop: -4,
    marginBottom: spacing.sm,
    color: colors.danger,
    fontSize: 10,
    lineHeight: 12
  },
  inputHint: {
    marginTop: -4,
    marginBottom: spacing.xs,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 12
  },
  invoiceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  statusBadgeText: {
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  invoiceActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  inlineLink: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primarySoftStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.primarySoft
  },
  inlineLinkText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  invoiceHint: {
    color: colors.muted,
    fontSize: typography.caption
  },
  badge: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  inlineActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  secondaryButton: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface ?? colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  }
})
