import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'
import { paymentsApi } from '@/features/payments/payments.api'
import { listingsApi } from '@/features/listings/listings.api'

function formatMoney(amount: number | string, currency: string) {
  const numeric = Number(amount)
  if (Number.isFinite(numeric)) {
    return `${Math.round(numeric).toLocaleString('fr-FR')} ${currency}`
  }
  return `${amount} ${currency}`
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

function paymentStatusLabel(status: string) {
  switch (status) {
    case 'completed':
      return 'Terminée'
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

function paymentStatusTone(status: string) {
  switch (status) {
    case 'completed':
      return {
        backgroundColor: colors.successSurface,
        borderColor: colors.successSoftStrong,
        color: colors.success
      }
    case 'pending':
      return {
        backgroundColor: colors.warningSurface,
        borderColor: colors.warningSoftStrong,
        color: colors.warning
      }
    case 'failed':
      return {
        backgroundColor: colors.dangerSurface,
        borderColor: colors.dangerSoftStrong,
        color: colors.danger
      }
    case 'refunded':
      return {
        backgroundColor: colors.primarySurface,
        borderColor: colors.primarySoftStrong,
        color: colors.primary
      }
    default:
      return {
        backgroundColor: colors.surfaceRaised,
        borderColor: colors.border,
        color: colors.text
      }
  }
}

function paymentMethodLabel(method?: { label?: string; type?: string; provider?: string } | null) {
  if (!method) return '—'
  return method.label || [method.provider, method.type].filter(Boolean).join(' · ') || '—'
}

export default function PaymentDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id

  const invoiceQuery = useQuery({
    queryKey: ['payments', 'invoice', id],
    queryFn: () => paymentsApi.invoice(id as string),
    enabled: Boolean(id)
  })
  const listingId = invoiceQuery.data?.metadata?.listingId
  const listingQuery = useQuery({
    queryKey: ['listings', 'by-id', listingId],
    queryFn: () => listingsApi.getById(String(listingId)),
    enabled: Boolean(listingId)
  })

  if (!id) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Paiement introuvable.</Text>
      </View>
    )
  }

  if (invoiceQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Impossible de charger ce paiement.</Text>
      </View>
    )
  }

  const invoice = invoiceQuery.data
  const tone = paymentStatusTone(invoice.status)

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Paiement</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {invoice.invoiceNumber ||
              invoice.reference ||
              invoice.id?.slice(0, 8) ||
              (typeof id === 'string' ? id.slice(0, 8) : '—')}
          </Text>
        </View>
        <Pressable style={styles.headerButton} onPress={() => invoiceQuery.refetch()}>
          <Ionicons name="refresh" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{invoice.description || 'Paiement LEMAKET'}</Text>
              <Text style={styles.heroAmount}>{formatMoney(invoice.amount, invoice.currency)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
              <Text style={[styles.statusBadgeText, { color: tone.color }]}>{paymentStatusLabel(invoice.status)}</Text>
            </View>
          </View>
          <View style={styles.heroMetaRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.muted} />
            <Text style={styles.heroMetaText}>{formatDate(invoice.created_at)}</Text>
          </View>
          {invoice.invoiceNumber ? (
            <View style={styles.heroMetaRow}>
              <Ionicons name="receipt-outline" size={16} color={colors.muted} />
              <Text style={styles.heroMetaText}>{invoice.invoiceNumber}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Informations de paiement</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Référence</Text>
            <Text style={styles.infoValue}>{invoice.reference || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fournisseur</Text>
            <Text style={styles.infoValue}>{invoice.provider || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Moyen</Text>
            <Text style={styles.infoValue}>{paymentMethodLabel(invoice.paymentMethod)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Session checkout</Text>
            <Text style={styles.infoValue}>{invoice.checkoutSessionId || '—'}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Liens avec l’activité</Text>
          {invoice.metadata?.listingId ? (
            <Pressable
              style={styles.infoLinkRow}
              onPress={() => router.push({ pathname: '/listings/[id]', params: { id: String(invoice.metadata?.listingId) } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Annonce</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {listingQuery.data?.title
                    ? `${listingQuery.data.title}${listingQuery.data.location?.city || listingQuery.data.city ? ` · ${listingQuery.data.location?.city ?? listingQuery.data.city}` : ''}`
                    : String(invoice.metadata?.listingId)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Annonce</Text>
              <Text style={styles.infoValue}>—</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Promotion</Text>
            <Text style={styles.infoValue}>{String(invoice.metadata?.promotionType ?? '—')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Promotion appliquée</Text>
            <Text style={styles.infoValue}>{invoice.metadata?.promotionApplied ? 'Oui' : 'Non'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fin prévue</Text>
            <Text style={styles.infoValue}>{formatDate(typeof invoice.metadata?.promotionEndsAt === 'string' ? invoice.metadata.promotionEndsAt : null)}</Text>
          </View>
        </View>

        {invoice.invoiceUrl ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Document</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                void Linking.openURL(invoice.invoiceUrl as string).catch(() => {
                  Alert.alert('Paiements', invoice.invoiceUrl ?? 'Lien indisponible')
                })
              }}
            >
              <Ionicons name="open-outline" size={18} color={colors.white} />
              <Text style={styles.primaryButtonText}>Ouvrir la facture</Text>
            </Pressable>
          </View>
        ) : null}
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
  errorText: {
    color: colors.text,
    fontSize: typography.body
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm
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
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  heroCopy: {
    flex: 1
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  heroAmount: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: typography.titleLg,
    fontWeight: typography.weightBlack
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  statusBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  heroMetaText: {
    color: colors.muted,
    fontSize: typography.caption
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
    alignItems: 'flex-start',
    gap: spacing.md
  },
  infoLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
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
  primaryButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  }
})
