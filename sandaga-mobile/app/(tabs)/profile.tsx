import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSession } from '@/core/auth/session-context'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { useTabScreenInsets } from '@/core/layout/useTabScreenInsets'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import { isMobileFeatureEnabled, type MobileFeatureFlagName } from '@/core/config/featureFlags'

type DashboardMenuItem = {
  key: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
  route?:
    | '/dashboard'
    | '/dashboard/overview'
    | '/dashboard/listings'
    | '/dashboard/orders'
    | '/dashboard/deliveries'
    | '/dashboard/messages'
    | '/dashboard/favorites'
    | '/dashboard/follows'
    | '/dashboard/alerts'
    | '/dashboard/notifications'
    | '/dashboard/backend-routes'
    | '/dashboard/profile'
    | '/dashboard/settings'
    | '/dashboard/security'
    | '/dashboard/addresses'
    | '/dashboard/wallet'
    | '/dashboard/payments'
  feature?: MobileFeatureFlagName
}

const workspaceMenu: DashboardMenuItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: 'speedometer-outline', route: '/dashboard' },
  {
    key: 'listings',
    label: 'Mes annonces',
    icon: 'albums-outline',
    route: '/dashboard/listings'
  },
  {
    key: 'orders',
    label: 'Commandes',
    icon: 'receipt-outline',
    route: '/dashboard/orders',
    feature: 'dashboardOrders'
  },
  {
    key: 'deliveries',
    label: 'Livraisons',
    icon: 'bicycle-outline',
    route: '/dashboard/deliveries',
    feature: 'dashboardDeliveries'
  },
  { key: 'messages', label: 'Messages', icon: 'chatbubble-ellipses-outline', route: '/dashboard/messages' },
  { key: 'favorites', label: 'Favoris', icon: 'heart-outline', route: '/dashboard/favorites' },
  {
    key: 'follows',
    label: 'Abonnements',
    icon: 'people-outline',
    route: '/dashboard/follows',
    feature: 'dashboardFollows'
  },
  {
    key: 'alerts',
    label: 'Alertes',
    icon: 'notifications-outline',
    route: '/dashboard/alerts',
    feature: 'dashboardAlerts'
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: 'mail-open-outline',
    route: '/dashboard/notifications',
    feature: 'dashboardNotifications'
  }
]

const accountMenu: DashboardMenuItem[] = [
  { key: 'profile', label: 'Profil', icon: 'person-outline', route: '/dashboard/profile' },
  { key: 'settings', label: 'Paramètres', icon: 'settings-outline', route: '/dashboard/settings' },
  { key: 'security', label: 'Sécurité', icon: 'shield-checkmark-outline', route: '/dashboard/security' },
  { key: 'addresses', label: 'Mes adresses', icon: 'location-outline', route: '/dashboard/addresses' },
  {
    key: 'backend-routes',
    label: 'Routes backend',
    icon: 'git-network-outline',
    route: '/dashboard/backend-routes',
    feature: 'dashboardBackendRoutes'
  },
  { key: 'wallet', label: 'Portefeuille', icon: 'wallet-outline', route: '/dashboard/wallet', feature: 'dashboardWallet' },
  {
    key: 'payments',
    label: 'Paiements',
    icon: 'card-outline',
    route: '/dashboard/payments',
    feature: 'dashboardPayments'
  },
]

export default function ProfileScreen() {
  const router = useRouter()
  const { topInset, bottomInset } = useTabScreenInsets()
  const { user, signOut } = useSession()

  const handleSignOut = async () => {
    await signOut()
    router.replace('/(auth)/login')
  }

  const handleHeroPress = () => {
    router.push('/profile/public')
  }

  const handlePress = (item: DashboardMenuItem) => {
    if (item.feature && !isMobileFeatureEnabled(item.feature)) {
      Alert.alert('Bientôt disponible', 'Cette section sera activée dans une prochaine version.')
      return
    }

    if (item.route) {
      router.push(item.route)
      return
    }

    Alert.alert('Navigation', 'Route indisponible pour le moment.')
  }

  const renderMenuItem = (item: DashboardMenuItem) => (
    <Pressable key={item.key} style={styles.menuItem} onPress={() => handlePress(item)}>
      <View style={styles.menuLeading}>
        <Ionicons name={item.icon} size={18} color={colors.text} />
      </View>
      <View style={styles.menuBody}>
        <Text style={styles.menuLabel}>{item.label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  )

  const visibleWorkspaceMenu = workspaceMenu.filter(item => !item.feature || isMobileFeatureEnabled(item.feature))
  const visibleAccountMenu = accountMenu.filter(item => !item.feature || isMobileFeatureEnabled(item.feature))

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: topInset + spacing.sm, paddingBottom: bottomInset + spacing.md }]}
    >
      <Pressable style={styles.heroCard} onPress={handleHeroPress}>
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={28} color={colors.text} />
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.name}>{[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Utilisateur'}</Text>
          <Text style={styles.email}>{user?.email ?? '-'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Compte</Text>
          </View>
          <Text style={styles.heroHint}>Voir le profil public</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Espace de travail</Text>
        <View style={styles.menuList}>{visibleWorkspaceMenu.map(renderMenuItem)}</View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Compte</Text>
        <View style={styles.menuList}>{visibleAccountMenu.map(renderMenuItem)}</View>
      </View>

      <PrimaryButton label="Se déconnecter" onPress={handleSignOut} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    ...shadows.soft
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroContent: {
    flex: 1
  },
  name: {
    color: colors.text,
    fontWeight: typography.weightExtrabold,
    fontSize: typography.body
  },
  email: {
    marginTop: 1,
    color: colors.muted,
    fontSize: typography.caption
  },
  roleBadge: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  roleBadgeText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  heroHint: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.captionSm
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm,
    marginBottom: spacing.sm
  },
  menuList: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  menuItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm
  },
  menuLeading: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  menuBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  menuLabel: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  }
})
