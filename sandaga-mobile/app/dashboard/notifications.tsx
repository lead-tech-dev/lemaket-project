import { useMemo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { notificationsApi, type NotificationCategory, type NotificationItem } from '@/features/notifications/notifications.api'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'

const categoryLabel: Record<NotificationCategory, string> = {
  system: 'Système',
  saved_search: 'Alertes',
  moderation: 'Modération'
}

const categoryIcon: Record<NotificationCategory, keyof typeof Ionicons.glyphMap> = {
  system: 'hardware-chip-outline',
  saved_search: 'search-outline',
  moderation: 'shield-checkmark-outline'
}

const categoryColor: Record<NotificationCategory, string> = {
  system: '#0f60c4',
  saved_search: '#ff6e14',
  moderation: '#0f9d58'
}

const formatDateTime = (raw: string): string => {
  const value = new Date(raw)
  if (Number.isNaN(value.getTime())) {
    return 'à l’instant'
  }
  return new Intl.DateTimeFormat('fr-CM', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(value)
}

export default function DashboardNotificationsScreen() {
  const queryClient = useQueryClient()

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(40)
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] })
    }
  })

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] })
    }
  })

  const items = useMemo(() => notificationsQuery.data?.items ?? [], [notificationsQuery.data])
  const totalUnread = notificationsQuery.data?.summary?.totalUnread ?? 0

  return (
    <ScreenScaffold title="Notifications" subtitle="Toutes les alertes backend en temps réel.">
      <View style={styles.headerCard}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Boîte de réception</Text>
            <Text style={styles.headerSubtitle}>{totalUnread} non lues</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.markAllButton, pressed && styles.markAllButtonPressed]}
          onPress={() => {
            if (totalUnread > 0) {
              markAllMutation.mutate()
            }
          }}
        >
          <Text style={styles.markAllLabel}>Tout lire</Text>
        </Pressable>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Flux des notifications</Text>
        {notificationsQuery.isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Chargement des notifications...</Text>
          </View>
        ) : null}

        {!notificationsQuery.isLoading && items.length === 0 ? (
          <Text style={dashboardStyles.empty}>Aucune notification pour le moment.</Text>
        ) : null}

        <View style={styles.list}>
          {items.map(item => (
            <NotificationRow
              key={item.id}
              item={item}
              pending={markOneMutation.isPending}
              onMarkRead={id => markOneMutation.mutate(id)}
            />
          ))}
        </View>
      </View>
    </ScreenScaffold>
  )
}

function NotificationRow({
  item,
  pending,
  onMarkRead
}: {
  item: NotificationItem
  pending: boolean
  onMarkRead: (id: string) => void
}) {
  const tone = categoryColor[item.category]

  return (
    <Pressable
      style={({ pressed }) => [styles.notificationRow, !item.isRead && styles.notificationRowUnread, pressed && styles.notificationRowPressed]}
      onPress={() => {
        if (!item.isRead && !pending) {
          onMarkRead(item.id)
        }
      }}
    >
      <View style={[styles.notificationIconWrap, { backgroundColor: `${tone}22` }]}>
        <Ionicons name={categoryIcon[item.category]} size={16} color={tone} />
      </View>
      <View style={styles.notificationBody}>
        <View style={styles.notificationTitleRow}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: tone }]} /> : null}
        </View>
        {item.body ? (
          <Text style={styles.notificationText} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <View style={styles.notificationMetaRow}>
          <View style={[styles.categoryPill, { backgroundColor: `${tone}22` }]}>
            <Text style={[styles.categoryPillText, { color: tone }]}>{categoryLabel[item.category]}</Text>
          </View>
          <Text style={styles.notificationTime}>{formatDateTime(item.created_at)}</Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.soft
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  markAllButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 7
  },
  markAllButtonPressed: {
    opacity: 0.82
  },
  markAllLabel: {
    color: colors.accent,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm
  },
  loadingText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  list: {
    gap: spacing.sm
  },
  notificationRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  notificationRowUnread: {
    borderColor: colors.accentOutline
  },
  notificationRowPressed: {
    backgroundColor: colors.surfaceAlt
  },
  notificationIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center'
  },
  notificationBody: {
    flex: 1
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  notificationTitle: {
    flex: 1,
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  notificationText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 16
  },
  notificationMetaRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  categoryPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  categoryPillText: {
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  notificationTime: {
    color: colors.muted,
    fontSize: typography.captionSm
  }
})
