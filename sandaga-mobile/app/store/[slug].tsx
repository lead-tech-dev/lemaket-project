import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ListingCard } from '@/components/ui/ListingCard'
import { API_BASE_URL } from '@/core/config/env'
import { useSession } from '@/core/auth/session-context'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import { storefrontsApi } from '@/features/storefronts/storefronts.api'
import { usersApi } from '@/features/users/users.api'

const resolveMediaUrl = (raw?: string | null) => {
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${API_BASE_URL}${raw.startsWith('/') ? raw : `/${raw}`}`
}

export default function StorefrontScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { width } = useWindowDimensions()
  const { user } = useSession()
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug

  const storefrontQuery = useQuery({
    queryKey: ['storefront', normalizedSlug],
    queryFn: () => storefrontsApi.bySlug(normalizedSlug!),
    enabled: Boolean(normalizedSlug)
  })

  const listingsQuery = useQuery({
    queryKey: ['storefront', normalizedSlug, 'listings'],
    queryFn: () => storefrontsApi.listings(normalizedSlug!),
    enabled: Boolean(normalizedSlug)
  })

  const followMutation = useMutation({
    mutationFn: async () => {
      const storefront = storefrontQuery.data
      if (!storefront) return
      if (storefront.isFollowed) {
        return usersApi.unfollowSeller(storefront.id)
      }
      return usersApi.followSeller(storefront.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront', normalizedSlug] })
    }
  })

  const storefront = storefrontQuery.data
  const listings = listingsQuery.data?.data ?? []
  const heroUrl = resolveMediaUrl(storefront?.heroUrl)
  const avatarUrl = resolveMediaUrl(storefront?.avatarUrl)
  const cardWidth = Math.max((width - spacing.lg * 2 - spacing.sm) / 2, 148)
  const isOwner = Boolean(storefront && user?.id === storefront.id)

  if (!normalizedSlug) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Boutique introuvable.</Text>
      </View>
    )
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Boutique
        </Text>
      </View>

      {storefrontQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {storefrontQuery.isError || !storefront ? (
        <View style={styles.center}>
          <Text style={styles.error}>Impossible de charger cette boutique.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroCard}>
            <View style={styles.heroMedia}>
              {heroUrl ? (
                <Image source={{ uri: heroUrl }} resizeMode="cover" style={styles.heroImage} />
              ) : (
                <View style={styles.heroFallback}>
                  <Ionicons name="storefront-outline" size={30} color={colors.muted} />
                </View>
              )}
            </View>

            <View style={styles.heroBody}>
              <View style={styles.identityRow}>
                <View style={styles.avatar}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} resizeMode="cover" style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person-outline" size={20} color={colors.text} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopName} numberOfLines={1}>
                    {storefront.name}
                  </Text>
                  {storefront.tagline ? (
                    <Text style={styles.shopTagline} numberOfLines={1}>
                      {storefront.tagline}
                    </Text>
                  ) : null}
                </View>
                {!isOwner ? (
                  <Pressable
                    style={styles.followButton}
                    onPress={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                  >
                    <Text style={styles.followButtonText}>{storefront.isFollowed ? 'Suivi' : 'Suivre'}</Text>
                  </Pressable>
                ) : null}
              </View>

              {storefront.location ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={colors.muted} />
                  <Text style={styles.locationText}>{storefront.location}</Text>
                </View>
              ) : null}

              <View style={styles.statsRow}>
                <View style={styles.statPill}>
                  <Text style={styles.statValue}>{storefront.stats.listingCount}</Text>
                  <Text style={styles.statLabel}>annonces</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statValue}>{storefront.followersCount}</Text>
                  <Text style={styles.statLabel}>abonnés</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statValue}>
                    {storefront.stats.averageRating > 0 ? storefront.stats.averageRating.toFixed(1) : '-'}
                  </Text>
                  <Text style={styles.statLabel}>avis</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Annonces de la boutique</Text>
          </View>

          {listingsQuery.isLoading ? (
            <View style={styles.centerInline}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}

          {listings.length > 0 ? (
            <View style={styles.grid}>
              {listings.map(item => (
                <ListingCard
                  key={item.id}
                  item={item}
                  style={{ width: cardWidth }}
                  onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.id } })}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Aucune annonce publiée pour cette boutique.</Text>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    marginLeft: spacing.sm,
    color: colors.text,
    fontSize: typography.title,
    fontWeight: typography.weightExtrabold
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.soft
  },
  heroMedia: {
    height: 126,
    backgroundColor: colors.surfaceMuted
  },
  heroImage: {
    width: '100%',
    height: '100%'
  },
  heroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroBody: {
    padding: spacing.md
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: '100%',
    height: '100%'
  },
  shopName: {
    color: colors.text,
    fontWeight: typography.weightExtrabold,
    fontSize: typography.body
  },
  shopTagline: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  followButton: {
    minHeight: 34,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  followButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  locationRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  locationText: {
    color: colors.text,
    fontSize: typography.caption
  },
  statsRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm
  },
  statPill: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  statValue: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  statLabel: {
    marginTop: 1,
    color: colors.muted,
    fontSize: typography.captionSm
  },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: typography.weightExtrabold
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  emptyText: {
    marginTop: spacing.md,
    color: colors.muted,
    textAlign: 'center'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerInline: {
    marginVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  error: {
    color: colors.danger,
    fontWeight: typography.weightBold
  }
})
