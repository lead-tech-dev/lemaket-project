import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'
import { paymentsApi, type PaymentSubscription } from '@/features/payments/payments.api'

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return value
  }
}

function formatMoney(amount: number | string, currency: string) {
  const numeric = Number(amount)
  if (Number.isFinite(numeric)) {
    return `${Math.round(numeric).toLocaleString('fr-FR')} ${currency}`
  }
  return `${amount} ${currency}`
}

function subscriptionStatusLabel(status: PaymentSubscription['status']) {
  switch (status) {
    case 'active':
      return 'Actif'
    case 'paused':
      return 'En pause'
    case 'canceled':
      return 'Annulé'
    case 'expired':
      return 'Expiré'
    default:
      return status
  }
}

function subscriptionStatusTone(status: PaymentSubscription['status']) {
  switch (status) {
    case 'active':
      return { bg: colors.successSurface, border: colors.successSoftStrong, text: colors.success }
    case 'paused':
      return { bg: colors.warningSurface, border: colors.warningSoftStrong, text: colors.warning }
    case 'canceled':
      return { bg: colors.dangerSurface, border: colors.dangerSoftStrong, text: colors.danger }
    case 'expired':
      return { bg: colors.surfaceRaised, border: colors.borderStrong, text: colors.text }
    default:
      return { bg: colors.surfaceRaised, border: colors.borderStrong, text: colors.text }
  }
}

function buildSubscriptionTimeline(subscription: PaymentSubscription) {
  return [
    { key: 'created', label: 'Souscription créée', date: subscription.created_at, done: true },
    { key: 'active', label: 'Abonnement actif', date: subscription.status === 'active' ? subscription.created_at : null, done: subscription.status === 'active' },
    { key: 'renewal', label: 'Prochain renouvellement', date: subscription.nextRenewalAt, done: Boolean(subscription.nextRenewalAt) },
    { key: 'end', label: subscription.status === 'paused' ? 'Suspendu' : subscription.status === 'canceled' ? 'Annulé' : 'Fin du cycle', date: subscription.status === 'active' ? null : subscription.nextRenewalAt ?? null, done: subscription.status !== 'active' }
  ]
}

export default function SubscriptionDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id

  const subscriptionsQuery = useQuery({
    queryKey: ['payments', 'subscriptions'],
    queryFn: () => paymentsApi.subscriptions()
  })

  const actionMutation = useMutation({
    mutationFn: ({ id: subscriptionId, active }: { id: string; active: boolean }) =>
      active ? paymentsApi.cancelSubscription(subscriptionId) : paymentsApi.resumeSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', 'subscriptions'] })
      Alert.alert('Abonnement', 'Abonnement mis à jour.')
    },
    onError: err => Alert.alert('Abonnement', err instanceof Error ? err.message : 'Mise à jour impossible.')
  })

  const subscription = subscriptionsQuery.data?.find(item => item.id === id) ?? null

  if (!id) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Abonnement introuvable.</Text>
      </View>
    )
  }

  if (subscriptionsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.helper}>Chargement...</Text>
      </View>
    )
  }

  if (!subscription) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Impossible de retrouver cet abonnement.</Text>
      </View>
    )
  }

  const tone = subscriptionStatusTone(subscription.status)
  const timeline = buildSubscriptionTimeline(subscription)

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Abonnement</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subscription.planName}
          </Text>
        </View>
        <Pressable style={styles.headerButton} onPress={() => subscriptionsQuery.refetch()}>
          <Ionicons name="refresh-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{subscription.planName}</Text>
              <Text style={styles.heroPrice}>{formatMoney(subscription.amount, subscription.currency)}</Text>
              {subscription.description ? <Text style={styles.heroText}>{subscription.description}</Text> : null}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <Text style={[styles.statusBadgeText, { color: tone.text }]}>{subscriptionStatusLabel(subscription.status)}</Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Auto-renouvellement</Text>
              <Text style={styles.heroStatValue}>{subscription.autoRenew ? 'Activé' : 'Désactivé'}</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Prochain cycle</Text>
              <Text style={styles.heroStatValue}>{formatDate(subscription.nextRenewalAt)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Informations clés</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plan</Text>
            <Text style={styles.infoValue}>{subscription.planName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Statut</Text>
            <Text style={styles.infoValue}>{subscriptionStatusLabel(subscription.status)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Créé le</Text>
            <Text style={styles.infoValue}>{formatDate(subscription.created_at)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Moyen de paiement</Text>
            <Text style={styles.infoValue}>{subscription.paymentMethod?.label || subscription.paymentMethod?.type || '—'}</Text>
          </View>
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

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => actionMutation.mutate({ id: subscription.id, active: subscription.status === 'active' })}
              disabled={actionMutation.isPending}
            >
              <Text style={styles.primaryButtonText}>
                {actionMutation.isPending ? 'Traitement...' : subscription.status === 'active' ? 'Suspendre' : 'Reprendre'}
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/dashboard/payments')}>
              <Text style={styles.secondaryButtonText}>Voir paiements</Text>
            </Pressable>
          </View>
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
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg
  },
  helper: {
    color: colors.muted,
    fontSize: typography.body
  },
  errorText: {
    color: colors.text,
    fontSize: typography.body,
    textAlign: 'center'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: typography.weightExtrabold
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  scroll: {
    flex: 1
  },
  heroCard: {
    borderWidth: 1,
    borderColor: colors.primarySoftStrong,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySurface,
    padding: spacing.lg,
    gap: spacing.md
  },
  heroTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start'
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightBlack
  },
  heroPrice: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: typography.titleLg,
    fontWeight: typography.weightBlack
  },
  heroText: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  statusBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  heroStatCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md
  },
  heroStatLabel: {
    color: colors.muted,
    fontSize: typography.caption
  },
  heroStatValue: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  infoLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold,
    textAlign: 'right'
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start'
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
    paddingBottom: spacing.sm
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
    gap: spacing.sm
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  }
})
