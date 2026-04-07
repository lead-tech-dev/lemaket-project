import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { dashboardApi } from '@/features/dashboard/dashboard.api'
import { ListingCard } from '@/components/ui/ListingCard'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { useClientPagination } from '@/core/pagination/useClientPagination'
import { colors, spacing, typography } from '@/core/theme/tokens'

export default function DashboardFavoritesScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['dashboard', 'favorites'],
    queryFn: () => dashboardApi.favorites()
  })

  const removeMutation = useMutation({
    mutationFn: (listingId: string) => dashboardApi.removeFavorite(listingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', 'favorites'] })
  })
  const pagination = useClientPagination(query.data, 10)

  return (
    <ScreenScaffold title="Favoris" subtitle="Retrouvez vos annonces préférées.">
      <View style={dashboardStyles.sectionCard}>
        {query.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        <FlatList
          numColumns={2}
          scrollEnabled={false}
          data={pagination.visibleItems}
          keyExtractor={item => item.id}
          columnWrapperStyle={styles.column}
          ListFooterComponent={pagination.hasMore ? <LoadMoreButton onPress={pagination.loadMore} /> : null}
          ListEmptyComponent={<Text style={dashboardStyles.empty}>Aucun favori pour le moment.</Text>}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <ListingCard
                item={item.listing}
                style={styles.card}
                onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.listing.id } })}
              />
              <Text
                style={styles.remove}
                onPress={() => {
                  Alert.alert('Favoris', 'Retirer cette annonce de vos favoris ?', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Retirer',
                      style: 'destructive',
                      onPress: () => removeMutation.mutate(item.listing.id)
                    }
                  ])
                }}
              >
                Retirer des favoris
              </Text>
            </View>
          )}
        />
      </View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  item: {
    flex: 1,
    marginBottom: spacing.sm
  },
  column: {
    gap: spacing.sm
  },
  card: {
    flex: 1
  },
  remove: {
    marginTop: spacing.xs,
    textAlign: 'left',
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  }
})
