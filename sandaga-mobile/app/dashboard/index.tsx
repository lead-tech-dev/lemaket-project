import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { dashboardApi } from '@/features/dashboard/dashboard.api'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'
import { isMobileFeatureEnabled, type MobileFeatureFlagName } from '@/core/config/featureFlags'

export default function DashboardHomeScreen() {
  const router = useRouter()
  const overviewQuery = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => dashboardApi.overview()
  })

  const quickActions: {
    label: string
    icon: keyof typeof Ionicons.glyphMap
    tone: 'orange' | 'green' | 'blue' | 'purple' | 'amber' | 'slate'
    route: string
    feature?: MobileFeatureFlagName
  }[] = [
    { label: 'Mes annonces', icon: 'albums-outline', tone: 'orange', route: '/dashboard/listings' },
    { label: 'Commandes', icon: 'receipt-outline', tone: 'green', route: '/dashboard/orders', feature: 'dashboardOrders' },
    { label: 'Messages', icon: 'chatbubble-ellipses-outline', tone: 'blue', route: '/dashboard/messages' },
    { label: 'Paiements', icon: 'card-outline', tone: 'purple', route: '/dashboard/payments', feature: 'dashboardPayments' },
    {
      label: 'Promotions',
      icon: 'flash-outline',
      tone: 'orange',
      route: '/dashboard/promotions',
      feature: 'dashboardPromotions'
    },
    {
      label: 'Notifications',
      icon: 'notifications-outline',
      tone: 'amber',
      route: '/dashboard/notifications',
      feature: 'dashboardNotifications'
    },
    {
      label: 'Routes backend',
      icon: 'git-network-outline',
      tone: 'slate',
      route: '/dashboard/backend-routes',
      feature: 'dashboardBackendRoutes'
    }
  ]

  const visibleQuickActions = quickActions.filter(action => !action.feature || isMobileFeatureEnabled(action.feature))

  return (
    <ScreenScaffold title="Tableau de bord" subtitle="Pilote ton activité LEMAKET.">
      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Statistiques</Text>
        {overviewQuery.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        {!overviewQuery.isLoading && (overviewQuery.data?.stats?.length ?? 0) === 0 ? (
          <Text style={dashboardStyles.empty}>Aucune statistique disponible.</Text>
        ) : null}
        {overviewQuery.data?.stats?.map(stat => (
          <View key={stat.label} style={styles.statRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statTrend}>{stat.trend}</Text>
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Actions rapides</Text>
        <View style={styles.quickGrid}>
          {visibleQuickActions.map(action => (
            <QuickAction
              key={action.label}
              label={action.label}
              icon={action.icon}
              tone={action.tone}
              onPress={() => router.push(action.route as never)}
            />
          ))}
        </View>
      </View>
    </ScreenScaffold>
  )
}

function QuickAction({
  label,
  icon,
  tone,
  onPress
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  tone: 'orange' | 'green' | 'blue' | 'purple' | 'amber' | 'slate'
  onPress: () => void
}) {
  const palette = tonePalette[tone]

  return (
    <Pressable style={[styles.quickItem, { borderColor: palette.border, backgroundColor: palette.bg }]} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: palette.soft }]}>
        <Ionicons name={icon} size={18} color={palette.icon} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  )
}

const tonePalette = {
  orange: { bg: 'rgba(255,110,20,0.08)', soft: 'rgba(255,110,20,0.16)', border: 'rgba(255,110,20,0.3)', icon: '#ff6e14' },
  green: { bg: 'rgba(15,157,88,0.08)', soft: 'rgba(15,157,88,0.16)', border: 'rgba(15,157,88,0.3)', icon: '#0f9d58' },
  blue: { bg: 'rgba(15,96,196,0.08)', soft: 'rgba(15,96,196,0.16)', border: 'rgba(15,96,196,0.3)', icon: '#0f60c4' },
  purple: { bg: 'rgba(124,58,237,0.08)', soft: 'rgba(124,58,237,0.16)', border: 'rgba(124,58,237,0.3)', icon: '#7c3aed' },
  amber: { bg: 'rgba(217,119,6,0.08)', soft: 'rgba(217,119,6,0.16)', border: 'rgba(217,119,6,0.3)', icon: '#d97706' },
  slate: { bg: 'rgba(71,85,105,0.08)', soft: 'rgba(71,85,105,0.16)', border: 'rgba(71,85,105,0.3)', icon: '#475569' }
} as const

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm
  },
  statLabel: {
    color: colors.text,
    fontWeight: typography.weightSemibold
  },
  statTrend: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  statValue: {
    color: colors.primary,
    fontWeight: typography.weightExtrabold,
    fontSize: typography.body
  },
  quickGrid: {
    gap: spacing.sm
  },
  quickItem: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  quickIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickLabel: {
    flex: 1,
    color: colors.text,
    fontWeight: typography.weightSemibold
  }
})
