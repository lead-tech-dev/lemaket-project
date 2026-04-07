import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@/core/auth/session-context'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import { deliveriesApi, type Delivery } from '@/features/deliveries/deliveries.api'

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() ?? ''
const MAPBOX_STYLE_ID = 'mapbox/streets-v12'
const DEFAULT_CENTER = { lat: 4.0511, lng: 11.5021 }

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

function formatPrice(amount?: string | null, currency = 'XAF') {
  const numeric = Number(amount ?? 0)
  if (!Number.isFinite(numeric) || numeric <= 0) return '—'
  return `${Math.round(numeric).toLocaleString('fr-FR')} ${currency}`
}

function deliveryStatusLabel(status: Delivery['status']) {
  switch (status) {
    case 'requested':
      return 'Demandée'
    case 'accepted':
      return 'Acceptée'
    case 'picked_up':
      return 'Retirée'
    case 'delivered':
      return 'Livrée'
    case 'canceled':
      return 'Annulée'
    default:
      return status
  }
}

function escrowStatusLabel(status?: Delivery['escrowStatus']) {
  switch (status) {
    case 'none':
      return 'Non initié'
    case 'pending':
      return 'Paiement en attente'
    case 'held':
      return 'Paiement retenu'
    case 'released':
      return 'Paiement libéré'
    case 'refunded':
      return 'Paiement remboursé'
    default:
      return '—'
  }
}

function escrowStatusTone(status?: Delivery['escrowStatus']) {
  switch (status) {
    case 'pending':
      return { bg: colors.warningSoft, text: colors.warning }
    case 'held':
      return { bg: colors.primarySoft, text: colors.primary }
    case 'released':
      return { bg: colors.successSoft, text: colors.success }
    case 'refunded':
      return { bg: colors.dangerSurface, text: colors.danger }
    case 'none':
      return { bg: colors.surfaceMuted, text: colors.muted }
    default:
      return { bg: colors.surfaceMuted, text: colors.muted }
  }
}

function escrowStatusDescription(status?: Delivery['escrowStatus']) {
  switch (status) {
    case 'none':
      return 'Le paiement sécurisé n’a pas encore été lancé. L’acheteur doit initier le paiement sécurisé.'
    case 'pending':
      return 'Le paiement est en attente de confirmation. Tu peux relancer la transaction si besoin.'
    case 'held':
      return 'Le paiement est sécurisé et retenu jusqu’à la livraison.'
    case 'released':
      return 'Le paiement a été libéré au vendeur.'
    case 'refunded':
      return 'Le paiement a été remboursé à l’acheteur.'
    default:
      return 'Statut du paiement indisponible pour le moment.'
  }
}

function nameOf(person?: { firstName: string; lastName: string } | null) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ') || '—'
}

function buildTimeline(delivery: Delivery) {
  return [
    { key: 'requested', label: 'Demande créée', date: delivery.created_at, done: true },
    { key: 'accepted', label: 'Course acceptée', date: delivery.acceptedAt, done: Boolean(delivery.acceptedAt) || delivery.status !== 'requested' },
    { key: 'picked_up', label: 'Colis récupéré', date: delivery.pickedUpAt, done: Boolean(delivery.pickedUpAt) || delivery.status === 'delivered' },
    { key: 'delivered', label: 'Livraison terminée', date: delivery.deliveredAt, done: Boolean(delivery.deliveredAt) },
    { key: 'released', label: 'Paiement libéré', date: delivery.escrowStatus === 'released' ? delivery.deliveredAt ?? delivery.deliveryCodeVerifiedAt : null, done: delivery.escrowStatus === 'released' }
  ]
}

function getDeliveryMapZoom(distanceKm?: number) {
  if (!distanceKm || distanceKm <= 0) return 11
  if (distanceKm <= 3) return 13
  if (distanceKm <= 8) return 12
  if (distanceKm <= 20) return 11
  return 10
}

function buildDeliveryMapUrl(delivery: Delivery) {
  if (!MAPBOX_TOKEN) return null

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

export default function DeliveryDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const [pickupCode, setPickupCode] = useState('')
  const [deliveryCode, setDeliveryCode] = useState('')
  const [sellerCode, setSellerCode] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [escrowPaymentUrl, setEscrowPaymentUrl] = useState<string | null>(null)

  const deliveryQuery = useQuery({
    queryKey: ['deliveries', 'detail', id],
    queryFn: () => deliveriesApi.getById(id as string),
    enabled: Boolean(id)
  })

  const refreshQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['deliveries', 'mine'] })
    queryClient.invalidateQueries({ queryKey: ['deliveries', 'available'] })
    queryClient.invalidateQueries({ queryKey: ['deliveries', 'detail', id] })
  }

  const requestEscrowMutation = useMutation({
    mutationFn: (deliveryId: string) => deliveriesApi.requestEscrow(deliveryId),
    onSuccess: async result => {
      setEscrowPaymentUrl(result.paymentUrl ?? null)
      refreshQueries()
      if (result.paymentUrl) {
        try {
          await Linking.openURL(result.paymentUrl)
        } catch {
          Alert.alert('Paiement sécurisé', `Ouvre ce lien pour finaliser le paiement: ${result.paymentUrl}`)
        }
        return
      }
      Alert.alert('Paiement sécurisé', 'Paiement sécurisé initialisé.')
    },
    onError: err => Alert.alert('Paiement sécurisé', err instanceof Error ? err.message : 'Initialisation impossible.')
  })

  const releaseMutation = useMutation({
    mutationFn: (deliveryId: string) => deliveriesApi.releaseEscrow(deliveryId),
    onSuccess: () => {
      refreshQueries()
      Alert.alert('Paiement sécurisé', 'Le paiement sécurisé a été libéré.')
    },
    onError: err => Alert.alert('Paiement sécurisé', err instanceof Error ? err.message : 'Libération impossible.')
  })

  const pickupConfirmMutation = useMutation({
    mutationFn: ({ deliveryId, code }: { deliveryId: string; code: string }) => deliveriesApi.confirmPickupCode(deliveryId, code),
    onSuccess: () => {
      setPickupCode('')
      refreshQueries()
      Alert.alert('Livraison', 'Retrait confirmé.')
    },
    onError: err => Alert.alert('Livraison', err instanceof Error ? err.message : 'Code invalide.')
  })

  const deliveryConfirmMutation = useMutation({
    mutationFn: ({ deliveryId, code }: { deliveryId: string; code: string }) => deliveriesApi.confirmDeliveryCode(deliveryId, code),
    onSuccess: () => {
      setDeliveryCode('')
      refreshQueries()
      Alert.alert('Livraison', 'Livraison confirmée.')
    },
    onError: err => Alert.alert('Livraison', err instanceof Error ? err.message : 'Code invalide.')
  })

  const sendDeliveryCodeMutation = useMutation({
    mutationFn: (deliveryId: string) => deliveriesApi.sendDeliveryCode(deliveryId),
    onSuccess: () => Alert.alert('Livraison', 'Le code de réception a été envoyé.')
  })

  const pickupCodeMutation = useMutation({
    mutationFn: (deliveryId: string) => deliveriesApi.pickupCode(deliveryId),
    onSuccess: result => setSellerCode(result.code),
    onError: err => Alert.alert('Livraison', err instanceof Error ? err.message : 'Code indisponible.')
  })

  const cancelMutation = useMutation({
    mutationFn: ({ deliveryId, reason }: { deliveryId: string; reason?: string }) => deliveriesApi.cancel(deliveryId, reason),
    onSuccess: () => {
      setCancelOpen(false)
      setCancelReason('')
      refreshQueries()
      Alert.alert('Livraison', 'La livraison a été annulée.')
    },
    onError: err => Alert.alert('Livraison', err instanceof Error ? err.message : 'Annulation impossible.')
  })

  const delivery = deliveryQuery.data
  const role = useMemo<'buyer' | 'seller' | 'courier' | null>(() => {
    if (!delivery || !user?.id) return null
    if (delivery.buyer.id === user.id) return 'buyer'
    if (delivery.seller.id === user.id) return 'seller'
    if (delivery.courier?.id === user.id) return 'courier'
    return null
  }, [delivery, user?.id])
  const timeline = useMemo(() => (delivery ? buildTimeline(delivery) : []), [delivery])
  const mapUrl = useMemo(() => (delivery ? buildDeliveryMapUrl(delivery) : null), [delivery])

  if (!id) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Livraison introuvable.</Text>
      </View>
    )
  }

  if (deliveryQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  if (!delivery || deliveryQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Impossible de charger cette livraison.</Text>
      </View>
    )
  }

  const canRelease =
    role === 'buyer' &&
    delivery.escrowStatus === 'held' &&
    ((delivery.handoverMode === 'pickup' && delivery.status !== 'canceled') ||
      (delivery.handoverMode === 'delivery' && delivery.status === 'delivered'))

  const canRequestEscrow = role === 'buyer' && (delivery.escrowStatus === 'none' || delivery.escrowStatus === 'pending')
  const canConfirmPickup = role === 'courier' && delivery.status === 'accepted'
  const canConfirmDelivery = role === 'courier' && delivery.status === 'picked_up'
  const escrowTone = escrowStatusTone(delivery.escrowStatus)
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Détail livraison
        </Text>
        <Pressable style={styles.headerButton} onPress={() => deliveryQuery.refetch()}>
          <Ionicons name="refresh-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 + Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{delivery.listing?.title ?? 'Annonce'}</Text>
              <Text style={styles.heroSub}>{deliveryStatusLabel(delivery.status)} • {delivery.handoverMode === 'pickup' ? 'Remise en main propre' : 'Livraison'}</Text>
            </View>
            <View style={[styles.statusBadge, delivery.status === 'delivered' ? styles.statusBadgeDone : styles.statusBadgeActive]}>
              <Text style={[styles.statusBadgeText, delivery.status === 'delivered' ? styles.statusBadgeTextDone : styles.statusBadgeTextActive]}>
                {deliveryStatusLabel(delivery.status)}
              </Text>
            </View>
          </View>
          <View style={styles.heroMetaGrid}>
            <View style={styles.heroMetaCell}>
              <Text style={styles.heroMetaLabel}>Frais livraison</Text>
              <Text style={styles.heroMetaValue}>{formatPrice(delivery.price, delivery.currency)}</Text>
            </View>
            <View style={styles.heroMetaCell}>
              <Text style={styles.heroMetaLabel}>Paiement</Text>
              <Text style={styles.heroMetaValue}>{escrowStatusLabel(delivery.escrowStatus)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.escrowHeader}>
            <Text style={styles.sectionTitleCompact}>Paiement sécurisé</Text>
            <View style={[styles.escrowBadge, { backgroundColor: escrowTone.bg }]}>
              <Text style={[styles.escrowBadgeText, { color: escrowTone.text }]}>{escrowStatusLabel(delivery.escrowStatus)}</Text>
            </View>
          </View>
          <Text style={styles.helperText}>{escrowStatusDescription(delivery.escrowStatus)}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Montant</Text>
            <Text style={styles.infoValue}>
              {formatPrice(delivery.escrowAmount ?? delivery.price, delivery.escrowCurrency || delivery.currency)}
            </Text>
          </View>
          {delivery.escrowStatus === 'pending' ? (
            <View style={styles.escrowActions}>
              {escrowPaymentUrl ? (
                <Pressable
                  style={styles.primaryButton}
                  onPress={async () => {
                    try {
                      await Linking.openURL(escrowPaymentUrl)
                    } catch {
                      Alert.alert('Paiement sécurisé', escrowPaymentUrl)
                    }
                  }}
                >
                  <Text style={styles.primaryButtonText}>Réessayer le paiement</Text>
                </Pressable>
              ) : (
                <Text style={styles.escrowHint}>Aucun lien de paiement disponible pour relancer la transaction.</Text>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Acheteur</Text>
            <Text style={styles.infoValue}>{nameOf(delivery.buyer)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vendeur</Text>
            <Text style={styles.infoValue}>{nameOf(delivery.seller)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Livreur</Text>
            <Text style={styles.infoValue}>{nameOf(delivery.courier)}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Parcours</Text>
          <View style={styles.routeSummaryRow}>
            <View style={styles.routeSummaryChip}>
              <Ionicons name="navigate-outline" size={15} color={colors.primary} />
              <Text style={styles.routeSummaryChipText}>
                {typeof delivery.distanceKm === 'number' ? `${delivery.distanceKm.toFixed(1)} km` : 'Distance estimée'}
              </Text>
            </View>
            <View style={styles.routeSummaryChip}>
              <Ionicons name="swap-vertical-outline" size={15} color={colors.accent} />
              <Text style={styles.routeSummaryChipText}>
                {delivery.handoverMode === 'pickup' ? 'Remise directe' : 'Livraison'}
              </Text>
            </View>
          </View>
          {mapUrl ? (
            <View style={styles.mapCard}>
              <Image source={{ uri: mapUrl }} style={styles.mapImage} resizeMode="cover" />
              <View style={styles.mapLegend}>
                <View style={styles.mapLegendItem}>
                  <View style={[styles.mapLegendDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.mapLegendText}>Départ</Text>
                </View>
                <View style={styles.mapLegendItem}>
                  <View style={[styles.mapLegendDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.mapLegendText}>Arrivée</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.mapFallback}>
              <Ionicons name="map-outline" size={18} color={colors.muted} />
              <Text style={styles.mapFallbackText}>
                Ajoute `EXPO_PUBLIC_MAPBOX_TOKEN` dans le `.env` mobile pour afficher la carte de trajet.
              </Text>
            </View>
          )}
          <View style={styles.routeCard}>
            <View style={styles.routePointWrap}>
              <View style={styles.routeDot} />
              <View style={styles.routeLine} />
              <View style={[styles.routeDot, styles.routeDotEnd]} />
            </View>
            <View style={{ flex: 1, gap: spacing.lg }}>
              <View>
                <Text style={styles.routeLabel}>Départ</Text>
                <Text style={styles.routeValue}>{delivery.pickupAddress || 'Non renseigné'}</Text>
              </View>
              <View>
                <Text style={styles.routeLabel}>Arrivée</Text>
                <Text style={styles.routeValue}>{delivery.dropoffAddress || 'Non renseigné'}</Text>
                {delivery.dropoffNotes ? <Text style={styles.routeHint}>{delivery.dropoffNotes}</Text> : null}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Paiement sécurisé</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Statut</Text>
            <Text style={styles.infoValue}>{escrowStatusLabel(delivery.escrowStatus)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Montant retenu</Text>
            <Text style={styles.infoValue}>{formatPrice(delivery.escrowAmount, delivery.escrowCurrency || delivery.currency)}</Text>
          </View>
          {delivery.sellerPayoutReady !== undefined ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Retrait vendeur</Text>
              <Text style={styles.infoValue}>{delivery.sellerPayoutReady ? 'Prêt' : 'En attente de paramétrage'}</Text>
            </View>
          ) : null}
        </View>

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

        {sellerCode ? (
          <View style={[styles.sectionCard, styles.codeCard]}>
            <Text style={styles.sectionTitle}>Code de remise</Text>
            <Text style={styles.codeValue}>{sellerCode}</Text>
            <Text style={styles.codeHint}>Transmets ce code au livreur au moment du retrait.</Text>
          </View>
        ) : null}

        {canConfirmPickup ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Confirmer le retrait</Text>
            <Text style={styles.helperText}>Saisis le code communiqué par le vendeur pour confirmer la récupération du colis.</Text>
            <TextInput
              value={pickupCode}
              onChangeText={setPickupCode}
              placeholder="Code de remise"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        ) : null}

        {canConfirmDelivery ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Confirmer la livraison</Text>
            <Text style={styles.helperText}>Saisis le code reçu par l’acheteur pour terminer la livraison.</Text>
            <TextInput
              value={deliveryCode}
              onChangeText={setDeliveryCode}
              placeholder="Code de réception"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.footerActions}>
          {role === 'seller' ? (
            <Pressable style={styles.secondaryButton} onPress={() => pickupCodeMutation.mutate(delivery.id)} disabled={pickupCodeMutation.isPending}>
              <Text style={styles.secondaryButtonText}>{pickupCodeMutation.isPending ? '...' : 'Code remise'}</Text>
            </Pressable>
          ) : null}

          {role === 'buyer' ? (
            <Pressable style={styles.secondaryButton} onPress={() => sendDeliveryCodeMutation.mutate(delivery.id)} disabled={sendDeliveryCodeMutation.isPending}>
              <Text style={styles.secondaryButtonText}>{sendDeliveryCodeMutation.isPending ? '...' : 'Code réception'}</Text>
            </Pressable>
          ) : null}

          {canRequestEscrow ? (
            <Pressable style={styles.primaryButton} onPress={() => requestEscrowMutation.mutate(delivery.id)} disabled={requestEscrowMutation.isPending}>
              <Text style={styles.primaryButtonText}>{requestEscrowMutation.isPending ? 'Traitement...' : 'Initier paiement'}</Text>
            </Pressable>
          ) : null}

          {canRelease ? (
            <Pressable style={styles.primaryButton} onPress={() => releaseMutation.mutate(delivery.id)} disabled={releaseMutation.isPending}>
              <Text style={styles.primaryButtonText}>{releaseMutation.isPending ? 'Traitement...' : 'Libérer paiement'}</Text>
            </Pressable>
          ) : null}

          {canConfirmPickup ? (
            <Pressable
              style={styles.primaryButton}
              onPress={() => pickupConfirmMutation.mutate({ deliveryId: delivery.id, code: pickupCode.trim() })}
              disabled={pickupConfirmMutation.isPending || pickupCode.trim().length < 4}
            >
              <Text style={styles.primaryButtonText}>{pickupConfirmMutation.isPending ? 'Traitement...' : 'Valider retrait'}</Text>
            </Pressable>
          ) : null}

          {canConfirmDelivery ? (
            <Pressable
              style={styles.primaryButton}
              onPress={() => deliveryConfirmMutation.mutate({ deliveryId: delivery.id, code: deliveryCode.trim() })}
              disabled={deliveryConfirmMutation.isPending || deliveryCode.trim().length < 4}
            >
              <Text style={styles.primaryButtonText}>{deliveryConfirmMutation.isPending ? 'Traitement...' : 'Valider livraison'}</Text>
            </Pressable>
          ) : null}

          {delivery.status !== 'delivered' && delivery.status !== 'canceled' ? (
            <Pressable style={styles.dangerButton} onPress={() => setCancelOpen(true)}>
              <Text style={styles.dangerButtonText}>Annuler</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Annuler la livraison</Text>
            <Text style={styles.helperText}>Ajoute une raison facultative pour garder une trace de l’annulation.</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Raison de l’annulation"
              placeholderTextColor={colors.placeholder}
              multiline
              style={[styles.input, styles.multilineInput]}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setCancelOpen(false)}>
                <Text style={styles.secondaryButtonText}>Fermer</Text>
              </Pressable>
              <Pressable
                style={styles.dangerButton}
                onPress={() => cancelMutation.mutate({ deliveryId: delivery.id, reason: cancelReason.trim() || undefined })}
                disabled={cancelMutation.isPending}
              >
                <Text style={styles.dangerButtonText}>{cancelMutation.isPending ? '...' : 'Confirmer'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    borderColor: colors.primarySoftStrong,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySurface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.soft
  },
  heroTopRow: {
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
  statusBadgeActive: {
    backgroundColor: colors.accentSurface
  },
  statusBadgeDone: {
    backgroundColor: colors.successSoft
  },
  statusBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  statusBadgeTextActive: {
    color: colors.accent
  },
  statusBadgeTextDone: {
    color: colors.success
  },
  heroMetaGrid: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  heroMetaCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
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
  sectionTitle: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold,
    marginBottom: spacing.md
  },
  sectionTitleCompact: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold
  },
  escrowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  escrowBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  escrowBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  escrowActions: {
    marginTop: spacing.sm
  },
  escrowHint: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: typography.caption
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
  routeCard: {
    flexDirection: 'row',
    gap: spacing.md
  },
  routeSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap'
  },
  routeSummaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7
  },
  routeSummaryChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  mapCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.md
  },
  mapImage: {
    width: '100%',
    height: 176,
    backgroundColor: colors.surfaceRaised
  },
  mapLegend: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  mapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  mapLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  mapLegendText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  mapFallback: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  mapFallbackText: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.caption
  },
  routePointWrap: {
    width: 18,
    alignItems: 'center',
    paddingTop: spacing.xs
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary
  },
  routeDotEnd: {
    backgroundColor: colors.accent
  },
  routeLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.borderStrong,
    marginVertical: spacing.xs
  },
  routeLabel: {
    color: colors.muted,
    fontSize: typography.caption
  },
  routeValue: {
    marginTop: 2,
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  routeHint: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.caption
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
  codeCard: {
    backgroundColor: colors.accentSurface,
    borderColor: colors.accentSoftStrong
  },
  codeValue: {
    color: colors.accent,
    fontSize: typography.display,
    fontWeight: typography.weightBlack,
    letterSpacing: 2
  },
  codeHint: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  helperText: {
    color: colors.muted,
    fontSize: typography.bodySm
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm
  },
  multilineInput: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: 'top'
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm
  },
  footerActions: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerSurfaceStrong,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 18, 28, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalCard: {
    width: '100%',
    borderRadius: radius.xl,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightBlack
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end'
  }
})
