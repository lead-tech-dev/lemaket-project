import { Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { deliveriesApi, type Delivery, type DeliveryStatus } from '@/features/deliveries/deliveries.api'
import { useSession } from '@/core/auth/session-context'
import { useClientPagination } from '@/core/pagination/useClientPagination'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

type DeliveryTab = 'mine' | 'available'
type DeliveryRoleFilter = 'buyer' | 'seller' | 'courier'

const statusLabels: Record<DeliveryStatus, string> = {
  requested: 'Demandée',
  accepted: 'Acceptée',
  picked_up: 'Retirée',
  delivered: 'Livrée',
  canceled: 'Annulée'
}

function formatMoney(amount: string | null, currency: string) {
  if (!amount) return '—'
  return `${Math.round(Number(amount)).toLocaleString('fr-FR')} ${currency}`
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

function escapeCsv(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildDeliveriesCsv(deliveries: Delivery[]) {
  const header = ['date', 'statut', 'annonce', 'mode', 'montant', 'devise']
  const rows = deliveries.map(item => [
    formatDate(item.created_at),
    statusLabels[item.status] ?? item.status,
    item.listing?.title ?? 'Course',
    item.handoverMode === 'delivery' ? 'Livraison' : 'Remise',
    String(item.price ?? ''),
    item.currency ?? 'XAF'
  ])
  return [header, ...rows].map(row => row.map(cell => escapeCsv(String(cell ?? ''))).join(',')).join('\n')
}

function formatMoneyAmount(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return `0 ${currency}`
  return `${Math.round(amount).toLocaleString('fr-FR')} ${currency}`
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}`
}

function deliveryNextAction(item: Delivery, role: DeliveryRoleFilter) {
  switch (item.status) {
    case 'requested':
      return role === 'buyer' ? 'Attente de confirmation et de prise en charge.' : role === 'seller' ? 'Paiement sécurisé lancé, prépare le colis.' : 'Course à accepter'
    case 'accepted':
      return role === 'courier' ? 'Récupère le colis auprès du vendeur.' : role === 'seller' ? 'Prépare le retrait du colis.' : 'Le livreur va retirer le colis.'
    case 'picked_up':
      return role === 'courier' ? 'Achemine le colis vers la destination.' : 'Le colis est en route.'
    case 'delivered':
      return role === 'buyer' ? 'Réception confirmée.' : role === 'seller' ? 'Paiement sécurisé à finaliser.' : 'Livraison terminée.'
    case 'canceled':
      return 'Livraison annulée.'
    default:
      return 'Suivre la livraison.'
  }
}

export default function DashboardDeliveriesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ tab?: string; role?: string; status?: string }>()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const [tab, setTab] = useState<DeliveryTab>('mine')
  const [roleFilter, setRoleFilter] = useState<DeliveryRoleFilter>('buyer')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [historyFilter, setHistoryFilter] = useState<'active' | 'completed'>('active')
  const isCourier = Boolean((user as { settings?: { isCourier?: boolean } } | null)?.settings?.isCourier)

  const mineQuery = useQuery({
    queryKey: ['deliveries', 'mine'],
    queryFn: () => deliveriesApi.mine()
  })

  const availableQuery = useQuery({
    queryKey: ['deliveries', 'available'],
    queryFn: () => deliveriesApi.available(),
    enabled: isCourier
  })

  const acceptMutation = useMutation({
    mutationFn: (id: string) => deliveriesApi.accept(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries', 'mine'] })
      queryClient.invalidateQueries({ queryKey: ['deliveries', 'available'] })
    }
  })

  const deliveries = useMemo(
    () => (tab === 'mine' ? mineQuery.data ?? [] : availableQuery.data ?? []),
    [tab, mineQuery.data, availableQuery.data]
  )
  const courierDeliveries = useMemo(() => {
    if (!user?.id) return []
    return (mineQuery.data ?? []).filter(item => item.courier?.id === user.id)
  }, [mineQuery.data, user?.id])
  const filteredCourierHistory = useMemo(() => {
    if (historyFilter === 'completed') {
      return courierDeliveries.filter(item => item.status === 'delivered')
    }
    return courierDeliveries.filter(item => item.status !== 'delivered' && item.status !== 'canceled')
  }, [courierDeliveries, historyFilter])
  const courierMonthlySummary = useMemo(() => {
    const now = new Date()
    const currentMonthKey = getMonthKey(now)
    const deliveredThisMonth = courierDeliveries.filter(item => {
      if (item.status !== 'delivered' || !item.deliveredAt) return false
      const date = new Date(item.deliveredAt)
      if (Number.isNaN(date.getTime())) return false
      return getMonthKey(date) === currentMonthKey
    })
    const totals = new Map<string, number>()
    deliveredThisMonth.forEach(item => {
      const value = Number(item.price ?? 0)
      const currency = item.currency || 'XAF'
      if (!Number.isFinite(value)) return
      totals.set(currency, (totals.get(currency) ?? 0) + value)
    })
    return {
      deliveredCount: deliveredThisMonth.length,
      totals
    }
  }, [courierDeliveries])
  const visibleDeliveries = useMemo(() => {
    if (tab === 'available') {
      return deliveries
    }
    return deliveries.filter(item => {
      if (!user?.id) return true
      if (roleFilter === 'buyer') return item.buyer.id === user.id
      if (roleFilter === 'seller') return item.seller.id === user.id
      return item.courier?.id === user.id
    })
  }, [deliveries, roleFilter, tab, user?.id])
  const availableStatuses = useMemo(() => Array.from(new Set(visibleDeliveries.map(item => item.status))), [visibleDeliveries])
  const filteredDeliveries = useMemo(
    () => visibleDeliveries.filter(item => statusFilter === 'all' || item.status === statusFilter),
    [statusFilter, visibleDeliveries]
  )
  const pagination = useClientPagination(filteredDeliveries, 8, `${tab}-${roleFilter}-${statusFilter}`)

  useEffect(() => {
    if (params.tab === 'mine' || params.tab === 'available') {
      setTab(params.tab)
    }
    if (params.role === 'buyer' || params.role === 'seller' || params.role === 'courier') {
      setRoleFilter(params.role)
    }
    if (typeof params.status === 'string' && params.status) {
      setStatusFilter(params.status)
    }
  }, [params.role, params.status, params.tab])

  return (
    <ScreenScaffold title="Livraisons" subtitle="Gérez vos demandes et courses en cours.">
      <View style={dashboardStyles.sectionCard}>
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === 'mine' && styles.tabActive]} onPress={() => setTab('mine')}>
            <Text style={[styles.tabLabel, tab === 'mine' && styles.tabLabelActive]}>Mes livraisons</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'available' && styles.tabActive, !isCourier && styles.tabDisabled]}
            onPress={() => setTab('available')}
            disabled={!isCourier}
          >
            <Text style={[styles.tabLabel, tab === 'available' && styles.tabLabelActive]}>Courses disponibles</Text>
          </Pressable>
        </View>

        {tab === 'mine' ? (
          <View style={styles.roleTabs}>
            {([
              ['buyer', 'Acheteur'],
              ['seller', 'Vendeur'],
              ['courier', 'Livreur']
            ] as const).map(([value, label]) => {
              const disabled = value === 'courier' && !isCourier
              const selected = roleFilter === value
              return (
                <Pressable
                  key={value}
                  style={[styles.roleTab, selected && styles.roleTabActive, disabled && styles.tabDisabled]}
                  onPress={() => setRoleFilter(value)}
                  disabled={disabled}
                >
                  <Text style={[styles.roleTabText, selected && styles.roleTabTextActive]}>{label}</Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}

        {tab === 'mine' ? (
          isCourier ? (
            <>
              {roleFilter !== 'courier' ? (
                <View style={styles.summaryHint}>
                  <Text style={styles.summaryHintText}>
                    Passe en vue « Livreur » pour voir l’historique des courses et les revenus.
                  </Text>
                  <Pressable style={styles.summaryHintButton} onPress={() => setRoleFilter('courier')}>
                    <Text style={styles.summaryHintButtonText}>Afficher</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryTitle}>Historique des courses</Text>
                  {mineQuery.isLoading ? <Text style={styles.summaryMeta}>Chargement...</Text> : null}
                </View>
                <View style={styles.historyTabs}>
                  {(['active', 'completed'] as const).map(value => {
                    const selected = historyFilter === value
                    return (
                      <Pressable
                        key={value}
                        style={[styles.historyTab, selected && styles.historyTabActive]}
                        onPress={() => setHistoryFilter(value)}
                      >
                        <Text style={[styles.historyTabText, selected && styles.historyTabTextActive]}>
                          {value === 'active' ? 'En cours' : 'Terminées'}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                {filteredCourierHistory.length === 0 ? (
                  <Text style={styles.summaryEmpty}>
                    {historyFilter === 'completed'
                      ? 'Aucune course terminée pour le moment.'
                      : 'Aucune course en cours pour le moment.'}
                  </Text>
                ) : (
                  <View style={styles.historyList}>
                    {filteredCourierHistory.slice(0, 5).map(delivery => (
                      <View key={delivery.id} style={styles.historyRow}>
                        <View style={styles.historyContent}>
                          <Text style={styles.historyTitle} numberOfLines={1}>
                            {delivery.listing?.title ?? 'Course'}
                          </Text>
                          <Text style={styles.historyMeta}>
                            {statusLabels[delivery.status] ?? delivery.status} • {formatDate(delivery.created_at)}
                          </Text>
                        </View>
                        <View style={styles.historyBadge}>
                          <Text style={styles.historyBadgeText}>
                            {delivery.handoverMode === 'delivery' ? 'Livraison' : 'Remise'}
                          </Text>
                        </View>
                      </View>
                    ))}
                    <Pressable
                      style={styles.historyLink}
                      onPress={async () => {
                        try {
                          const csv = buildDeliveriesCsv(filteredCourierHistory)
                          await Share.share({ message: csv, title: 'Courses livreur' })
                        } catch (error) {
                          Alert.alert('Export CSV', error instanceof Error ? error.message : 'Impossible de partager le CSV.')
                        }
                      }}
                    >
                      <Text style={styles.historyLinkText}>Exporter CSV</Text>
                      <Ionicons name="download-outline" size={16} color={colors.accent} />
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryTitle}>Revenus du mois</Text>
                  <Text style={styles.summaryMeta}>{courierMonthlySummary.deliveredCount} livraison(s)</Text>
                </View>
                {courierMonthlySummary.deliveredCount === 0 ? (
                  <Text style={styles.summaryEmpty}>Aucune livraison terminée ce mois-ci.</Text>
                ) : (
                  <View style={styles.earningsList}>
                    {Array.from(courierMonthlySummary.totals.entries()).map(([currency, total]) => (
                      <View key={currency} style={styles.earningsRow}>
                        <Text style={styles.earningsLabel}>Total</Text>
                        <Text style={styles.earningsValue}>{formatMoneyAmount(total, currency)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryTitle}>Historique des courses</Text>
                </View>
                <Text style={styles.summaryEmpty}>
                  Active le mode livreur pour suivre tes courses et exporter ton historique.
                </Text>
                <Pressable style={styles.primaryButton} onPress={() => router.push('/dashboard/courier')}>
                  <Text style={styles.primaryButtonText}>Activer le mode livreur</Text>
                </Pressable>
              </View>
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryTitle}>Revenus du mois</Text>
                </View>
                <Text style={styles.summaryEmpty}>
                  Les revenus s’afficheront dès que tu auras livré tes premières courses.
                </Text>
              </View>
            </>
          )
        ) : null}

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', ...availableStatuses]}
          keyExtractor={item => item}
          contentContainerStyle={styles.statusFilters}
          renderItem={({ item }) => {
            const selected = statusFilter === item
            return (
              <Pressable
                style={[styles.statusChip, selected && styles.statusChipActive]}
                onPress={() => setStatusFilter(item)}
              >
                <Text style={[styles.statusChipText, selected && styles.statusChipTextActive]}>
                  {item === 'all' ? 'Tous les statuts' : statusLabels[item as DeliveryStatus] ?? item}
                </Text>
              </Pressable>
            )
          }}
        />

        {!isCourier && tab === 'available' ? (
          <Text style={dashboardStyles.empty}>Active le mode livreur dans Paramètres pour voir les courses.</Text>
        ) : null}

        {(tab === 'mine' ? mineQuery.isLoading : availableQuery.isLoading) ? (
          <Text style={dashboardStyles.empty}>Chargement...</Text>
        ) : null}

        <FlatList
          scrollEnabled={false}
          data={pagination.visibleItems}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <Text style={dashboardStyles.empty}>
              {statusFilter === 'all'
                ? `Aucune livraison ${tab === 'available' ? 'disponible' : 'dans cette vue'} pour le moment.`
                : 'Aucune livraison pour ce statut.'}
            </Text>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListFooterComponent={pagination.hasMore ? <LoadMoreButton onPress={pagination.loadMore} /> : null}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push({ pathname: '/dashboard/deliveries/[id]', params: { id: item.id } })}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                    {item.listing?.title ?? 'Annonce'}
                  </Text>
                  <Text style={styles.meta}>
                    {tab === 'available'
                      ? `${item.pickupAddress ?? 'Départ non défini'} → ${item.dropoffAddress ?? 'Arrivée non définie'}`
                      : roleFilter === 'buyer'
                        ? `Vendeur: ${[item.seller.firstName, item.seller.lastName].filter(Boolean).join(' ') || '—'}`
                        : roleFilter === 'seller'
                          ? `Acheteur: ${[item.buyer.firstName, item.buyer.lastName].filter(Boolean).join(' ') || '—'}`
                          : `Acheteur: ${[item.buyer.firstName, item.buyer.lastName].filter(Boolean).join(' ') || '—'}`}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.status}>{statusLabels[item.status] ?? item.status}</Text>
                </View>
              </View>

              <View style={styles.inlineMetaRow}>
                <View style={styles.inlineMeta}>
                  <Ionicons
                    name={item.handoverMode === 'pickup' ? 'hand-left-outline' : 'cube-outline'}
                    size={15}
                    color={colors.accent}
                  />
                  <Text style={styles.inlineMetaText}>
                    {item.handoverMode === 'pickup' ? 'Remise' : 'Livraison'}
                  </Text>
                </View>
                <View style={styles.inlineMeta}>
                  <Ionicons name="calendar-outline" size={15} color={colors.muted} />
                  <Text style={styles.inlineMetaText}>{formatDate(item.created_at)}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.amount}>Prix: {formatMoney(item.price, item.currency)}</Text>
                <Text style={styles.nextAction}>{deliveryNextAction(item, roleFilter)}</Text>
              </View>

              {tab === 'available' ? (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => acceptMutation.mutate(item.id)}
                  disabled={acceptMutation.isPending}
                >
                  <Text style={styles.primaryButtonText}>Accepter la course</Text>
                </Pressable>
              ) : null}
              {tab === 'mine' ? (
                <View style={styles.inlineActions}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={async () => {
                      try {
                        const res = await deliveriesApi.pickupCode(item.id)
                        Alert.alert('Code de remise', `Code: ${res.code}`)
                      } catch (err) {
                        Alert.alert('Livraison', err instanceof Error ? err.message : 'Action impossible.')
                      }
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Code remise</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={async () => {
                      try {
                        await deliveriesApi.sendDeliveryCode(item.id)
                        Alert.alert('Livraison', 'Le code de réception a été envoyé.')
                      } catch (err) {
                        Alert.alert('Livraison', err instanceof Error ? err.message : 'Action impossible.')
                      }
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Code réception</Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      </View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  roleTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  tabDisabled: {
    opacity: 0.5
  },
  tabLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  tabLabelActive: {
    color: colors.primary
  },
  roleTab: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  roleTabActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  roleTabText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  roleTabTextActive: {
    color: colors.primary
  },
  statusFilters: {
    gap: spacing.sm,
    paddingRight: spacing.md,
    marginBottom: spacing.sm
  },
  statusChip: {
    minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusChipActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  statusChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  statusChipTextActive: {
    color: colors.primary
  },
  summaryCard: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  summaryTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  summaryMeta: {
    color: colors.muted,
    fontSize: typography.caption
  },
  summaryEmpty: {
    color: colors.muted,
    fontSize: typography.caption
  },
  summaryHint: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accentOutline,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  summaryHintText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.caption
  },
  summaryHintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  summaryHintButtonText: {
    color: colors.accent,
    fontWeight: typography.weightSemibold
  },
  historyTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  historyTab: {
    minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  historyTabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  historyTabText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  historyTabTextActive: {
    color: colors.primary
  },
  historyList: {
    gap: spacing.sm
  },
  historyRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  historyContent: {
    flex: 1,
    gap: 2
  },
  historyTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  historyMeta: {
    color: colors.muted,
    fontSize: typography.caption
  },
  historyBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  historyBadgeText: {
    color: colors.accent,
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  historyLink: {
    marginTop: spacing.xs,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentOutline,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  historyLinkText: {
    color: colors.accent,
    fontWeight: typography.weightSemibold
  },
  earningsList: {
    gap: spacing.sm
  },
  earningsRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  earningsLabel: {
    color: colors.muted,
    fontSize: typography.caption
  },
  earningsValue: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.sm
  },
  cardHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start'
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  inlineMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  inlineMetaText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md
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
  primaryButton: {
    marginTop: spacing.sm,
    minHeight: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  inlineActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs
  },
  secondaryButton: {
    flex: 1,
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  amount: {
    color: colors.text,
    fontWeight: typography.weightSemibold
  },
  nextAction: {
    flex: 1,
    textAlign: 'right',
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  status: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  }
})
