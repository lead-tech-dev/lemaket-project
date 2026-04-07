import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { dashboardApi } from '@/features/dashboard/dashboard.api'
import { useClientPagination } from '@/core/pagination/useClientPagination'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

export default function DashboardAlertsScreen() {
  const queryClient = useQueryClient()
  const [term, setTerm] = useState('')
  const [location, setLocation] = useState('')

  const query = useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn: () => dashboardApi.alerts()
  })

  const createMutation = useMutation({
    mutationFn: () =>
      dashboardApi.createAlert({
        term: term.trim() || undefined,
        location: location.trim() || undefined
      }),
    onSuccess: () => {
      setTerm('')
      setLocation('')
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'alerts'] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => dashboardApi.updateAlert(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', 'alerts'] })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dashboardApi.removeAlert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', 'alerts'] })
  })

  const canCreate = useMemo(() => term.trim().length > 0 || location.trim().length > 0, [term, location])
  const pagination = useClientPagination(query.data, 8)

  return (
    <ScreenScaffold title="Alertes" subtitle="Créez et gérez vos alertes de recherche.">
      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Nouvelle alerte</Text>
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Terme (ex: voiture)"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Localisation (ex: Douala)"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
        <Pressable
          style={[styles.primaryButton, (!canCreate || createMutation.isPending) && { opacity: 0.6 }]}
          disabled={!canCreate || createMutation.isPending}
          onPress={() => createMutation.mutate()}
        >
          <Text style={styles.primaryButtonText}>Créer l&apos;alerte</Text>
        </Pressable>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Mes alertes</Text>
        {query.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        <FlatList
          scrollEnabled={false}
          data={pagination.visibleItems}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={dashboardStyles.empty}>Aucune alerte pour le moment.</Text>}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListFooterComponent={pagination.hasMore ? <LoadMoreButton onPress={pagination.loadMore} /> : null}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                    {[item.term, item.location].filter(Boolean).join(' · ') || 'Alerte'}
                  </Text>
                  <Text style={styles.meta}>Créée le {new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
                </View>
                <Switch
                  value={item.isActive}
                  onValueChange={next => updateMutation.mutate({ id: item.id, isActive: next })}
                />
              </View>
              <Text style={styles.deleteText} onPress={() => deleteMutation.mutate(item.id)}>
                Supprimer
              </Text>
            </View>
          )}
        />
      </View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    color: colors.text
  },
  primaryButton: {
    marginTop: spacing.sm,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  meta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  deleteText: {
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  }
})
