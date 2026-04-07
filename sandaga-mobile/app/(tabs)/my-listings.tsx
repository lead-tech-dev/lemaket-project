import { useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { listingsApi, type ListingItem } from '@/features/listings/listings.api'
import { ListingCard } from '@/components/ui/ListingCard'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { useClientPagination } from '@/core/pagination/useClientPagination'
import { useTabScreenInsets } from '@/core/layout/useTabScreenInsets'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'

type ListingStatusFilter = 'all' | 'published' | 'draft' | 'pending' | 'archived' | 'expired' | 'rejected'

const STATUS_OPTIONS: { value: ListingStatusFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'published', label: 'En ligne' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'pending', label: 'En revue' },
  { value: 'archived', label: 'Retirées' },
  { value: 'expired', label: 'Expirées' },
  { value: 'rejected', label: 'Refusées' }
]

function getStatusLabel(status?: string) {
  switch (status) {
    case 'published':
      return 'En ligne'
    case 'draft':
      return 'Brouillon'
    case 'pending':
      return 'En revue'
    case 'archived':
      return 'Retirée'
    case 'expired':
      return 'Expirée'
    case 'rejected':
      return 'Refusée'
    default:
      return 'Annonce'
  }
}

function getStatusTheme(status?: string) {
  switch (status) {
    case 'published':
      return {
        bg: colors.successSoft ?? colors.primarySoft,
        border: colors.primarySoftStrong,
        text: colors.success ?? colors.primary
      }
    case 'draft':
      return {
        bg: colors.surfaceMuted,
        border: colors.border,
        text: colors.text
      }
    case 'pending':
      return {
        bg: colors.warningSoft,
        border: colors.accentOutline,
        text: colors.warning
      }
    case 'archived':
    case 'expired':
      return {
        bg: colors.surfaceAlt,
        border: colors.borderStrong,
        text: colors.muted
      }
    case 'rejected':
      return {
        bg: colors.dangerSurface,
        border: colors.dangerSurfaceStrong,
        text: colors.danger
      }
    default:
      return {
        bg: colors.surfaceMuted,
        border: colors.border,
        text: colors.text
      }
  }
}

function getPrimaryAction(item: ListingItem) {
  switch (item.status) {
    case 'draft':
    case 'archived':
    case 'expired':
      return { label: 'Publier', icon: 'radio-outline' as const, status: 'published' }
    case 'published':
      return { label: 'Retirer', icon: 'pause-circle-outline' as const, status: 'archived' }
    case 'rejected':
      return { label: 'Corriger', icon: 'create-outline' as const, status: null }
    default:
      return null
  }
}

export default function MyListingsScreen() {
  const router = useRouter()
  const { topInset, bottomInset } = useTabScreenInsets()
  const queryClient = useQueryClient()
  const [activeStatus, setActiveStatus] = useState<ListingStatusFilter>('all')

  const query = useQuery({
    queryKey: ['listings', 'mine'],
    queryFn: () => listingsApi.mine()
  })

  const updateMutation = useMutation({
    mutationFn: ({ listingId, status }: { listingId: string; status: string }) => listingsApi.update(listingId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings', 'mine'] })
      queryClient.invalidateQueries({ queryKey: ['listings', 'latest'] })
      queryClient.invalidateQueries({ queryKey: ['listings', 'search'] })
    }
  })

  const removeMutation = useMutation({
    mutationFn: (listingId: string) => listingsApi.remove(listingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings', 'mine'] })
      queryClient.invalidateQueries({ queryKey: ['listings', 'latest'] })
      queryClient.invalidateQueries({ queryKey: ['listings', 'search'] })
    }
  })

  const items = useMemo(() => query.data ?? [], [query.data])
  const filteredItems = useMemo(() => {
    if (activeStatus === 'all') {
      return items
    }
    return items.filter(item => (item.status ?? '') === activeStatus)
  }, [activeStatus, items])
  const pagination = useClientPagination(filteredItems, 12)

  const counts = useMemo(() => {
    return {
      published: items.filter(item => item.status === 'published').length,
      draft: items.filter(item => item.status === 'draft').length,
      pending: items.filter(item => item.status === 'pending').length,
      archived: items.filter(item => item.status === 'archived').length,
      expired: items.filter(item => item.status === 'expired').length,
      rejected: items.filter(item => item.status === 'rejected').length
    }
  }, [items])

  const handleStatusAction = (item: ListingItem) => {
    const action = getPrimaryAction(item)
    if (!action) {
      if (item.status === 'pending') {
        Alert.alert('Annonce en revue', 'Cette annonce est en cours de validation.')
      }
      return
    }

    if (!action.status) {
      router.push({ pathname: '/listings/[id]/edit', params: { id: item.id } })
      return
    }

    Alert.alert(action.label, `Confirmer l’action « ${action.label.toLowerCase()} » pour cette annonce ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: action.label,
        onPress: () => updateMutation.mutate({ listingId: item.id, status: action.status })
      }
    ])
  }

  return (
    <View style={[styles.screen, { paddingTop: topInset + spacing.sm }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Mes annonces</Text>
          <Text style={styles.subtitle}>
            {items.length} annonce{items.length > 1 ? 's' : ''} au total
          </Text>
        </View>
        <Pressable style={styles.newButton} onPress={() => router.push('/listings/new')}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.newButtonText}>Publier</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{counts.published}</Text>
          <Text style={styles.statLabel}>En ligne</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{counts.draft + counts.pending + counts.rejected}</Text>
          <Text style={styles.statLabel}>À finaliser</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{counts.archived + counts.expired}</Text>
          <Text style={styles.statLabel}>Hors ligne</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterTabsWrap}
        contentContainerStyle={styles.filterTabsContent}
      >
        {STATUS_OPTIONS.map(option => {
          const isActive = activeStatus === option.value
          const count = option.value === 'all' ? items.length : items.filter(item => item.status === option.value).length
          return (
            <Pressable
              key={option.value}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => setActiveStatus(option.value)}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>{option.label}</Text>
              <View style={[styles.filterTabCount, isActive && styles.filterTabCountActive]}>
                <Text style={[styles.filterTabCountText, isActive && styles.filterTabCountTextActive]}>{count}</Text>
              </View>
            </Pressable>
          )
        })}
      </ScrollView>

      <FlatList
        numColumns={2}
        data={pagination.visibleItems}
        keyExtractor={item => item.id}
        columnWrapperStyle={styles.column}
        contentContainerStyle={{ paddingBottom: bottomInset + spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              void query.refetch()
            }}
          />
        }
        ListFooterComponent={pagination.hasMore ? <LoadMoreButton onPress={pagination.loadMore} /> : null}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={28} color={colors.muted} />
            <Text style={styles.emptyTitle}>Aucune annonce</Text>
            <Text style={styles.emptyText}>
              {activeStatus === 'all'
                ? 'Crée ta première annonce pour commencer à vendre.'
                : `Aucune annonce dans “${STATUS_OPTIONS.find(option => option.value === activeStatus)?.label ?? 'ce statut'}”.`}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const primaryAction = getPrimaryAction(item)
          const theme = getStatusTheme(item.status)
          return (
            <View style={styles.listItem}>
              <View style={styles.cardWrap}>
                <ListingCard
                  item={item}
                  style={styles.card}
                  onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.id } })}
                />
                <View style={[styles.statusBadge, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Text style={[styles.statusBadgeText, { color: theme.text }]}>{getStatusLabel(item.status)}</Text>
                </View>
              </View>

              <View style={styles.rowActions}>
                <Pressable
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => router.push({ pathname: '/listings/[id]/edit', params: { id: item.id } })}
                >
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                  <Text style={styles.editButtonText}>Modifier</Text>
                </Pressable>

                {primaryAction ? (
                  <Pressable
                    style={[styles.actionButton, styles.statusButton]}
                    onPress={() => handleStatusAction(item)}
                  >
                    <Ionicons name={primaryAction.icon} size={15} color={colors.accent} />
                    <Text style={styles.statusButtonText}>{primaryAction.label}</Text>
                  </Pressable>
                ) : null}

                {item.status === 'published' ? (
                  <Pressable
                    style={[styles.actionButton, styles.promoteButton]}
                    onPress={() =>
                      router.push({
                        pathname: '/dashboard/promotions',
                        params: {
                          listingId: item.id,
                          category: item.category?.slug ?? ''
                        }
                      })
                    }
                  >
                    <Ionicons name="flash-outline" size={15} color={colors.accent} />
                    <Text style={styles.promoteButtonText}>Booster</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => {
                    Alert.alert('Supprimer', 'Confirmer la suppression de cette annonce ?', [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Supprimer',
                        style: 'destructive',
                        onPress: () => removeMutation.mutate(item.id)
                      }
                    ])
                  }}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={styles.deleteButtonText}>Supprimer</Text>
                </Pressable>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm
  },
  headerCopy: {
    flex: 1
  },
  title: {
    fontSize: typography.titleLg,
    lineHeight: 34,
    color: colors.text,
    fontWeight: typography.weightBlack
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.soft
  },
  newButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md
  },
  statValue: {
    color: colors.text,
    fontWeight: typography.weightExtrabold,
    fontSize: typography.title
  },
  statLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  filterTabsWrap: {
    marginBottom: spacing.md
  },
  filterTabsContent: {
    gap: spacing.xs,
    paddingRight: spacing.lg
  },
  filterTab: {
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  filterTabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  filterTabText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  filterTabTextActive: {
    color: colors.primary
  },
  filterTabCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  filterTabCountActive: {
    backgroundColor: colors.white
  },
  filterTabCountText: {
    color: colors.muted,
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  filterTabCountTextActive: {
    color: colors.primary
  },
  listItem: {
    flex: 1,
    marginBottom: spacing.md
  },
  column: {
    gap: spacing.sm
  },
  cardWrap: {
    position: 'relative'
  },
  card: {
    flex: 1
  },
  statusBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  statusBadgeText: {
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  rowActions: {
    flexDirection: 'column',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    justifyContent: 'center'
  },
  editButton: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  editButtonText: {
    color: colors.primary,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  statusButton: {
    borderColor: colors.accentSoftStrong,
    backgroundColor: colors.accentSoft
  },
  statusButtonText: {
    color: colors.accent,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  promoteButton: {
    borderColor: colors.accentSoftStrong,
    backgroundColor: colors.accentSoft
  },
  promoteButtonText: {
    color: colors.accent,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  deleteButton: {
    borderColor: colors.dangerSurfaceStrong,
    backgroundColor: colors.dangerSurface
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  emptyBox: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs
  },
  emptyTitle: {
    marginTop: spacing.sm,
    color: colors.text,
    fontWeight: typography.weightBold
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: typography.bodySm
  }
})
