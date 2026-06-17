import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ListingCard } from '@/components/ui/ListingCard'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { dashboardApi } from '@/features/dashboard/dashboard.api'
import { useClientPagination } from '@/core/pagination/useClientPagination'
import { useTabScreenInsets } from '@/core/layout/useTabScreenInsets'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

export default function FavoritesTabScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { topInset, bottomInset } = useTabScreenInsets()

  const query = useQuery({
    queryKey: ['dashboard', 'favorites'],
    queryFn: () => dashboardApi.favorites()
  })

  const removeMutation = useMutation({
    mutationFn: (listingId: string) => dashboardApi.removeFavorite(listingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', 'favorites'] })
  })
  const pagination = useClientPagination(query.data, 12)

  return (
    <View style={[styles.screen, { paddingTop: topInset + spacing.sm }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Favoris</Text>
        <Text style={styles.subtitle}>Retrouve rapidement les annonces enregistrées.</Text>
      </View>

      <FlatList
        numColumns={2}
        data={pagination.visibleItems}
        keyExtractor={item => item.id}
        columnWrapperStyle={styles.column}
        contentContainerStyle={{ paddingBottom: bottomInset + spacing.md }}
        ListFooterComponent={
          pagination.hasMore ? <LoadMoreButton onPress={pagination.loadMore} label={`Charger ${Math.min(12, pagination.totalCount - pagination.visibleCount)} de plus`} /> : null
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>{query.isLoading ? 'Chargement...' : 'Aucun favori pour le moment.'}</Text>
            <Text style={styles.emptyText}>Ajoute des annonces en favoris depuis la home ou les résultats.</Text>
          </View>
        }
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
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg
  },
  header: {
    marginBottom: spacing.md
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
  },
  emptyBox: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  emptyText: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.bodySm
  }
})
