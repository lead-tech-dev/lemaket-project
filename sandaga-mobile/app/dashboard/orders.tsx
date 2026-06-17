import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { ordersApi } from '@/features/orders/orders.api'
import { useSession } from '@/core/auth/session-context'
import { useClientPagination } from '@/core/pagination/useClientPagination'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

const statusLabels: Record<string, string> = {
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

type OrderScope = 'purchases' | 'sales'

function formatMoney(amount: string, currency: string) {
  return `${Math.round(Number(amount || 0)).toLocaleString('fr-FR')} ${currency}`
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

function nextActionLabel(status: string, scope: OrderScope) {
  switch (status) {
    case 'pending':
      return scope === 'purchases' ? 'Paiement à finaliser' : 'Attente du paiement'
    case 'paid':
    case 'paid_waiting_delivery':
      return scope === 'purchases' ? 'Remise / livraison à organiser' : 'Préparer l’article'
    case 'courier_assigned':
      return scope === 'purchases' ? 'Livreur assigné' : 'Retrait en préparation'
    case 'picked_up':
    case 'in_transit':
      return scope === 'purchases' ? 'Colis en transit' : 'Livraison en cours'
    case 'delivered':
      return scope === 'purchases' ? 'Réception confirmée' : 'Paiement à libérer'
    case 'completed':
      return 'Commande terminée'
    case 'cancelled':
      return 'Commande annulée'
    default:
      return 'Suivre la commande'
  }
}

export default function DashboardOrdersScreen() {
  const router = useRouter()
  const { user } = useSession()
  const [scope, setScope] = useState<OrderScope>('purchases')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const query = useQuery({
    queryKey: ['orders', 'mine'],
    queryFn: () => ordersApi.mine()
  })
  const scopedOrders = useMemo(() => {
    const orders = query.data ?? []
    if (!user?.id) return orders
    return orders.filter(item => (scope === 'purchases' ? item.buyer?.id === user.id : item.seller?.id === user.id))
  }, [query.data, scope, user?.id])
  const availableStatuses = useMemo(
    () => Array.from(new Set(scopedOrders.map(item => item.status))),
    [scopedOrders]
  )
  const filteredOrders = useMemo(
    () => scopedOrders.filter(item => statusFilter === 'all' || item.status === statusFilter),
    [scopedOrders, statusFilter]
  )
  const pagination = useClientPagination(filteredOrders, 8)

  return (
    <ScreenScaffold title="Commandes" subtitle="Suivez vos achats et ventes sécurisées.">
      <View style={[dashboardStyles.sectionCard, styles.filtersCard]}>
        <View style={styles.scopeTabs}>
          <Pressable style={[styles.scopeTab, scope === 'purchases' && styles.scopeTabActive]} onPress={() => setScope('purchases')}>
            <Text style={[styles.scopeTabText, scope === 'purchases' && styles.scopeTabTextActive]}>Achats</Text>
          </Pressable>
          <Pressable style={[styles.scopeTab, scope === 'sales' && styles.scopeTabActive]} onPress={() => setScope('sales')}>
            <Text style={[styles.scopeTabText, scope === 'sales' && styles.scopeTabTextActive]}>Ventes</Text>
          </Pressable>
        </View>

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
                  {item === 'all' ? 'Tous les statuts' : statusLabels[item] ?? item}
                </Text>
              </Pressable>
            )
          }}
        />
      </View>

      <View style={dashboardStyles.sectionCard}>
        {query.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        {!query.isLoading && filteredOrders.length === 0 ? (
          <Text style={dashboardStyles.empty}>
            {statusFilter === 'all'
              ? `Aucune ${scope === 'purchases' ? 'commande acheteur' : 'commande vendeur'} pour le moment.`
              : 'Aucune commande pour ce statut.'}
          </Text>
        ) : null}
        <FlatList
          scrollEnabled={false}
          data={pagination.visibleItems}
          keyExtractor={item => item.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListFooterComponent={pagination.hasMore ? <LoadMoreButton onPress={pagination.loadMore} /> : null}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push({ pathname: '/dashboard/orders/[id]', params: { id: item.id } })}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                    {item.listing?.title ?? 'Annonce'}
                  </Text>
                  <Text style={styles.meta}>
                    {scope === 'purchases'
                      ? `Vendeur: ${[item.seller?.firstName, item.seller?.lastName].filter(Boolean).join(' ') || '—'}`
                      : `Acheteur: ${[item.buyer?.firstName, item.buyer?.lastName].filter(Boolean).join(' ') || '—'}`}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.status}>{statusLabels[item.status] ?? item.status}</Text>
                </View>
              </View>

              <View style={styles.cardMetaRow}>
                <View style={styles.inlineMeta}>
                  <Ionicons
                    name={item.handoverMode === 'delivery' ? 'cube-outline' : 'hand-left-outline'}
                    size={15}
                    color={colors.accent}
                  />
                  <Text style={styles.inlineMetaText}>
                    {item.handoverMode === 'delivery' ? 'Livraison' : 'Remise'}
                  </Text>
                </View>
                <View style={styles.inlineMeta}>
                  <Ionicons name="calendar-outline" size={15} color={colors.muted} />
                  <Text style={styles.inlineMetaText}>{formatDate(item.created_at)}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.amount}>Total: {formatMoney(item.totalAmount, item.currency)}</Text>
                <Text style={styles.nextAction}>{nextActionLabel(item.status, scope)}</Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.sm
  },
  filtersCard: {
    paddingBottom: spacing.sm
  },
  scopeTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  scopeTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scopeTabActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  scopeTabText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  scopeTabTextActive: {
    color: colors.primary
  },
  statusFilters: {
    gap: spacing.sm,
    paddingRight: spacing.md
  },
  statusChip: {
    minHeight: 36,
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
  cardMetaRow: {
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
  amount: {
    color: colors.text,
    fontWeight: typography.weightSemibold
  },
  nextAction: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightBold,
    textAlign: 'right'
  },
  status: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  }
})
