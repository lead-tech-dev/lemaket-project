import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { paymentsApi } from '@/features/payments/payments.api'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

type ProPlan = {
  id: 'starter' | 'business' | 'premium'
  name: string
  description: string
  price: string
  mode: 'subscribe'
}

const proBenefits = [
  {
    title: 'Vitrine professionnelle',
    description: 'Mettez en avant votre boutique et vos avis pour convertir plus vite.'
  },
  {
    title: 'Visibilité prioritaire',
    description: 'Accédez aux outils de mise en avant et aux campagnes sponsorisées.'
  },
  {
    title: 'Messagerie pro',
    description: 'Gérez vos leads et conversations avec des outils avancés.'
  },
  {
    title: 'Paiements avancés',
    description: 'Suivi des abonnements, factures et méthodes de paiement dédiées.'
  }
]

const proPlans: ProPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Pour démarrer et structurer vos premières ventes.',
    price: '5 000 FCFA / mois',
    mode: 'subscribe'
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Pour accélérer vos ventes avec plus d’automatisations.',
    price: '10 000 FCFA / mois',
    mode: 'subscribe'
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Pour maximiser la visibilité et piloter une activité intensive.',
    price: '20 000 FCFA / mois',
    mode: 'subscribe'
  }
]

export default function DashboardProScreen() {
  const router = useRouter()
  const [processingKey, setProcessingKey] = useState<string | null>(null)
  const subscriptionsQuery = useQuery({
    queryKey: ['payments', 'subscriptions', 'pro'],
    queryFn: () => paymentsApi.subscriptions()
  })

  const requestMutation = useMutation({
    mutationFn: async ({ planId, mode }: { planId: string; mode: 'trial' | 'subscribe' }) => {
      setProcessingKey(`${planId}:${mode}`)
      return paymentsApi.requestProPlan({ planId, mode })
    },
    onSuccess: result => {
      setProcessingKey(null)
      if (result.redirectUrl) {
        Linking.openURL(result.redirectUrl).catch(() => {
          Alert.alert('Compte vendeur', `Session de paiement créée. Ouvrez: ${result.redirectUrl}`)
        })
        return
      }
      Alert.alert('Compte vendeur', 'Souscription enregistrée avec succès.')
      router.push('/dashboard/payments')
    },
    onError: err => {
      setProcessingKey(null)
      Alert.alert('Compte vendeur', err instanceof Error ? err.message : 'Impossible de lancer cette souscription.')
    }
  })

  const activeSubscription = subscriptionsQuery.data?.find(item => item.status === 'active') ?? null
  const pendingSubscription = subscriptionsQuery.data?.find(item => item.status === 'paused' || item.status === 'canceled') ?? null

  return (
    <ScreenScaffold title="Compte vendeur" subtitle="Gérez vos options avancées pour développer LEMAKET.">
      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Statut actuel</Text>
        {subscriptionsQuery.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        {!subscriptionsQuery.isLoading ? (
          activeSubscription ? (
            <Pressable
              style={styles.activeSubscriptionCard}
              onPress={() => router.push({ pathname: '/dashboard/subscriptions/[id]', params: { id: activeSubscription.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.statusValue}>
                  {activeSubscription.planName} actif ({Math.round(Number(activeSubscription.amount)).toLocaleString('fr-FR')} {activeSubscription.currency})
                </Text>
                <Text style={styles.activeSubscriptionHint}>Voir le détail de l’abonnement</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ) : pendingSubscription ? (
            <View style={styles.pendingCard}>
              <Ionicons name="time-outline" size={18} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusValue}>Souscription en attente de reprise</Text>
                <Text style={styles.pendingHint}>Gère l’abonnement dans l’espace Paiements.</Text>
              </View>
              <Pressable style={styles.secondaryButton} onPress={() => router.push('/dashboard/payments')}>
                <Text style={styles.secondaryButtonText}>Ouvrir</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.statusValue}>Aucun abonnement actif</Text>
          )
        ) : null}
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Avantages</Text>
        {proBenefits.map(benefit => (
          <View key={benefit.title} style={styles.benefitItem}>
            <Text style={styles.benefitTitle}>{benefit.title}</Text>
            <Text style={styles.benefitText}>{benefit.description}</Text>
          </View>
        ))}
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Plans disponibles</Text>
        {proPlans.map(plan => {
          const currentKey = `${plan.id}:${plan.mode}`
          const isPending = requestMutation.isPending && processingKey === currentKey
          return (
            <View key={plan.id} style={styles.planCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{plan.name}</Text>
                <Text style={styles.planText}>{plan.description}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
              </View>
              <Pressable style={[styles.primaryButton, isPending && { opacity: 0.6 }]} onPress={() => requestMutation.mutate({ planId: plan.id, mode: plan.mode })} disabled={isPending}>
                <Text style={styles.primaryButtonText}>{isPending ? 'Traitement...' : 'Choisir'}</Text>
              </Pressable>
            </View>
          )
        })}
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Visibilité de tes annonces</Text>
        <Text style={styles.inlineText}>
          Active des boosts et packs premium pour faire remonter tes annonces publiées.
        </Text>
        <Pressable style={[styles.primaryButton, { marginTop: spacing.sm }]} onPress={() => router.push('/dashboard/promotions')}>
          <Text style={styles.primaryButtonText}>Ouvrir les promotions</Text>
        </Pressable>
      </View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  statusValue: {
    color: colors.text,
    fontWeight: typography.weightSemibold
  },
  activeSubscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  activeSubscriptionHint: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  pendingCard: {
    borderWidth: 1,
    borderColor: colors.warningSoftStrong,
    backgroundColor: colors.warningSurface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  pendingHint: {
    marginTop: 2,
    color: colors.warning,
    fontSize: typography.caption
  },
  secondaryButton: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  benefitItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs
  },
  benefitTitle: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  benefitText: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  inlineText: {
    color: colors.muted,
    fontSize: typography.bodySm
  },
  planCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm
  },
  planTitle: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  planText: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  planPrice: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontWeight: typography.weightExtrabold
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold
  }
})
