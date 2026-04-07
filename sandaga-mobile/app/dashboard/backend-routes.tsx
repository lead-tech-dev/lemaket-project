import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ScreenScaffold } from '@/components/dashboard/ScreenScaffold'
import { backendRoutes } from '@/core/backend/backend-routes.generated'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'

type BackendGroupStyle = {
  icon: keyof typeof Ionicons.glyphMap
  color: string
}

const groupStyles: Record<string, BackendGroupStyle> = {
  auth: { icon: 'key-outline', color: '#ff6e14' },
  users: { icon: 'people-outline', color: '#0f60c4' },
  listings: { icon: 'albums-outline', color: '#0f9d58' },
  categories: { icon: 'layers-outline', color: '#7c3aed' },
  home: { icon: 'home-outline', color: '#0f766e' },
  messages: { icon: 'chatbubbles-outline', color: '#2563eb' },
  payments: { icon: 'card-outline', color: '#d97706' },
  deliveries: { icon: 'bicycle-outline', color: '#0ea5a5' },
  dashboard: { icon: 'stats-chart-outline', color: '#0f60c4' },
  notifications: { icon: 'notifications-outline', color: '#f59e0b' },
  orders: { icon: 'receipt-outline', color: '#16a34a' },
  favorites: { icon: 'heart-outline', color: '#dc2626' },
  alerts: { icon: 'notifications-circle-outline', color: '#d946ef' },
  reviews: { icon: 'star-outline', color: '#ea580c' },
  storefronts: { icon: 'storefront-outline', color: '#0f766e' },
  geo: { icon: 'map-outline', color: '#0284c7' },
  reports: { icon: 'flag-outline', color: '#ef4444' },
  media: { icon: 'images-outline', color: '#06b6d4' },
  links: { icon: 'link-outline', color: '#64748b' },
  admin: { icon: 'shield-outline', color: '#6366f1' },
  metrics: { icon: 'pulse-outline', color: '#475569' },
  health: { icon: 'medkit-outline', color: '#22c55e' },
  root: { icon: 'ellipse-outline', color: '#475569' }
}

export default function DashboardBackendRoutesScreen() {
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const normalized = search.trim().toLowerCase()

  const groups = useMemo(() => {
    const filtered = normalized
      ? backendRoutes.filter(item =>
          item.route.toLowerCase().includes(normalized) ||
          item.method.toLowerCase().includes(normalized) ||
          item.group.toLowerCase().includes(normalized) ||
          item.file.toLowerCase().includes(normalized)
        )
      : backendRoutes

    const map = new Map<string, typeof backendRoutes>()
    for (const item of filtered) {
      if (!map.has(item.group)) {
        map.set(item.group, [])
      }
      map.get(item.group)!.push(item)
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, items]) => ({ group, items }))
  }, [normalized])

  return (
    <ScreenScaffold
      title="Routes Backend"
      subtitle="Catalogue complet des endpoints avec identité visuelle LEMAKET."
    >
      <View style={styles.summaryCard}>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryValue}>{backendRoutes.length}</Text>
          <Text style={styles.summaryLabel}>Routes</Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryValue}>{new Set(backendRoutes.map(route => route.group)).size}</Text>
          <Text style={styles.summaryLabel}>Modules</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Filtrer: /payments, POST, users..."
          placeholderTextColor={colors.placeholder}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.groups}>
        {groups.map(({ group, items }) => {
          const style = groupStyles[group] ?? groupStyles.root
          const expanded = expandedGroups[group] ?? false
          const visibleItems = expanded ? items : items.slice(0, 5)
          const hiddenCount = Math.max(items.length - visibleItems.length, 0)

          return (
            <View key={group} style={styles.groupCard}>
              <Pressable
                style={({ pressed }) => [styles.groupHeader, pressed && styles.groupHeaderPressed]}
                onPress={() => setExpandedGroups(prev => ({ ...prev, [group]: !expanded }))}
              >
                <View style={[styles.groupIconWrap, { backgroundColor: `${style.color}22` }]}>
                  <Ionicons name={style.icon} size={18} color={style.color} />
                </View>
                <View style={styles.groupTitleWrap}>
                  <Text style={styles.groupTitle}>{group.toUpperCase()}</Text>
                  <Text style={styles.groupCount}>{items.length} endpoints</Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </Pressable>

              <View style={styles.routeList}>
                {visibleItems.map(item => (
                  <View key={`${item.method}:${item.route}`} style={styles.routeRow}>
                    <View style={[styles.methodPill, methodPillStyle(item.method)]}>
                      <Text style={[styles.methodText, methodTextStyle(item.method)]}>{item.method}</Text>
                    </View>
                    <View style={styles.routeBody}>
                      <Text style={styles.routePath} numberOfLines={1}>
                        {item.route}
                      </Text>
                      <Text style={styles.routeFile} numberOfLines={1}>
                        {item.file}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {hiddenCount > 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.moreRow, pressed && styles.moreRowPressed]}
                  onPress={() => setExpandedGroups(prev => ({ ...prev, [group]: true }))}
                >
                  <Text style={styles.moreText}>Afficher {hiddenCount} routes de plus</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                </Pressable>
              ) : null}
            </View>
          )
        })}
      </View>
    </ScreenScaffold>
  )
}

const methodPillStyle = (method: string) => {
  switch (method) {
    case 'GET':
      return { backgroundColor: 'rgba(15, 96, 196, 0.14)' }
    case 'POST':
      return { backgroundColor: 'rgba(15, 157, 88, 0.14)' }
    case 'PATCH':
      return { backgroundColor: 'rgba(255, 110, 20, 0.14)' }
    case 'DELETE':
      return { backgroundColor: 'rgba(220, 38, 38, 0.14)' }
    case 'PUT':
      return { backgroundColor: 'rgba(124, 58, 237, 0.14)' }
    default:
      return { backgroundColor: colors.surfaceMuted }
  }
}

const methodTextStyle = (method: string) => {
  switch (method) {
    case 'GET':
      return { color: '#0f60c4' }
    case 'POST':
      return { color: '#0f9d58' }
    case 'PATCH':
      return { color: '#ff6e14' }
    case 'DELETE':
      return { color: '#dc2626' }
    case 'PUT':
      return { color: '#7c3aed' }
    default:
      return { color: colors.text }
  }
}

const styles = StyleSheet.create({
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-around',
    ...shadows.soft
  },
  summaryMetric: {
    alignItems: 'center'
  },
  summaryValue: {
    color: colors.primary,
    fontSize: typography.title,
    fontWeight: typography.weightBlack
  },
  summaryLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  searchWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm
  },
  groups: {
    gap: spacing.sm
  },
  groupCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden'
  },
  groupHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  groupHeaderPressed: {
    backgroundColor: colors.surfaceAlt
  },
  groupIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center'
  },
  groupTitleWrap: {
    flex: 1
  },
  groupTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  groupCount: {
    marginTop: 1,
    color: colors.muted,
    fontSize: typography.caption
  },
  routeList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.xs
  },
  methodPill: {
    minWidth: 56,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'center'
  },
  methodText: {
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  routeBody: {
    flex: 1
  },
  routePath: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  routeFile: {
    color: colors.muted,
    fontSize: typography.captionSm
  },
  moreRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  moreRowPressed: {
    backgroundColor: colors.surfaceAlt
  },
  moreText: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  }
})
