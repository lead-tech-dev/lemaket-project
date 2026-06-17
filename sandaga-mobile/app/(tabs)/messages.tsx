import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { messagesApi, type ConversationItem } from '@/features/messages/messages.api'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { useSession } from '@/core/auth/session-context'
import { useTabScreenInsets } from '@/core/layout/useTabScreenInsets'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import { getListingImageSource } from '@/core/utils/listing-image'

type ConversationFilter = 'all' | 'unread'
type ConversationListRow =
  | { type: 'section'; key: string; title: string }
  | { type: 'conversation'; key: string; item: ConversationItem }

const participantName = (conversation: ConversationItem, currentUserId?: string | null) => {
  const otherParticipant =
    conversation.buyerId === currentUserId
      ? conversation.seller
      : conversation.sellerId === currentUserId
      ? conversation.buyer
      : conversation.courierId === currentUserId
      ? conversation.buyer ?? conversation.seller
      : conversation.seller ?? conversation.buyer ?? conversation.courier

  const fullName = `${otherParticipant?.firstName ?? ''} ${otherParticipant?.lastName ?? ''}`.trim()
  return fullName || 'Utilisateur'
}

const conversationTitle = (conversation: ConversationItem) => {
  const listingTitle = conversation.listing?.title
  if (listingTitle && listingTitle.trim()) {
    return listingTitle
  }
  return 'Conversation'
}

const conversationPreview = (conversation: ConversationItem) => conversation.lastMessagePreview || 'Nouveau message'

const formatConversationTime = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const getConversationSectionTitle = (value?: string) => {
  if (!value) return 'Plus anciennes'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Plus anciennes'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)

  if (diffDays <= 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays <= 7) return 'Cette semaine'
  return 'Plus anciennes'
}

const formatListingPrice = (conversation: ConversationItem) => {
  const price = conversation.listing?.price
  const currency = conversation.listing?.currency || 'XAF'
  const numeric = Number(price)
  if (!price || !Number.isFinite(numeric)) return null
  return `${Math.round(numeric).toLocaleString('fr-FR')} ${currency}`
}

export default function MessagesTabScreen() {
  const router = useRouter()
  const { topInset, bottomInset } = useTabScreenInsets()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const [filter, setFilter] = useState<ConversationFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const conversationsQuery = useInfiniteQuery({
    queryKey: ['messages', 'conversations'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => messagesApi.conversations(pageParam, 30),
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    refetchInterval: 12000
  })

  const conversations = useMemo(
    () => conversationsQuery.data?.pages.flatMap(page => page.data ?? []) ?? [],
    [conversationsQuery.data]
  )
  const filteredConversations = useMemo(() => {
    const unreadScoped =
      filter === 'all'
        ? conversations
        : conversations.filter(conversation => {
            const unread =
              conversation.buyerId === user?.id
                ? conversation.unreadCountBuyer ?? 0
                : conversation.sellerId === user?.id
                  ? conversation.unreadCountSeller ?? 0
                  : conversation.courierId === user?.id
                    ? conversation.unreadCountCourier ?? 0
                    : (conversation.unreadCountBuyer ?? 0) +
                      (conversation.unreadCountSeller ?? 0) +
                      (conversation.unreadCountCourier ?? 0)
            return unread > 0
          })

    const query = searchTerm.trim().toLowerCase()
    if (!query) {
      return unreadScoped
    }

    return unreadScoped.filter(conversation => {
      const haystack = [
        participantName(conversation, user?.id),
        conversationTitle(conversation),
        conversationPreview(conversation)
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [conversations, filter, searchTerm, user?.id])
  const unreadTotal = useMemo(() => {
    return conversations.reduce((total, conversation) => {
      if (conversation.buyerId === user?.id) return total + (conversation.unreadCountBuyer ?? 0)
      if (conversation.sellerId === user?.id) return total + (conversation.unreadCountSeller ?? 0)
      if (conversation.courierId === user?.id) return total + (conversation.unreadCountCourier ?? 0)
      return total
    }, 0)
  }, [conversations, user?.id])
  const conversationRows = useMemo<ConversationListRow[]>(() => {
    const rows: ConversationListRow[] = []
    let currentSection = ''

    for (const conversation of filteredConversations) {
      const sectionTitle = getConversationSectionTitle(conversation.lastMessageAt)
      if (sectionTitle !== currentSection) {
        currentSection = sectionTitle
        rows.push({ type: 'section', key: `section:${sectionTitle}`, title: sectionTitle })
      }
      rows.push({ type: 'conversation', key: conversation.id, item: conversation })
    }

    return rows
  }, [filteredConversations])

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] })
  }, [queryClient])

  return (
    <View style={[styles.screen, { paddingTop: topInset + spacing.sm }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Tes conversations avec acheteurs et vendeurs</Text>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>Tous</Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterChipText, filter === 'unread' && styles.filterChipTextActive]}>
            Non lus{unreadTotal > 0 ? ` (${unreadTotal})` : ''}
          </Text>
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Rechercher une conversation"
          placeholderTextColor={colors.placeholder}
          style={styles.searchInput}
        />
        {searchTerm.trim() ? (
          <Pressable onPress={() => setSearchTerm('')}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={conversationRows}
        keyExtractor={item => item.key}
        contentContainerStyle={{ paddingBottom: bottomInset + spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={conversationsQuery.isRefetching && !conversationsQuery.isFetchingNextPage}
            onRefresh={() => {
              void conversationsQuery.refetch()
            }}
          />
        }
        onEndReached={() => {
          if (conversationsQuery.hasNextPage && !conversationsQuery.isFetchingNextPage) {
            void conversationsQuery.fetchNextPage()
          }
        }}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          filteredConversations.length > 0 ? (
            conversationsQuery.isFetchingNextPage ? (
              <View style={styles.paginationFooter}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.paginationText}>Chargement...</Text>
              </View>
            ) : conversationsQuery.hasNextPage ? (
              <LoadMoreButton onPress={() => void conversationsQuery.fetchNextPage()} />
            ) : null
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="chatbubbles-outline" size={28} color={colors.muted} />
            <Text style={styles.emptyTitle}>
              {searchTerm.trim()
                ? 'Aucun résultat'
                : filter === 'unread'
                  ? 'Aucun message non lu'
                  : 'Aucune conversation'}
            </Text>
            <Text style={styles.emptyText}>
              {searchTerm.trim()
                ? 'Essaie avec un autre nom, titre d’annonce ou mot-clé.'
                : filter === 'unread'
                  ? 'Toutes tes conversations sont à jour.'
                  : 'Dès que tu contactes un vendeur, la discussion apparaît ici.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'section') {
            return <Text style={styles.sectionHeader}>{item.title}</Text>
          }

          const conversation = item.item
          const unread =
            conversation.buyerId === user?.id
              ? conversation.unreadCountBuyer ?? 0
              : conversation.sellerId === user?.id
                ? conversation.unreadCountSeller ?? 0
                : conversation.courierId === user?.id
                  ? conversation.unreadCountCourier ?? 0
                  : (conversation.unreadCountBuyer ?? 0) +
                    (conversation.unreadCountSeller ?? 0) +
                    (conversation.unreadCountCourier ?? 0)
          const imageSource = getListingImageSource(conversation.listing ?? null)
          const listingPrice = formatListingPrice(conversation)
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() =>
                router.push({
                  pathname: '/messages/[id]',
                  params: { id: conversation.id }
                })
              }
            >
              <View style={styles.cardLeading}>
                <Image source={imageSource} style={styles.cardImage} resizeMode="cover" />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {participantName(conversation, user?.id)}
                  </Text>
                  {conversation.lastMessageAt ? <Text style={styles.timeText}>{formatConversationTime(conversation.lastMessageAt)}</Text> : null}
                  {unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread}</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={styles.listingLabel}>
                  {conversationTitle(conversation)}
                </Text>
                {listingPrice ? <Text style={styles.listingPrice}>{listingPrice}</Text> : null}
                <Text numberOfLines={2} style={styles.preview}>
                  {conversationPreview(conversation)}
                </Text>
              </View>
            </Pressable>
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
    marginBottom: spacing.md
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  searchBar: {
    minHeight: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm,
    paddingVertical: 0
  },
  filterChip: {
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterChipActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  filterChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  filterChipTextActive: {
    color: colors.primary
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft
  },
  cardPressed: {
    opacity: 0.9
  },
  cardLeading: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  cardBody: {
    flex: 1
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  preview: {
    marginTop: 4,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  listingLabel: {
    marginTop: 2,
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  listingPrice: {
    marginTop: 2,
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  timeText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  badgeText: {
    color: colors.white,
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
  },
  paginationFooter: {
    paddingBottom: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm
  },
  paginationText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  sectionHeader: {
    marginBottom: spacing.sm,
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: typography.weightBold,
    textTransform: 'uppercase'
  }
})
