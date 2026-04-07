import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { dashboardApi } from '@/features/dashboard/dashboard.api'
import { useClientPagination } from '@/core/pagination/useClientPagination'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

export default function DashboardFollowsScreen() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['dashboard', 'follows'],
    queryFn: () => dashboardApi.follows()
  })

  const unfollowMutation = useMutation({
    mutationFn: (sellerId: string) => dashboardApi.unfollowSeller(sellerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', 'follows'] })
  })
  const pagination = useClientPagination(query.data, 8)

  return (
    <ScreenScaffold title="Mes suivis" subtitle="Suivez vos vendeurs favoris pour ne rien rater.">
      <View style={dashboardStyles.sectionCard}>
        {query.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        <FlatList
          scrollEnabled={false}
          data={pagination.visibleItems}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={dashboardStyles.empty}>Aucun vendeur suivi.</Text>}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListFooterComponent={pagination.hasMore ? <LoadMoreButton onPress={pagination.loadMore} /> : null}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.location || '—'} · {item.listingCount} annonces · {item.followersCount} abonnés
              </Text>
              <Pressable style={styles.action} onPress={() => unfollowMutation.mutate(item.id)}>
                <Text style={styles.actionText}>Ne plus suivre</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md
  },
  name: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  meta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  action: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  actionText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  }
})
