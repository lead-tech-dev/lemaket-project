import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@/core/auth/session-context'
import { ordersApi, type Order, type OrderStatus } from '@/features/orders/orders.api'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() ?? ''
const MAPBOX_STYLE_ID = 'mapbox/streets-v12'
const DEFAULT_CENTER = { lat: 4.0511, lng: 11.5021 }

const statusLabels: Record<OrderStatus, string> = {
  pending: 'En attente de paiement',
  paid: 'Payée',
  paid_waiting_delivery: 'Payée, en attente de livraison',
  courier_assigned: 'Livreur assigné',
  picked_up: 'Colis récupéré',
  in_transit: 'En transit',
  delivered: 'Livrée',
  completed: 'Terminée',
  cancelled: 'Annulée'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return value
  }
}

function formatMoney(amount?: string | number | null, currency = 'XAF') {
  const numeric = Number(amount ?? 0)
  if (!Number.isFinite(numeric)) return `— ${currency}`
  return `${Math.round(numeric).toLocaleString('fr-FR')} ${currency}`
}

function buildTimeline(order: {
  created_at: string
  status: OrderStatus
  paidAt?: string | null
  delivery?: {
    status: string
    acceptedAt?: string | null
    pickedUpAt?: string | null
    deliveredAt?: string | null
  } | null
  completedAt?: string | null
  cancelledAt?: string | null
}) {
  return [
    { key: 'created', label: 'Commande créée', date: order.created_at, done: true },
    { key: 'paid', label: 'Paiement confirmé', date: order.paidAt, done: Boolean(order.paidAt) },
    {
      key: 'accepted',
      label: 'Livreur assigné / remise préparée',
      date: order.delivery?.acceptedAt,
      done: Boolean(order.delivery?.acceptedAt) || order.delivery?.status === 'accepted'
    },
    {
      key: 'picked_up',
      label: 'Colis récupéré',
      date: order.delivery?.pickedUpAt,
      done: Boolean(order.delivery?.pickedUpAt) || order.status === 'picked_up' || order.status === 'in_transit'
    },
    {
      key: 'delivered',
      label: 'Commande livrée',
      date: order.delivery?.deliveredAt,
      done: Boolean(order.delivery?.deliveredAt) || order.status === 'delivered' || order.status === 'completed'
    },
    { key: 'completed', label: 'Commande terminée', date: order.completedAt, done: Boolean(order.completedAt) },
    { key: 'cancelled', label: 'Commande annulée', date: order.cancelledAt, done: Boolean(order.cancelledAt) }
  ]
}

function getDeliveryMapZoom(distanceKm?: number | null) {
  if (!distanceKm || distanceKm <= 0) return 11
  if (distanceKm <= 3) return 13
  if (distanceKm <= 8) return 12
  if (distanceKm <= 20) return 11
  return 10
}

function buildOrderDeliveryMapUrl(order: Order) {
  const delivery = order.delivery
  if (!MAPBOX_TOKEN || !delivery) return null

  const pickupReady = typeof delivery.pickupLat === 'number' && typeof delivery.pickupLng === 'number'
  const dropoffReady = typeof delivery.dropoffLat === 'number' && typeof delivery.dropoffLng === 'number'
  const pickup = pickupReady ? { lat: delivery.pickupLat as number, lng: delivery.pickupLng as number } : null
  const dropoff = dropoffReady ? { lat: delivery.dropoffLat as number, lng: delivery.dropoffLng as number } : null
  const center =
    pickup && dropoff
      ? { lat: (pickup.lat + dropoff.lat) / 2, lng: (pickup.lng + dropoff.lng) / 2 }
      : pickup ?? dropoff ?? DEFAULT_CENTER

  const markers = [
    pickup ? `pin-s-warehouse+0f60c4(${pickup.lng},${pickup.lat})` : null,
    dropoff ? `pin-s-home+f97316(${dropoff.lng},${dropoff.lat})` : null
  ]
    .filter(Boolean)
    .join(',')

  const markerSegment = markers ? `${markers}/` : ''
  return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE_ID}/static/${markerSegment}${center.lng},${center.lat},${getDeliveryMapZoom(delivery.distanceKm)},0/1200x680?access_token=${MAPBOX_TOKEN}`
}

function nextStepLabel(status: OrderStatus, role: 'buyer' | 'seller') {
  switch (status) {
    case 'pending':
      return role === 'buyer' ? 'Finalise le paiement pour confirmer la commande.' : 'En attente du paiement de l’acheteur.'
    case 'paid':
    case 'paid_waiting_delivery':
      return role === 'buyer' ? 'Le paiement est sécurisé. La remise ou la livraison va être organisée.' : 'Prépare l’article, un livreur ou une remise sera bientôt confirmé.'
    case 'courier_assigned':
      return role === 'buyer' ? 'Un livreur a été assigné. Suis la course jusqu’au retrait du colis.' : 'Le livreur est assigné. Prépare le retrait du colis.'
    case 'picked_up':
    case 'in_transit':
      return role === 'buyer' ? 'Le colis est en cours d’acheminement.' : 'Le colis est parti, attends la confirmation de réception.'
    case 'delivered':
      return role === 'buyer' ? 'La commande est livrée. La clôture va suivre.' : 'La livraison est terminée. Le paiement sécurisé peut être libéré.'
    case 'completed':
      return 'Cette commande est terminée.'
    case 'cancelled':
      return 'Cette commande a été annulée.'
    default:
      return 'Suis l’évolution de la commande depuis cet écran.'
  }
}

export default function OrderDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useSession()
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id

  const orderQuery = useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => ordersApi.byId(id as string),
    enabled: Boolean(id)
  })

  const order = orderQuery.data

  if (!id) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Commande introuvable.</Text>
      </View>
    )
  }

  if (orderQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  if (orderQuery.isError || !order) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Impossible de charger cette commande.</Text>
      </View>
    )
  }

  const timeline = buildTimeline(order)
  const role = user?.id && order.seller?.id === user.id ? 'seller' : 'buyer'
  const nextStep = nextStepLabel(order.status, role)
  const orderMapUrl = buildOrderDeliveryMapUrl(order)

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Détail commande
        </Text>
        <Pressable style={styles.headerButton} onPress={() => orderQuery.refetch()}>
          <Ionicons name="refresh-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, 96) }]}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{order.listing?.title ?? 'Annonce'}</Text>
              <Text style={styles.heroSub}>Commande #{order.id.slice(0, 8)}</Text>
            </View>
            <View style={[styles.statusBadge, order.status === 'completed' ? styles.statusSuccess : order.status === 'cancelled' ? styles.statusDanger : styles.statusPrimary]}>
              <Text
                style={[
                  styles.statusBadgeText,
                  order.status === 'completed' ? styles.statusSuccessText : order.status === 'cancelled' ? styles.statusDangerText : styles.statusPrimaryText
                ]}
              >
                {statusLabels[order.status]}
              </Text>
            </View>
          </View>

          <View style={styles.heroMetaGrid}>
            <View style={styles.heroMetaCell}>
              <Text style={styles.heroMetaLabel}>Mode</Text>
              <Text style={styles.heroMetaValue}>{order.handoverMode === 'delivery' ? 'Livraison' : 'Remise en main propre'}</Text>
            </View>
            <View style={styles.heroMetaCell}>
              <Text style={styles.heroMetaLabel}>Total</Text>
              <Text style={styles.heroMetaValue}>{formatMoney(order.totalAmount, order.currency)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, styles.nextStepCard]}>
          <View style={styles.nextStepIcon}>
            <Ionicons name={order.status === 'completed' ? 'checkmark-done-outline' : order.status === 'cancelled' ? 'close-circle-outline' : 'trail-sign-outline'} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Prochaine étape</Text>
            <Text style={styles.nextStepText}>{nextStep}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Acheteur</Text>
            <Text style={styles.infoValue}>{[order.buyer?.firstName, order.buyer?.lastName].filter(Boolean).join(' ') || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vendeur</Text>
            <Text style={styles.infoValue}>{[order.seller?.firstName, order.seller?.lastName].filter(Boolean).join(' ') || '—'}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Récapitulatif</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Annonce</Text>
            <Text style={styles.infoValue}>{formatMoney(order.listingAmount, order.currency)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Livraison</Text>
            <Text style={styles.infoValue}>{formatMoney(order.deliveryAmount, order.currency)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Frais plateforme</Text>
            <Text style={styles.infoValue}>{formatMoney(order.platformFee, order.currency)}</Text>
          </View>
          <View style={[styles.infoRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(order.totalAmount, order.currency)}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Article(s)</Text>
          <View style={styles.itemsList}>
            {order.items?.length ? (
              order.items.map(item => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemMeta}>Quantité: {item.quantity}</Text>
                  </View>
                  <Text style={styles.itemAmount}>{formatMoney(item.unitPrice, item.currency)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Aucun article détaillé disponible.</Text>
            )}
          </View>
        </View>

        {order.delivery ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Livraison / remise</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Statut</Text>
              <Text style={styles.infoValue}>{statusLabels[order.status]}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Départ</Text>
              <Text style={styles.infoValue}>{order.delivery.pickupAddress || 'Non renseigné'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Arrivée</Text>
              <Text style={styles.infoValue}>{order.delivery.dropoffAddress || 'Non renseigné'}</Text>
            </View>
            {order.delivery.dropoffNotes ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Précisions</Text>
                <Text style={styles.infoValue}>{order.delivery.dropoffNotes}</Text>
              </View>
            ) : null}
            {typeof order.delivery.distanceKm === 'number' ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Distance</Text>
                <Text style={styles.infoValue}>{order.delivery.distanceKm.toFixed(1)} km</Text>
              </View>
            ) : null}
            {orderMapUrl ? (
              <View style={styles.mapCard}>
                <Image source={{ uri: orderMapUrl }} style={styles.mapImage} resizeMode="cover" />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {timeline.map((step, index) => (
            <View key={step.key} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineBullet, step.done && styles.timelineBulletDone]}>
                  {step.done ? <Ionicons name="checkmark" size={12} color={colors.white} /> : null}
                </View>
                {index < timeline.length - 1 ? <View style={[styles.timelineLine, step.done && styles.timelineLineDone]} /> : null}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{step.label}</Text>
                <Text style={styles.timelineDate}>{formatDate(step.date)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Dates clés</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Créée le</Text>
            <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payée le</Text>
            <Text style={styles.infoValue}>{formatDate(order.paidAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Terminée le</Text>
            <Text style={styles.infoValue}>{formatDate(order.completedAt)}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {order.listing?.id ? (
            <Pressable style={styles.secondaryButton} onPress={() => router.push({ pathname: '/listings/[id]', params: { id: order.listing?.id as string } })}>
              <Text style={styles.secondaryButtonText}>Voir l’annonce</Text>
            </Pressable>
          ) : null}
          {order.delivery?.id ? (
            <Pressable style={styles.primaryButton} onPress={() => router.push({ pathname: '/dashboard/deliveries/[id]', params: { id: order.delivery?.id as string } })}>
              <Text style={styles.primaryButtonText}>Voir la livraison</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl
  },
  errorText: {
    color: colors.text,
    fontSize: typography.body,
    textAlign: 'center'
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold,
    textAlign: 'center'
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md
  },
  heroCard: {
    borderWidth: 1,
    borderColor: colors.accentSoftStrong,
    borderRadius: radius.xl,
    backgroundColor: colors.accentSurface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.soft
  },
  heroTop: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start'
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightBlack
  },
  heroSub: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  statusPrimary: {
    backgroundColor: colors.surface
  },
  statusSuccess: {
    backgroundColor: colors.successSoft
  },
  statusDanger: {
    backgroundColor: colors.dangerSurface
  },
  statusBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  statusPrimaryText: {
    color: colors.accent
  },
  statusSuccessText: {
    color: colors.success
  },
  statusDangerText: {
    color: colors.danger
  },
  heroMetaGrid: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  heroMetaCell: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md
  },
  heroMetaLabel: {
    color: colors.muted,
    fontSize: typography.caption
  },
  heroMetaValue: {
    marginTop: 2,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.soft
  },
  nextStepCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.primarySurface,
    borderColor: colors.primarySoftStrong
  },
  nextStepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  nextStepText: {
    color: colors.text,
    fontSize: typography.bodySm,
    lineHeight: 20
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold,
    marginBottom: spacing.md
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  infoLabel: {
    color: colors.muted,
    fontSize: typography.bodySm
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  totalRow: {
    marginTop: spacing.xs
  },
  totalLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  totalValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: typography.weightBlack
  },
  itemsList: {
    gap: spacing.sm
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md
  },
  itemTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  itemMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  itemAmount: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.bodySm
  },
  mapCard: {
    marginTop: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised
  },
  mapImage: {
    width: '100%',
    height: 176,
    backgroundColor: colors.surfaceRaised
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    minHeight: 52
  },
  timelineRail: {
    width: 24,
    alignItems: 'center'
  },
  timelineBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  timelineBulletDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    marginTop: spacing.xs,
    backgroundColor: colors.borderStrong
  },
  timelineLineDone: {
    backgroundColor: colors.primary
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  timelineTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  timelineDate: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    ...shadows.soft
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  }
})
