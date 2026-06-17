import { useEffect, useMemo, useState } from 'react'
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { HttpError } from '@/core/api/http'
import { useClientPagination } from '@/core/pagination/useClientPagination'
import { listingsApi } from '@/features/listings/listings.api'
import {
  paymentsApi,
  type CheckoutRequest,
  type CheckoutSessionStatus,
  type PaymentMethod,
  type PaymentRecord,
  type PaymentPromotionOption
} from '@/features/payments/payments.api'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'

function formatCurrency(amount: number, currency: string) {
  try {
    const options: Intl.NumberFormatOptions = { style: 'currency', currency }
    if (currency === 'XAF' || currency === 'XOF') {
      options.minimumFractionDigits = 0
      options.maximumFractionDigits = 0
    }
    return new Intl.NumberFormat('fr-FR', options).format(amount)
  } catch {
    return `${amount.toLocaleString('fr-FR')} ${currency}`
  }
}

function buildMethodLabel(method: PaymentMethod) {
  if (method.label) return method.label
  if (method.type === 'card') {
    return `${method.brand ?? 'Carte'}${method.last4 ? ` •••• ${method.last4}` : ''}`.trim()
  }
  if (method.type === 'wallet') {
    const provider = (method.provider ?? '').toLowerCase()
    if (provider === 'orange') return 'Orange Money'
    if (provider === 'mtn') return 'MTN Mobile Money'
    return 'Portefeuille mobile'
  }
  if (method.type === 'transfer') return 'Virement'
  if (method.type === 'cash') return 'Espèces'
  return method.type
}

function isMobileMoneyMethod(method: PaymentMethod): boolean {
  if (method.type !== 'wallet') {
    return false
  }
  const provider = (method.provider ?? '').toLowerCase()
  return provider === 'mtn' || provider === 'orange'
}

function buildSessionHint(status: CheckoutSessionStatus | undefined) {
  if (!status) return 'Ouverture du paiement...'
  if (status.paymentStatus === 'paid' || status.paymentStatus === 'no_payment_required') {
    return 'Paiement confirmé. La promotion est en cours d’activation.'
  }
  if (status.paymentStatus === 'unpaid') {
    return 'Paiement en attente. Reviens ici après validation.'
  }
  return 'Statut du paiement en cours de récupération.'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return value
  }
}

function promotionStatusLabel(status: PaymentRecord['status']) {
  switch (status) {
    case 'completed':
      return 'Active'
    case 'pending':
      return 'En attente'
    case 'failed':
      return 'Échouée'
    case 'refunded':
      return 'Remboursée'
    default:
      return status
  }
}

function promotionStatusTone(status: PaymentRecord['status']) {
  switch (status) {
    case 'completed':
      return {
        bg: colors.successSoft,
        text: colors.success
      }
    case 'pending':
      return {
        bg: colors.accentSurface,
        text: colors.accent
      }
    case 'failed':
    case 'refunded':
      return {
        bg: colors.dangerSurface,
        text: colors.danger
      }
    default:
      return {
        bg: colors.surfaceMuted,
        text: colors.text
      }
  }
}

export default function DashboardPromotionsScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<{ listingId?: string; category?: string }>()
  const [selectedCategory, setSelectedCategory] = useState<string>(typeof params.category === 'string' ? params.category : '')
  const [selectedOption, setSelectedOption] = useState<PaymentPromotionOption | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedListingId, setSelectedListingId] = useState<string>(typeof params.listingId === 'string' ? params.listingId : '')
  const [selectedMethodId, setSelectedMethodId] = useState<string>('')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyStatus, setHistoryStatus] = useState<'all' | 'pending' | 'completed' | 'failed' | 'refunded'>('all')

  const listingsQuery = useQuery({
    queryKey: ['listings', 'mine', 'promotions'],
    queryFn: () => listingsApi.mine('published')
  })

  const methodsQuery = useQuery({
    queryKey: ['payments', 'methods', 'promotions'],
    queryFn: () => paymentsApi.methods()
  })

  const mobileMoneyMethods = useMemo(
    () => (methodsQuery.data ?? []).filter(isMobileMoneyMethod),
    [methodsQuery.data]
  )

  const optionsQuery = useQuery({
    queryKey: ['payments', 'options', selectedCategory || 'all'],
    queryFn: () => paymentsApi.options(selectedCategory || undefined)
  })

  const sessionQuery = useQuery({
    queryKey: ['payments', 'checkout-session', activeSessionId],
    queryFn: () => paymentsApi.checkoutSession(activeSessionId as string),
    enabled: Boolean(activeSessionId),
    refetchInterval: query =>
      query.state.data?.paymentStatus === 'paid' || query.state.data?.paymentStatus === 'no_payment_required' ? false : 3500
  })

  const invoicesQuery = useQuery({
    queryKey: ['payments', 'invoices', 'promotions'],
    queryFn: () => paymentsApi.invoices()
  })

  const listingItems = useMemo(() => listingsQuery.data ?? [], [listingsQuery.data])

  const eligibleListings = useMemo(() => {
    return listingItems
  }, [listingItems])

  const categoryChips = useMemo(() => {
    const source = optionsQuery.data ?? []
    const values = new Set<string>()
    source.forEach(option => option.categories.forEach(category => values.add(category)))
    return ['all', ...Array.from(values).filter(item => item.toLowerCase() !== 'all')].map(item => ({
      id: item,
      label: item === 'all' ? 'Toutes les catégories' : item.charAt(0).toUpperCase() + item.slice(1)
    }))
  }, [optionsQuery.data])

  const promotionHistory = useMemo(() => {
    const payments = invoicesQuery.data ?? []
    return payments
      .filter(item => item.metadata?.promotionOptionId || item.description?.toLowerCase().includes('promotion'))
      .filter(item => historyStatus === 'all' || item.status === historyStatus)
      .map(item => {
        const linkedListing = listingItems.find(listing => listing.id === item.metadata?.listingId)
        return {
          ...item,
          listingTitle: linkedListing?.title ?? 'Annonce indisponible',
          listingCity: linkedListing?.location?.city ?? linkedListing?.city ?? null,
          promotionLabel:
            optionsQuery.data?.find(option => option.id === item.metadata?.promotionOptionId)?.title ??
            item.description?.replace(/^Promotion\s*[–-]\s*/i, '') ??
            'Promotion'
        }
      })
      .filter(item => {
        const q = historyQuery.trim().toLowerCase()
        if (!q) return true
        const haystack = [
          item.promotionLabel,
          item.listingTitle,
          item.listingCity,
          item.description,
          item.metadata?.promotionType
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [historyQuery, historyStatus, invoicesQuery.data, listingItems, optionsQuery.data])

  const historyPagination = useClientPagination(promotionHistory, 6)

  useEffect(() => {
    if (!selectedListingId && eligibleListings.length > 0) {
      setSelectedListingId(eligibleListings[0].id)
    } else if (selectedListingId && !eligibleListings.some(item => item.id === selectedListingId)) {
      setSelectedListingId(eligibleListings[0]?.id ?? '')
    }
  }, [eligibleListings, selectedListingId])

  useEffect(() => {
    if (!selectedMethodId && mobileMoneyMethods.length) {
      setSelectedMethodId(mobileMoneyMethods.find(item => item.isDefault)?.id ?? mobileMoneyMethods[0]?.id ?? '')
      return
    }
    if (selectedMethodId && !mobileMoneyMethods.some(item => item.id === selectedMethodId)) {
      setSelectedMethodId(mobileMoneyMethods.find(item => item.isDefault)?.id ?? mobileMoneyMethods[0]?.id ?? '')
    }
  }, [mobileMoneyMethods, selectedMethodId])

  useEffect(() => {
    if (!sessionQuery.data || !activeSessionId) return
    if (sessionQuery.data.paymentStatus === 'paid' || sessionQuery.data.paymentStatus === 'no_payment_required') {
      Alert.alert('Promotion activée', 'Le paiement est confirmé. Ta mise en avant est en cours d’activation.')
      setActiveSessionId(null)
      queryClient.invalidateQueries({ queryKey: ['payments', 'invoices'] })
      queryClient.invalidateQueries({ queryKey: ['listings', 'mine'] })
    }
  }, [activeSessionId, queryClient, sessionQuery.data])

  const checkoutMutation = useMutation({
    mutationFn: async (payload: CheckoutRequest) => paymentsApi.checkout(payload),
    onSuccess: async result => {
      setCheckoutOpen(false)
      queryClient.invalidateQueries({ queryKey: ['payments', 'invoices'] })
      if (result.sessionId) {
        setActiveSessionId(result.sessionId)
      }
      if (result.redirectUrl) {
        try {
          await Linking.openURL(result.redirectUrl)
        } catch {
          Alert.alert('Paiement', `Ouvre ce lien pour finaliser: ${result.redirectUrl}`)
        }
        return
      }
      Alert.alert('Promotion', 'La promotion a été enregistrée avec succès.')
      queryClient.invalidateQueries({ queryKey: ['listings', 'mine'] })
    },
    onError: err => {
      if (err instanceof HttpError) {
        const message = err.message ?? ''
        if (/wallet est désactivé/i.test(message) || /mobile money/i.test(message)) {
          Alert.alert('Promotion', 'Utilise un compte MTN ou Orange Mobile Money pour payer le boost.')
          return
        }
        if (/moyen de paiement requis/i.test(message)) {
          Alert.alert('Promotion', 'Sélectionne un moyen de paiement pour activer cette promotion.')
          return
        }
        if (/paiement par carte est indisponible/i.test(message)) {
          Alert.alert('Promotion', 'Le paiement est indisponible pour le moment. Réessaie plus tard.')
          return
        }
        if (/comptes pro/i.test(message) || /réservée aux comptes pro/i.test(message)) {
          Alert.alert('Promotion', 'Cette option n’est pas disponible pour le moment.')
          return
        }
      }
      Alert.alert('Promotion', err instanceof Error ? err.message : 'Impossible de lancer le checkout.')
    }
  })

  const canCheckout =
    Boolean(selectedOption) &&
    Boolean(selectedListingId) &&
    (selectedOption?.price === 0 || selectedOption?.isIncluded || Boolean(selectedMethodId))

  return (
    <>
      <ScreenScaffold title="Promotions" subtitle="Booste tes annonces avec les options sponsorisées de LEMAKET.">
        {activeSessionId ? (
          <View style={[dashboardStyles.sectionCard, styles.sessionCard]}>
            <View style={styles.sessionHeader}>
              <View style={styles.sessionIconWrap}>
                <Ionicons
                  name={
                    sessionQuery.data?.paymentStatus === 'paid' || sessionQuery.data?.paymentStatus === 'no_payment_required'
                      ? 'checkmark-circle'
                      : 'time-outline'
                  }
                  size={20}
                  color={
                    sessionQuery.data?.paymentStatus === 'paid' || sessionQuery.data?.paymentStatus === 'no_payment_required'
                      ? colors.success
                      : colors.primary
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTitle}>Paiement en suivi</Text>
                <Text style={styles.sessionText}>{buildSessionHint(sessionQuery.data)}</Text>
              </View>
            </View>
            <View style={styles.sessionActions}>
              <Pressable
                style={[styles.ghostButton, styles.sessionActionButton]}
                onPress={() => sessionQuery.refetch()}
                disabled={sessionQuery.isFetching}
              >
                <Text style={styles.ghostButtonText}>{sessionQuery.isFetching ? 'Vérification...' : 'Actualiser'}</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, styles.sessionActionButton]} onPress={() => router.push('/dashboard/payments')}>
                <Text style={styles.secondaryButtonText}>Voir paiements</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={dashboardStyles.sectionCard}>
          <Text style={dashboardStyles.sectionTitle}>Filtrer par catégorie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {categoryChips.map(chip => {
              const active = (selectedCategory || 'all') === chip.id
              return (
                <Pressable
                  key={chip.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(chip.id === 'all' ? '' : chip.id)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{chip.label}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>

        <View style={dashboardStyles.sectionCard}>
          <Text style={dashboardStyles.sectionTitle}>Options disponibles</Text>
          {optionsQuery.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
          {!optionsQuery.isLoading && (optionsQuery.data?.length ?? 0) === 0 ? (
            <Text style={dashboardStyles.empty}>Aucune option disponible pour cette catégorie.</Text>
          ) : null}
          {optionsQuery.data?.map(option => {
            const active = selectedOption?.id === option.id
            const included = option.isIncluded || option.price <= 0
            return (
              <Pressable
                key={option.id}
                style={[styles.optionCard, active && styles.optionCardActive]}
                onPress={() => setSelectedOption(option)}
              >
                <View style={styles.optionHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                  <View style={[styles.priceBadge, included ? styles.priceBadgeIncluded : styles.priceBadgePaid]}>
                    <Text style={[styles.priceBadgeText, included ? styles.priceBadgeTextIncluded : styles.priceBadgeTextPaid]}>
                      {included ? 'Inclus' : formatCurrency(option.price, option.currency)}
                    </Text>
                  </View>
                </View>
                <View style={styles.optionMeta}>
                  <Text style={styles.optionMetaText}>
                    Catégories: {option.categories.includes('all') ? 'Toutes' : option.categories.join(', ')}
                  </Text>
                  {option.monthlyLimit ? <Text style={styles.optionMetaText}>Limite mensuelle: {option.monthlyLimit}</Text> : null}
                </View>
                <Pressable
                  style={[styles.primaryButton, active && styles.primaryButtonActive]}
                  onPress={() => {
                    setSelectedOption(option)
                    setCheckoutOpen(true)
                  }}
                >
                  <Text style={styles.primaryButtonText}>{included ? 'Activer' : 'Choisir cette option'}</Text>
                </Pressable>
              </Pressable>
            )
          })}
        </View>

        <View style={dashboardStyles.sectionCard}>
          <Text style={dashboardStyles.sectionTitle}>Annonces éligibles</Text>
          {!selectedOption ? <Text style={dashboardStyles.empty}>Choisis d’abord une option pour voir les annonces compatibles.</Text> : null}
          {selectedOption && eligibleListings.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineText}>Aucune annonce publiée ne correspond à cette option pour le moment.</Text>
              <Pressable style={styles.ghostButton} onPress={() => router.push('/listings/new')}>
                <Text style={styles.ghostButtonText}>Publier une annonce</Text>
              </Pressable>
            </View>
          ) : null}
          {selectedOption && eligibleListings.length > 0 ? (
            <View style={styles.eligibleList}>
              {eligibleListings.slice(0, 4).map(item => {
                const active = item.id === selectedListingId
                return (
                  <Pressable key={item.id} style={[styles.listingRow, active && styles.listingRowActive]} onPress={() => setSelectedListingId(item.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listingTitle}>{item.title}</Text>
                      <Text style={styles.listingMeta}>
                        {item.category?.name ?? 'Sans catégorie'} • {item.location?.city ?? item.city ?? 'Cameroun'}
                      </Text>
                    </View>
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.muted} />
                  </Pressable>
                )
              })}
              {eligibleListings.length > 4 ? (
                <Text style={styles.moreHint}>+ {eligibleListings.length - 4} autres annonces disponibles dans le checkout.</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={dashboardStyles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={dashboardStyles.sectionTitle}>Historique des promotions</Text>
            <Pressable style={styles.inlineLink} onPress={() => router.push('/dashboard/payments')}>
              <Text style={styles.inlineLinkText}>Voir paiements</Text>
            </Pressable>
          </View>
          <TextInput
            value={historyQuery}
            onChangeText={setHistoryQuery}
            placeholder="Rechercher une promotion, annonce, ville..."
            placeholderTextColor={colors.placeholder}
            style={styles.historySearch}
          />
          <View style={styles.historyFilters}>
            {(['all', 'pending', 'completed', 'failed', 'refunded'] as const).map(status => (
              <Pressable
                key={status}
                style={[styles.historyChip, historyStatus === status && styles.historyChipActive]}
                onPress={() => setHistoryStatus(status)}
              >
                <Text style={[styles.historyChipText, historyStatus === status && styles.historyChipTextActive]}>
                  {status === 'all'
                    ? 'Tous'
                    : status === 'pending'
                      ? 'En attente'
                      : status === 'completed'
                        ? 'Actives'
                        : status === 'failed'
                          ? 'Échouées'
                          : 'Remboursées'}
                </Text>
              </Pressable>
            ))}
          </View>
          {invoicesQuery.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
          {!invoicesQuery.isLoading && historyPagination.visibleItems.length === 0 ? (
            <Text style={dashboardStyles.empty}>Aucune promotion enregistrée pour le moment.</Text>
          ) : null}
          <View style={styles.historyList}>
            {historyPagination.visibleItems.map(item => {
              const tone = promotionStatusTone(item.status)
              return (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyTitle}>{item.promotionLabel}</Text>
                      <Text style={styles.historySubtitle} numberOfLines={1}>
                        {item.listingTitle}
                      </Text>
                    </View>
                    <View style={[styles.historyStatusBadge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.historyStatusText, { color: tone.text }]}>{promotionStatusLabel(item.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.historyMetaGrid}>
                    <View style={styles.historyMetaCell}>
                      <Text style={styles.historyMetaLabel}>Montant</Text>
                      <Text style={styles.historyMetaValue}>{formatCurrency(Number(item.amount), item.currency)}</Text>
                    </View>
                    <View style={styles.historyMetaCell}>
                      <Text style={styles.historyMetaLabel}>Lancée le</Text>
                      <Text style={styles.historyMetaValue}>{formatDate(item.created_at)}</Text>
                    </View>
                    <View style={styles.historyMetaCell}>
                      <Text style={styles.historyMetaLabel}>Fin prévue</Text>
                      <Text style={styles.historyMetaValue}>{formatDate(item.metadata?.promotionEndsAt as string | undefined)}</Text>
                    </View>
                    <View style={styles.historyMetaCell}>
                      <Text style={styles.historyMetaLabel}>Zone</Text>
                      <Text style={styles.historyMetaValue}>{item.listingCity || 'Cameroun'}</Text>
                    </View>
                  </View>

                  <View style={styles.historyActions}>
                    {item.metadata?.listingId ? (
                      <Pressable
                        style={styles.ghostButton}
                        onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.metadata?.listingId as string } })}
                      >
                        <Text style={styles.ghostButtonText}>Voir l’annonce</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => router.push({ pathname: '/dashboard/payments/[id]', params: { id: item.id } })}
                    >
                      <Text style={styles.secondaryButtonText}>Voir paiement</Text>
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </View>
          {historyPagination.hasMore ? <LoadMoreButton onPress={historyPagination.loadMore} /> : null}
        </View>
      </ScreenScaffold>

      <Modal visible={checkoutOpen} transparent animationType="slide" onRequestClose={() => setCheckoutOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Finaliser la promotion</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedOption
                    ? `${selectedOption.title} • ${
                        selectedOption.isIncluded || selectedOption.price <= 0
                          ? 'Inclus'
                          : formatCurrency(selectedOption.price, selectedOption.currency)
                      }`
                    : 'Choisis ton annonce et ton moyen de paiement.'}
                </Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setCheckoutOpen(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.selectorLabel}>Annonce</Text>
              {eligibleListings.length ? (
                eligibleListings.map(item => {
                  const active = item.id === selectedListingId
                  return (
                    <Pressable key={item.id} style={[styles.selectorRow, active && styles.selectorRowActive]} onPress={() => setSelectedListingId(item.id)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectorTitle}>{item.title}</Text>
                        <Text style={styles.selectorMeta}>{item.category?.name ?? 'Sans catégorie'} • {item.location?.city ?? item.city ?? 'Cameroun'}</Text>
                      </View>
                      <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={active ? colors.primary : colors.muted} />
                    </Pressable>
                  )
                })
              ) : (
                <View style={styles.emptyInline}>
                  <Text style={styles.emptyInlineText}>
                    Aucune annonce éligible pour cette promotion. Publie d’abord une annonce.
                  </Text>
                  <Pressable style={styles.ghostButton} onPress={() => router.push('/listings/new')}>
                    <Text style={styles.ghostButtonText}>Créer une annonce</Text>
                  </Pressable>
                </View>
              )}

              {selectedOption && !(selectedOption.isIncluded || selectedOption.price <= 0) ? (
                <>
                  <Text style={[styles.selectorLabel, { marginTop: spacing.md }]}>Moyen de paiement</Text>
                  {mobileMoneyMethods.length ? (
                    mobileMoneyMethods.map(method => {
                      const active = method.id === selectedMethodId
                      return (
                        <Pressable
                          key={method.id}
                          style={[styles.selectorRow, active && styles.selectorRowActive]}
                          onPress={() => setSelectedMethodId(method.id)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.selectorTitle}>{buildMethodLabel(method)}</Text>
                            <Text style={styles.selectorMeta}>
                              {method.provider ?? method.type}
                              {method.isDefault ? ' • Par défaut' : ''}
                            </Text>
                          </View>
                          <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={active ? colors.primary : colors.muted} />
                        </Pressable>
                      )
                    })
                  ) : (
                    <View style={styles.emptyInline}>
                      <Text style={styles.emptyInlineText}>
                        Ajoute un compte MTN ou Orange Mobile Money pour finaliser cette mise en avant.
                      </Text>
                      <Pressable style={styles.ghostButton} onPress={() => router.push('/dashboard/payments')}>
                        <Text style={styles.ghostButtonText}>Gérer les paiements</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              ) : selectedOption ? (
                <View style={styles.infoInline}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.infoInlineText}>Aucun paiement requis pour cette promotion.</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.ghostButton} onPress={() => setCheckoutOpen(false)} disabled={checkoutMutation.isPending}>
                <Text style={styles.ghostButtonText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, !canCheckout && styles.disabledButton]}
                onPress={() => {
                  if (!selectedOption || !selectedListingId) return
                  const payload: CheckoutRequest = {
                    listingId: selectedListingId,
                    optionId: selectedOption.id
                  }
                  if (!(selectedOption.isIncluded || selectedOption.price <= 0) && selectedMethodId) {
                    payload.paymentMethodId = selectedMethodId
                  }
                  checkoutMutation.mutate(payload)
                }}
                disabled={!canCheckout || checkoutMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>{checkoutMutation.isPending ? 'Traitement...' : 'Confirmer'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  sessionCard: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primarySoftStrong
  },
  sessionHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start'
  },
  sessionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sessionTitle: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  sessionText: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  sessionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md
  },
  sessionActionButton: {
    flex: 1
  },
  chipsRow: {
    gap: spacing.sm
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  inlineLink: {
    paddingVertical: spacing.xs
  },
  inlineLinkText: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  filterChipActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  filterChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  filterChipTextActive: {
    color: colors.primary
  },
  optionCard: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.sm
  },
  optionCardActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySurface
  },
  optionHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start'
  },
  optionTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.body
  },
  optionDescription: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  priceBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  priceBadgeIncluded: {
    backgroundColor: colors.successSoft
  },
  priceBadgePaid: {
    backgroundColor: colors.accentSurface
  },
  priceBadgeText: {
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  priceBadgeTextIncluded: {
    color: colors.success
  },
  priceBadgeTextPaid: {
    color: colors.primary
  },
  optionMeta: {
    gap: 2
  },
  optionMetaText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    ...shadows.soft
  },
  primaryButtonActive: {
    backgroundColor: colors.primary
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accentSoftStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: typography.weightBold
  },
  ghostButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  ghostButtonText: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  eligibleList: {
    gap: spacing.sm
  },
  listingRow: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  listingRowActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  listingTitle: {
    color: colors.text,
    fontWeight: typography.weightSemibold
  },
  listingMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  moreHint: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: spacing.xs
  },
  emptyInline: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.sm
  },
  emptyInlineText: {
    color: colors.muted,
    fontSize: typography.bodySm
  },
  historySearch: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm
  },
  historyFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  historyChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  historyChipActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  historyChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  historyChipTextActive: {
    color: colors.primary
  },
  historyList: {
    gap: spacing.sm
  },
  historyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.sm
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  historyTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  historySubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  historyStatusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  historyStatusText: {
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  historyMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
    columnGap: spacing.md
  },
  historyMetaCell: {
    minWidth: '46%',
    flex: 1
  },
  historyMetaLabel: {
    color: colors.muted,
    fontSize: typography.caption
  },
  historyMetaValue: {
    marginTop: 2,
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  historyActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 18, 28, 0.42)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: typography.weightBlack
  },
  modalSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md
  },
  selectorLabel: {
    color: colors.text,
    fontWeight: typography.weightBold,
    marginBottom: spacing.sm
  },
  selectorRow: {
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  selectorRowActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  selectorTitle: {
    color: colors.text,
    fontWeight: typography.weightSemibold
  },
  selectorMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  infoInline: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.successSoftStrong,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  infoInlineText: {
    color: colors.success,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  disabledButton: {
    opacity: 0.5
  }
})
