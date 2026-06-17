import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { dashboardApi } from '@/features/dashboard/dashboard.api'
import { colors, spacing, typography } from '@/core/theme/tokens'

export default function DashboardOverviewScreen() {
  const query = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => dashboardApi.overview()
  })

  const insights = query.data?.sellerInsights
  const total = (insights?.proListings ?? 0) + (insights?.individualListings ?? 0)

  return (
    <ScreenScaffold title="Vue d'ensemble" subtitle="Répartition des vendeurs et performance globale.">
      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Répartition des annonces</Text>
        {query.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        {!query.isLoading && !insights ? <Text style={dashboardStyles.empty}>Aucune donnée pour le moment.</Text> : null}
        {insights ? (
          <View style={styles.grid}>
            <View style={[styles.card, styles.cardPro]}>
              <Text style={styles.cardLabel}>Vendeurs vérifiés</Text>
              <Text style={styles.cardShare}>{insights.proShare.toFixed(1)}%</Text>
              <Text style={styles.cardHint}>{insights.proListings} annonces</Text>
            </View>
            <View style={[styles.card, styles.cardIndiv]}>
              <Text style={styles.cardLabel}>Particuliers</Text>
              <Text style={styles.cardShare}>{insights.individualShare.toFixed(1)}%</Text>
              <Text style={styles.cardHint}>{insights.individualListings} annonces</Text>
            </View>
          </View>
        ) : null}
        {insights ? <Text style={styles.summary}>Total catalogue: {total} annonces publiées.</Text> : null}
      </View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md
  },
  cardPro: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoftStrong
  },
  cardIndiv: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftStrong
  },
  cardLabel: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  cardShare: {
    marginTop: spacing.xs,
    color: colors.text,
    fontWeight: typography.weightBlack,
    fontSize: typography.title
  },
  cardHint: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  summary: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: typography.bodySm
  }
})
