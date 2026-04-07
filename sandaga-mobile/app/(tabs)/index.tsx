import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { categoriesApi } from '@/features/categories/categories.api'
import type { CategoryNode } from '@/features/categories/categories.api'
import { listingsApi } from '@/features/listings/listings.api'
import type { ListingItem } from '@/features/listings/listings.api'
import { homeApi } from '@/features/home/home.api'
import type { HomeListingCard, HomeStorefrontCard } from '@/features/home/home.api'
import { ListingCard } from '@/components/ui/ListingCard'
import { isMobileFeatureEnabled } from '@/core/config/featureFlags'
import { useTabScreenInsets } from '@/core/layout/useTabScreenInsets'
import { colors, controls, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import { getListingImageSource, resolveMediaUrl } from '@/core/utils/listing-image'

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  immobilier: 'home-outline',
  voitures: 'car-outline',
  vehicules: 'car-outline',
  vacances: 'sunny-outline',
  mode: 'shirt-outline',
  services: 'construct-outline',
  emploi: 'briefcase-outline'
}

type QuickCategory = {
  id: string
  label: string
  slug: string
  icon: string | null
  color: string | null
  gradient: string | null
  children: { id: string; name: string; slug: string }[]
  fallbackIcon: keyof typeof Ionicons.glyphMap
}

const fallbackParentCategories: CategoryNode[] = [
  {
    id: 'cat-realestate',
    name: 'Immobilier',
    slug: 'immobilier',
    parentId: null,
    isActive: true,
    icon: '🏠',
    color: colors.accent,
    gradient: 'linear-gradient(135deg, rgba(0, 112, 221, 0.22), rgba(0, 78, 165, 0.14))',
    children: []
  },
  {
    id: 'cat-vehicles',
    name: 'Vehicules',
    slug: 'vehicules',
    parentId: null,
    isActive: true,
    icon: '🚘',
    color: colors.primary,
    gradient: 'linear-gradient(135deg, rgba(255, 110, 20, 0.22), rgba(217, 91, 15, 0.14))',
    children: []
  },
  {
    id: 'cat-holidays',
    name: 'Vacances',
    slug: 'vacances',
    parentId: null,
    isActive: true,
    icon: '🏖️',
    color: colors.success,
    gradient: 'linear-gradient(135deg, rgba(0, 164, 108, 0.22), rgba(0, 120, 86, 0.14))',
    children: []
  },
  {
    id: 'cat-services',
    name: 'Services',
    slug: 'services',
    parentId: null,
    isActive: true,
    icon: '🛠️',
    color: colors.accent,
    gradient: 'linear-gradient(135deg, rgba(15, 118, 110, 0.2), rgba(15, 118, 110, 0.1))',
    children: []
  },
  {
    id: 'cat-fashion',
    name: 'Mode',
    slug: 'mode',
    parentId: null,
    isActive: true,
    icon: '👕',
    color: colors.warning,
    gradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(124, 58, 237, 0.1))',
    children: []
  },
  {
    id: 'cat-jobs',
    name: 'Emploi',
    slug: 'emploi',
    parentId: null,
    isActive: true,
    icon: '💼',
    color: colors.primaryDark,
    gradient: 'linear-gradient(135deg, rgba(194, 65, 12, 0.2), rgba(194, 65, 12, 0.1))',
    children: []
  }
]

const mapHomeListingToListingItem = (item: HomeListingCard): ListingItem => ({
  id: item.id,
  title: item.title,
  description: null,
  price: item.price,
  currency: item.currency || 'XAF',
  location: {
    city: item.city || '',
    address: item.location || ''
  },
  images: item.coverImage ? [item.coverImage] : [],
  category: item.category
    ? {
        id: item.category.id,
        name: item.category.name
      }
    : null
})

const formatResultCount = (count: number): string => {
  const safe = Number.isFinite(count) ? Math.max(0, count) : 0
  return `${new Intl.NumberFormat('fr-CM').format(safe)} résultats`
}

const resolveCategoryIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const normalized = name.trim().toLowerCase()
  if (!normalized) {
    return 'apps-outline'
  }

  for (const [key, icon] of Object.entries(categoryIcons)) {
    if (normalized.includes(key)) {
      return icon
    }
  }

  return 'apps-outline'
}

const isHexColor = (value: string): boolean => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())

const hexToRgba = (hexColor: string, alpha: number): string => {
  const raw = hexColor.replace('#', '').trim()
  const normalized = raw.length === 3 ? raw.split('').map(char => `${char}${char}`).join('') : raw
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const parseGradientColors = (gradient?: string | null): [string, string] | null => {
  if (!gradient) {
    return null
  }

  const tokens = gradient.match(/#(?:[0-9a-f]{3,8})|rgba?\([^)]+\)|hsla?\([^)]+\)/gi) ?? []
  if (tokens.length < 2) {
    return null
  }

  return [tokens[0], tokens[1]]
}

const gradientSvgDataUri = ([startColor, endColor]: [string, string]): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${startColor}"/><stop offset="100%" stop-color="${endColor}"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const resolveCategoryColors = (color?: string | null) => {
  const defaultIcon = colors.text
  const defaultBg = colors.surfaceMuted
  const defaultBorder = colors.border

  if (!color) {
    return {
      iconColor: defaultIcon,
      backgroundColor: defaultBg,
      borderColor: defaultBorder
    }
  }

  const trimmed = color.trim()
  if (isHexColor(trimmed)) {
    return {
      iconColor: trimmed,
      backgroundColor: hexToRgba(trimmed, 0.16),
      borderColor: hexToRgba(trimmed, 0.28)
    }
  }

  return {
    iconColor: trimmed,
    backgroundColor: defaultBg,
    borderColor: defaultBorder
  }
}

const isLikelyGlyph = (value: string): boolean => {
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= 4 && !/[a-z0-9_-]/i.test(trimmed)
}

export default function HomeScreen() {
  const { width } = useWindowDimensions()
  const { topInset, bottomInset } = useTabScreenInsets()
  const router = useRouter()
  const showStorefrontsSection = isMobileFeatureEnabled('homeStorefronts')
  const [currentBanner, setCurrentBanner] = useState(0)
  const [isCategoriesModalVisible, setIsCategoriesModalVisible] = useState(false)
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState<string | null>(null)

  const listingsQuery = useQuery({
    queryKey: ['listings', 'latest'],
    queryFn: () => listingsApi.latest(20)
  })

  const featuredQuery = useQuery({
    queryKey: ['home', 'featured-listings'],
    queryFn: () => homeApi.featuredListings(8)
  })

  const trendingQuery = useQuery({
    queryKey: ['home', 'trending-searches'],
    queryFn: () => homeApi.trendingSearches()
  })

  const storefrontsQuery = useQuery({
    queryKey: ['home', 'storefronts'],
    queryFn: () => homeApi.storefronts(8),
    enabled: showStorefrontsSection
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => categoriesApi.active()
  })

  const data = useMemo(() => listingsQuery.data?.data ?? [], [listingsQuery.data])
  const featured = useMemo(
    () => (featuredQuery.data ?? []).map(mapHomeListingToListingItem).slice(0, 6),
    [featuredQuery.data]
  )
  const trending = useMemo(() => trendingQuery.data ?? [], [trendingQuery.data])
  const storefronts = useMemo(() => storefrontsQuery.data ?? [], [storefrontsQuery.data])
  const parentCategories = useMemo(
    () =>
      ((categoriesQuery.data ?? [])
        .filter(category => !category.parentId)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')) as CategoryNode[]),
    [categoriesQuery.data]
  )
  const allParentCategories = parentCategories.length > 0 ? parentCategories : fallbackParentCategories
  const quickCategories = useMemo<QuickCategory[]>(
    () =>
      allParentCategories.slice(0, 5).map(category => ({
        id: category.id,
        label: category.name,
        slug: category.slug,
        icon: category.icon ?? null,
        color: category.color ?? null,
        gradient: category.gradient ?? null,
        children: category.children ?? [],
        fallbackIcon: resolveCategoryIcon(category.name)
      })),
    [allParentCategories]
  )
  const selectedParentCategory = useMemo(
    () => allParentCategories.find(category => category.id === selectedParentCategoryId) ?? null,
    [allParentCategories, selectedParentCategoryId]
  )
  const banners = useMemo(() => data.slice(0, 5), [data])
  const recent = useMemo(() => data.slice(0, 10), [data])
  const cardWidth = Math.max((width - spacing.lg * 2 - spacing.md) / 2, 150)
  const isRefreshing =
    listingsQuery.isRefetching ||
    featuredQuery.isRefetching ||
    trendingQuery.isRefetching ||
    (showStorefrontsSection && storefrontsQuery.isRefetching) ||
    categoriesQuery.isRefetching

  if (listingsQuery.isLoading && !data.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  if (listingsQuery.error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Impossible de charger les annonces.</Text>
      </View>
    )
  }

  const openSearchWithCategory = (slug: string) => {
    router.push({ pathname: '/(tabs)/search', params: { category: slug } })
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: topInset + spacing.sm, paddingBottom: bottomInset }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void Promise.all([
              listingsQuery.refetch(),
              featuredQuery.refetch(),
              trendingQuery.refetch(),
              ...(showStorefrontsSection ? [storefrontsQuery.refetch()] : []),
              categoriesQuery.refetch()
            ])
          }}
        />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.brand}>LEMAKET</Text>
        <Pressable style={styles.iconButton} onPress={() => router.push('/(tabs)/messages')}>
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      <Pressable style={styles.searchBar} onPress={() => router.push('/(tabs)/search')}>
        <Ionicons name="search-outline" size={24} color={colors.muted} />
        <Text style={styles.searchPlaceholder}>Rechercher sur LEMAKET</Text>
        <View style={styles.searchCamera}>
          <Ionicons name="camera-outline" size={18} color={colors.text} />
        </View>
      </Pressable>

      <View style={styles.categorySection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categorySlider}>
        {quickCategories.map(category => {
          const palette = resolveCategoryColors(category.color)
          const gradientColors = parseGradientColors(category.gradient)
          return (
            <Pressable
              key={category.id}
                style={styles.categoryItem}
                onPress={() => openSearchWithCategory(category.slug)}
            >
              <View
                style={[
                  styles.categoryIconWrap,
                  {
                    borderColor: palette.borderColor
                  }
                ]}
              >
                {gradientColors ? (
                  <ImageBackground
                    source={{ uri: gradientSvgDataUri(gradientColors) }}
                    resizeMode="cover"
                    style={styles.categoryIconFill}
                    imageStyle={styles.categoryIconFillImage}
                  >
                    {category.icon && isLikelyGlyph(category.icon) ? (
                      <Text style={styles.categoryGlyph}>{category.icon}</Text>
                    ) : (
                      <Ionicons name={category.fallbackIcon} size={24} color={palette.iconColor} />
                    )}
                  </ImageBackground>
                ) : (
                  <View style={[styles.categoryIconFill, { backgroundColor: palette.backgroundColor }]}>
                    {category.icon && isLikelyGlyph(category.icon) ? (
                      <Text style={styles.categoryGlyph}>{category.icon}</Text>
                    ) : (
                      <Ionicons name={category.fallbackIcon} size={24} color={palette.iconColor} />
                    )}
                  </View>
                )}
              </View>
              <Text style={styles.categoryLabel} numberOfLines={1}>
                {category.label}
              </Text>
            </Pressable>
          )
        })}
          <Pressable
            style={styles.categoryItem}
            onPress={() => {
              setSelectedParentCategoryId(null)
              setIsCategoriesModalVisible(true)
            }}
          >
            <View style={[styles.categoryIconWrap, styles.moreCategoryIconWrap]}>
              <View style={[styles.categoryIconFill, styles.moreCategoryIconFill]}>
                <Ionicons name="ellipsis-horizontal" size={24} color={colors.muted} />
              </View>
            </View>
            <Text style={styles.categoryLabel} numberOfLines={1}>
              Autres
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {banners.length > 0 ? (
        <View style={styles.bannerSection}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={event => {
              const index = Math.round(event.nativeEvent.contentOffset.x / width)
              setCurrentBanner(Math.max(0, Math.min(index, banners.length - 1)))
            }}
          >
            {banners.map(item => {
              const imageSource = getListingImageSource(item)
              return (
                <View key={item.id} style={{ width, paddingHorizontal: spacing.lg }}>
                  <Pressable
                    style={styles.bannerCard}
                    onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.id } })}
                  >
                    <Image source={imageSource} resizeMode="cover" style={styles.bannerImage} />
                  </Pressable>
                </View>
              )
            })}
          </ScrollView>
          <View style={styles.bannerDots}>
            {banners.map((item, index) => (
              <View key={item.id} style={[styles.bannerDot, index === currentBanner && styles.bannerDotActive]} />
            ))}
          </View>
        </View>
      ) : null}

      {featured.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Annonces à la une</Text>
          </View>
          <View style={styles.grid}>
            {featured.map(item => (
              <ListingCard
                key={item.id}
                item={item}
                style={{ width: cardWidth }}
                onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.id } })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {trending.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recherches tendances</Text>
          </View>
          <View style={styles.trendingGrid}>
            {trending.slice(0, 6).map(item => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.trendingPill, pressed && styles.trendingPillPressed]}
                onPress={() => router.push('/(tabs)/search')}
              >
                <View style={styles.trendingPillHeader}>
                  <View style={styles.trendingIconWrap}>
                    <Ionicons name="trending-up-outline" size={16} color={colors.accent} />
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </View>
                <Text style={styles.trendingLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.trendingMeta} numberOfLines={1}>
                  {formatResultCount(item.resultCount)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {showStorefrontsSection && storefronts.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Boutiques</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storefrontRow}>
            {storefronts.map((storefront: HomeStorefrontCard) => {
              const heroUrl = resolveMediaUrl(storefront.heroUrl ?? storefront.avatarUrl ?? null)
              return (
                <Pressable
                  key={storefront.id}
                  style={({ pressed }) => [styles.storefrontCard, pressed && styles.storefrontCardPressed]}
                  onPress={() => router.push({ pathname: '/store/[slug]', params: { slug: storefront.slug } })}
                >
                  <View style={styles.storefrontHeroWrap}>
                    {heroUrl ? (
                      <Image source={{ uri: heroUrl }} resizeMode="cover" style={styles.storefrontHero} />
                    ) : (
                      <View style={styles.storefrontHeroFallback}>
                        <Ionicons name="storefront-outline" size={20} color={colors.muted} />
                      </View>
                    )}
                  </View>
                  <View style={styles.storefrontBody}>
                    <View style={styles.storefrontTitleRow}>
                      <Text numberOfLines={1} style={styles.storefrontName}>
                        {storefront.name}
                      </Text>
                      {storefront.isVerified || storefront.isCompanyVerified ? (
                        <Ionicons name="checkmark-circle" size={15} color={colors.accent} />
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={styles.storefrontSubtitle}>
                      {storefront.location?.trim() || `${storefront.listingCount} annonces`}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Annonces récentes</Text>
      </View>

      <View style={styles.locationChip}>
        <Ionicons name="location-outline" size={16} color={colors.text} />
        <Text style={styles.locationChipText}>Tout le Cameroun</Text>
      </View>

      {recent.length > 0 ? (
        <View style={styles.grid}>
          {recent.map(item => (
            <ListingCard
              key={item.id}
              item={item}
              style={{ width: cardWidth }}
              onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.id } })}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Aucune annonce disponible pour le moment.</Text>
      )}

      <Modal
        visible={isCategoriesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsCategoriesModalVisible(false)
          setSelectedParentCategoryId(null)
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setIsCategoriesModalVisible(false)
              setSelectedParentCategoryId(null)
            }}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              {selectedParentCategory ? (
                <Pressable style={styles.modalBackButton} onPress={() => setSelectedParentCategoryId(null)}>
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
              ) : (
                <View style={styles.modalBackButtonPlaceholder} />
              )}
              <Text style={styles.modalTitle}>
                {selectedParentCategory ? selectedParentCategory.name : 'Toutes les catégories'}
              </Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => {
                  setIsCategoriesModalVisible(false)
                  setSelectedParentCategoryId(null)
                }}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
              {selectedParentCategory
                ? (selectedParentCategory.children ?? []).map(child => (
                    <Pressable
                      key={child.id}
                      style={({ pressed }) => [styles.modalRow, pressed && styles.modalRowPressed]}
                      onPress={() => {
                        setIsCategoriesModalVisible(false)
                        setSelectedParentCategoryId(null)
                        openSearchWithCategory(child.slug)
                      }}
                    >
                      <Text style={styles.modalRowText}>{child.name}</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                    </Pressable>
                  ))
                : allParentCategories.map(category => (
                    <Pressable
                      key={category.id}
                      style={({ pressed }) => [styles.modalRow, pressed && styles.modalRowPressed]}
                      onPress={() => {
                        if ((category.children ?? []).length > 0) {
                          setSelectedParentCategoryId(category.id)
                          return
                        }
                        setIsCategoriesModalVisible(false)
                        openSearchWithCategory(category.slug)
                      }}
                    >
                      <Text style={styles.modalRowText}>{category.name}</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                    </Pressable>
                  ))}
              {selectedParentCategory && (selectedParentCategory.children ?? []).length === 0 ? (
                <Text style={styles.modalEmptyText}>Aucune sous-catégorie disponible.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 120
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    position: 'relative'
  },
  brand: {
    fontSize: typography.display,
    lineHeight: 42,
    fontWeight: typography.weightBlack,
    color: colors.primary,
    letterSpacing: 0.5
  },
  iconButton: {
    position: 'absolute',
    right: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    minHeight: controls.height
  },
  searchPlaceholder: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: '500'
  },
  searchCamera: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt
  },
  categorySection: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg
  },
  categorySlider: {
    gap: spacing.sm,
    paddingRight: spacing.xs
  },
  categoryItem: {
    width: 78,
    alignItems: 'center'
  },
  categoryIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm
  },
  categoryIconFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryIconFillImage: {
    borderRadius: 31
  },
  categoryLabel: {
    color: colors.text,
    fontSize: typography.bodyXs,
    fontWeight: typography.weightBold
  },
  moreCategoryIconWrap: {
    borderStyle: 'dashed'
  },
  moreCategoryIconFill: {
    backgroundColor: colors.surface
  },
  categoryGlyph: {
    fontSize: typography.title,
    lineHeight: 28
  },
  bannerSection: {
    marginBottom: spacing.xl
  },
  bannerCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.soft
  },
  bannerImage: {
    width: '100%',
    height: 172
  },
  bannerDots: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong
  },
  bannerDotActive: {
    backgroundColor: colors.primary
  },
  sectionBlock: {
    marginBottom: spacing.xl
  },
  sectionHeader: {
    marginBottom: spacing.md
  },
  sectionTitle: {
    fontSize: typography.title,
    lineHeight: 28,
    fontWeight: typography.weightExtrabold,
    color: colors.text
  },
  locationChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg
  },
  locationChipText: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  trendingPill: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    ...shadows.soft
  },
  trendingPillPressed: {
    backgroundColor: colors.surfaceAlt
  },
  trendingPillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs
  },
  trendingIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft
  },
  trendingContent: {
    flex: 1
  },
  trendingLabel: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  trendingMeta: {
    marginTop: 1,
    color: colors.muted,
    fontSize: typography.caption
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.25)'
  },
  modalBackdrop: {
    flex: 1
  },
  modalSheet: {
    maxHeight: '72%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  modalBackButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  modalBackButtonPlaceholder: {
    width: 32,
    height: 32
  },
  modalTitle: {
    flex: 1,
    marginHorizontal: spacing.sm,
    textAlign: 'center',
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  modalList: {
    paddingBottom: spacing.md
  },
  modalRow: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalRowPressed: {
    backgroundColor: colors.surfaceAlt
  },
  modalRowText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  modalEmptyText: {
    marginTop: spacing.md,
    color: colors.muted,
    textAlign: 'center'
  },
  storefrontRow: {
    gap: spacing.md,
    paddingRight: spacing.sm
  },
  storefrontCard: {
    width: 196,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.soft
  },
  storefrontCardPressed: {
    opacity: 0.92
  },
  storefrontHeroWrap: {
    height: 96,
    backgroundColor: colors.surfaceMuted
  },
  storefrontHero: {
    width: '100%',
    height: '100%'
  },
  storefrontHeroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  storefrontBody: {
    padding: spacing.sm,
    gap: 2
  },
  storefrontTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  storefrontName: {
    flex: 1,
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  storefrontSubtitle: {
    color: colors.muted,
    fontSize: typography.caption
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  error: {
    color: colors.danger,
    fontWeight: typography.weightBold
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.xl
  }
})
