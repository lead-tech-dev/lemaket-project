import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import {
  messagesApi,
  type MessageAttachment,
  type MessageItem,
  type QuickReplyItem
} from '@/features/messages/messages.api'
import { useSession } from '@/core/auth/session-context'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import { getPresenceLabel, isUserOnline } from '@/core/utils/presence'
import { getListingImageSource, resolveMediaUrl } from '@/core/utils/listing-image'

const normalizeListingImage = (listing?: {
  images?: (string | { url?: string | null })[]
} | null) => {
  return getListingImageSource(listing)
}

const formatListingPrice = (listing?: { price?: string | null; currency?: string | null } | null) => {
  const numeric = Number(listing?.price ?? 0)
  if (!listing?.price || !Number.isFinite(numeric)) return null
  return `${Math.round(numeric).toLocaleString('fr-FR')} ${listing?.currency || 'XAF'}`
}

const isImageAttachment = (attachment: { mimeType?: string | null; url?: string | null }) => {
  const mime = attachment.mimeType?.toLowerCase() ?? ''
  const url = attachment.url?.toLowerCase() ?? ''
  return mime.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif)$/i.test(url)
}

const participantName = (
  conversation: {
    buyerId?: string
    sellerId?: string
    courierId?: string | null
    buyer?: { firstName?: string | null; lastName?: string | null } | null
    seller?: { firstName?: string | null; lastName?: string | null } | null
    courier?: { firstName?: string | null; lastName?: string | null } | null
  } | null | undefined,
  currentUserId?: string | null
) => {
  if (!conversation) return 'Utilisateur'

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

const participantPresence = (
  conversation: {
    buyerId?: string
    sellerId?: string
    courierId?: string | null
    buyer?: { lastLoginAt?: string | null; isOnline?: boolean } | null
    seller?: { lastLoginAt?: string | null; isOnline?: boolean } | null
    courier?: { lastLoginAt?: string | null; isOnline?: boolean } | null
  } | null | undefined,
  currentUserId?: string | null
) => {
  if (!conversation) {
    return { isOnline: false, label: getPresenceLabel(null, 'fr') }
  }

  const otherParticipant =
    conversation.buyerId === currentUserId
      ? conversation.seller
      : conversation.sellerId === currentUserId
      ? conversation.buyer
      : conversation.courierId === currentUserId
      ? conversation.buyer ?? conversation.seller
      : conversation.seller ?? conversation.buyer ?? conversation.courier

  const lastLoginAt = otherParticipant?.lastLoginAt ?? null
  const online = otherParticipant?.isOnline ?? isUserOnline(lastLoginAt)
  return {
    isOnline: online,
    label: online ? 'En ligne' : getPresenceLabel(lastLoginAt, 'fr')
  }
}

const deliveryStatusLabel = (message: MessageItem) => {
  switch (message.deliveryStatus) {
    case 'read':
      return 'Lu'
    case 'delivered':
      return 'Distribué'
    case 'sent':
    default:
      return 'Envoyé'
  }
}

const deliveryStatusIcon = (message: MessageItem): keyof typeof Ionicons.glyphMap => {
  switch (message.deliveryStatus) {
    case 'read':
      return 'checkmark-done'
    case 'delivered':
      return 'checkmark-done-outline'
    case 'sent':
    default:
      return 'checkmark-outline'
  }
}

export default function ConversationScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [draft, setDraft] = useState('')
  const [selectedAttachments, setSelectedAttachments] = useState<MessageAttachment[]>([])
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [showQuickReplyManager, setShowQuickReplyManager] = useState(false)
  const [quickReplyLabel, setQuickReplyLabel] = useState('')
  const [quickReplyContent, setQuickReplyContent] = useState('')
  const [editingQuickReplyId, setEditingQuickReplyId] = useState<string | null>(null)

  const conversationQuery = useQuery({
    queryKey: ['messages', 'conversation', id],
    queryFn: () => {
      if (!id) {
        throw new Error('Conversation id is missing')
      }
      return messagesApi.conversation(id)
    },
    enabled: Boolean(id)
  })

  const quickRepliesQuery = useQuery({
    queryKey: ['messages', 'quick-replies'],
    queryFn: () => messagesApi.quickReplies(),
    enabled: showQuickReplies || showQuickReplyManager
  })

  const messagesQuery = useInfiniteQuery({
    queryKey: ['messages', 'items', id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      if (!id) {
        throw new Error('Conversation id is missing')
      }
      return messagesApi.messages(id, pageParam)
    },
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: Boolean(id),
    refetchInterval: 10000
  })

  useEffect(() => {
    if (!id) return
    void messagesApi.markRead(id)
  }, [id])

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file: { uri: string; name: string; type: string }) => {
      if (!id) throw new Error('Conversation id is missing')
      return messagesApi.uploadAttachment(id, file)
    },
    onSuccess: attachment => {
      setSelectedAttachments(previous => [...previous, attachment])
    }
  })

  const aiReplyMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Conversation id is missing')
      return messagesApi.aiReply(id)
    },
    onSuccess: response => {
      setDraft(previous => {
        const next = response.suggestion.trim()
        if (!previous.trim()) return next
        return `${previous.trim()}\n\n${next}`
      })
    }
  })

  const quickReplySaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        label: quickReplyLabel.trim(),
        content: quickReplyContent.trim()
      }
      if (editingQuickReplyId) {
        return messagesApi.updateQuickReply(editingQuickReplyId, payload)
      }
      return messagesApi.createQuickReply(payload)
    },
    onSuccess: () => {
      setQuickReplyLabel('')
      setQuickReplyContent('')
      setEditingQuickReplyId(null)
      queryClient.invalidateQueries({ queryKey: ['messages', 'quick-replies'] })
      setShowQuickReplyManager(false)
      setShowQuickReplies(true)
    }
  })

  const quickReplyDeleteMutation = useMutation({
    mutationFn: (replyId: string) => messagesApi.deleteQuickReply(replyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'quick-replies'] })
      setQuickReplyLabel('')
      setQuickReplyContent('')
      setEditingQuickReplyId(null)
    }
  })

  const sendMutation = useMutation({
    mutationFn: () => {
      if (!id) {
        throw new Error('Conversation id is missing')
      }
      return messagesApi.sendMessage(
        id,
        draft.trim(),
        selectedAttachments.map(attachment => attachment.id)
      )
    },
    onSuccess: () => {
      setDraft('')
      setSelectedAttachments([])
      queryClient.invalidateQueries({ queryKey: ['messages', 'items', id] })
      queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] })
    }
  })

  const items = useMemo(
    () => messagesQuery.data?.pages.slice().reverse().flatMap(page => page.data ?? []) ?? [],
    [messagesQuery.data]
  )

  const title = participantName(conversationQuery.data, user?.id)
  const listingTitle = conversationQuery.data?.listing?.title || 'Conversation'
  const listingImageSource = normalizeListingImage(conversationQuery.data?.listing)
  const listingPrice = formatListingPrice(conversationQuery.data?.listing)
  const isSeller = conversationQuery.data?.sellerId === user?.id
  const presence = participantPresence(conversationQuery.data, user?.id)
  const presenceLabel = presence.label
  const canSend = draft.trim().length > 0 && !sendMutation.isPending && !uploadAttachmentMutation.isPending

  const quickReplies = useMemo<QuickReplyItem[]>(() => quickRepliesQuery.data ?? [], [quickRepliesQuery.data])
  const isAdmin = user?.role === 'admin'

  const handleDraftChange = (value: string) => {
    setDraft(value)
  }

  const handlePickImage = async () => {
    if (!id) return

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission requise', 'Autorise la galerie pour ajouter une image.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.82
    })

    if (result.canceled || result.assets.length === 0) return

    const asset = result.assets[0]
    const fileName =
      asset.fileName ||
      asset.uri.split('/').pop() ||
      `piece-jointe-${Date.now()}.jpg`

    uploadAttachmentMutation.mutate({
      uri: asset.uri,
      name: fileName,
      type: asset.mimeType || 'image/jpeg'
    })
  }

  const handleSend = () => {
    if (!draft.trim()) {
      Alert.alert('Message vide', 'Ajoute un texte avant d envoyer ton message.')
      return
    }
    sendMutation.mutate()
  }

  const openQuickReplyEditor = (reply?: QuickReplyItem) => {
    setEditingQuickReplyId(reply?.id ?? null)
    setQuickReplyLabel(reply?.label ?? '')
    setQuickReplyContent(reply?.content ?? '')
    setShowQuickReplyManager(true)
  }

  const renderAttachment = (attachment: NonNullable<MessageItem['attachments']>[number], mine: boolean) => {
    const uri = resolveMediaUrl(attachment.url)
    if (!uri) return null

    if (isImageAttachment(attachment)) {
      return (
        <Image
          key={attachment.id}
          source={{ uri }}
          style={[styles.messageAttachmentImage, mine && styles.messageAttachmentImageMine]}
          resizeMode="cover"
        />
      )
    }

    return (
      <View key={attachment.id} style={[styles.messageAttachmentFile, mine && styles.messageAttachmentFileMine]}>
        <Ionicons name="document-outline" size={16} color={mine ? colors.white : colors.text} />
        <Text style={[styles.messageAttachmentFileText, mine && styles.messageAttachmentFileTextMine]} numberOfLines={1}>
          {attachment.fileName || 'Pièce jointe'}
        </Text>
      </View>
    )
  }

  const keyboardOffset = Platform.select({
    ios: insets.top + 64,
    android: 24
  })

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      keyboardVerticalOffset={keyboardOffset}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.subtitleRow}>
            <View style={[styles.presenceDot, presence.isOnline && styles.presenceDotOnline]} />
            <Text style={styles.presenceText} numberOfLines={1}>
              {presenceLabel}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {listingTitle}
            </Text>
          </View>
        </View>
        <Pressable style={styles.headerAction} onPress={() => setShowQuickReplies(previous => !previous)}>
          <Ionicons name="flash-outline" size={18} color={colors.text} />
        </Pressable>
      </View>

      {conversationQuery.data?.listing?.id ? (
        <Pressable
          style={styles.listingPreviewCard}
          onPress={() =>
            router.push({
              pathname: '/listings/[id]',
              params: { id: conversationQuery.data?.listing?.id as string }
            })
          }
        >
          <Image source={listingImageSource} style={styles.listingPreviewImage} resizeMode="cover" />
          <View style={styles.listingPreviewBody}>
            <Text style={styles.listingPreviewTitle} numberOfLines={1}>
              {listingTitle}
            </Text>
            {listingPrice ? <Text style={styles.listingPreviewPrice}>{listingPrice}</Text> : null}
            <Text style={styles.listingPreviewHint}>Voir l’annonce</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        ListHeaderComponent={
          messagesQuery.isFetchingNextPage ? (
            <View style={styles.paginationHeader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.paginationText}>Chargement des anciens messages...</Text>
            </View>
          ) : messagesQuery.hasNextPage ? (
            <View style={styles.paginationHeader}>
              <LoadMoreButton onPress={() => void messagesQuery.fetchNextPage()} label="Charger les messages précédents" />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              {item.attachments?.length ? (
                <View style={styles.messageAttachmentsGroup}>
                  {item.attachments.map(attachment => renderAttachment(attachment, mine))}
                </View>
              ) : null}
              <Text style={[styles.bubbleText, mine && styles.mineText]}>{item.content}</Text>
              <View style={[styles.metaRow, mine && styles.metaRowMine]}>
                <Text style={[styles.meta, mine && styles.mineMeta]}>
                  {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {mine ? (
                  <View style={styles.statusRow}>
                    <Ionicons name={deliveryStatusIcon(item)} size={13} color={colors.whiteMuted} />
                    <Text style={styles.mineMeta}>{deliveryStatusLabel(item)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          )
        }}
      />

      {showQuickReplies ? (
        <View style={styles.quickRepliesPanel}>
        <View style={styles.quickRepliesHeader}>
          <Text style={styles.quickRepliesTitle}>Réponses rapides</Text>
          <View style={styles.quickRepliesHeaderActions}>
            {quickRepliesQuery.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            <Pressable style={styles.quickRepliesManageButton} onPress={() => openQuickReplyEditor()}>
              <Ionicons name="add" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesList}>
            {quickReplies.map(reply => (
              <View key={reply.id} style={styles.quickReplyChipWrap}>
                <Pressable
                  style={styles.quickReplyChip}
                  onPress={() => {
                    setDraft(previous => {
                      if (!previous.trim()) return reply.content
                      return `${previous.trim()}\n${reply.content}`
                    })
                  }}
                >
                  <Text style={styles.quickReplyChipLabel} numberOfLines={1}>
                    {reply.label}
                  </Text>
                </Pressable>
                {(isAdmin || !reply.isGlobal) ? (
                  <Pressable style={styles.quickReplyChipEdit} onPress={() => openQuickReplyEditor(reply)}>
                    <Ionicons name="create-outline" size={14} color={colors.text} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {!quickRepliesQuery.isFetching && quickReplies.length === 0 ? (
              <View style={styles.quickRepliesEmpty}>
                <Text style={styles.quickRepliesEmptyText}>Aucune réponse rapide disponible.</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {selectedAttachments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pendingAttachmentsRow}
        >
          {selectedAttachments.map(attachment => {
            const uri = resolveMediaUrl(attachment.url)
            if (!uri) return null
            return (
              <View key={attachment.id} style={styles.pendingAttachmentCard}>
                {isImageAttachment(attachment) ? (
                  <Image source={{ uri }} style={styles.pendingAttachmentImage} resizeMode="cover" />
                ) : (
                  <View style={styles.pendingAttachmentFallback}>
                    <Ionicons name="document-outline" size={16} color={colors.text} />
                  </View>
                )}
                <Pressable
                  style={styles.pendingAttachmentRemove}
                  onPress={() => {
                    setSelectedAttachments(previous => previous.filter(item => item.id !== attachment.id))
                  }}
                >
                  <Ionicons name="close" size={12} color={colors.white} />
                </Pressable>
              </View>
            )
          })}
        </ScrollView>
      ) : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <View style={styles.composerActions}>
          <Pressable style={styles.utilityButton} onPress={() => void handlePickImage()}>
            {uploadAttachmentMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="image-outline" size={18} color={colors.text} />
            )}
          </Pressable>
          {isSeller ? (
            <Pressable
              style={styles.utilityButton}
              onPress={() => aiReplyMutation.mutate()}
              disabled={aiReplyMutation.isPending}
            >
              {aiReplyMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="sparkles-outline" size={18} color={colors.text} />
              )}
            </Pressable>
          ) : null}
        </View>

        <TextInput
          value={draft}
          onChangeText={handleDraftChange}
          placeholder="Écrire un message..."
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          multiline
        />

        <Pressable
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          disabled={!canSend}
          onPress={handleSend}
        >
          <Ionicons name="send" size={16} color={colors.white} />
          <Text style={styles.sendLabel}>Envoyer</Text>
        </Pressable>
      </View>

      <Modal
        visible={showQuickReplyManager}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!quickReplySaveMutation.isPending) {
            setShowQuickReplyManager(false)
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => {
              if (!quickReplySaveMutation.isPending) {
                setShowQuickReplyManager(false)
              }
            }}
          />
          <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.modalSheetWrap}>
            <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
              <Text style={styles.modalTitle}>
                {editingQuickReplyId ? 'Modifier la réponse rapide' : 'Nouvelle réponse rapide'}
              </Text>
              <Text style={styles.modalDescription}>
                Prépare des réponses prêtes à l emploi pour répondre plus vite.
              </Text>

              <TextInput
                value={quickReplyLabel}
                onChangeText={setQuickReplyLabel}
                placeholder="Libellé"
                placeholderTextColor={colors.placeholder}
                style={styles.modalInput}
                maxLength={80}
              />
              <TextInput
                value={quickReplyContent}
                onChangeText={setQuickReplyContent}
                placeholder="Contenu"
                placeholderTextColor={colors.placeholder}
                multiline
                style={[styles.modalInput, styles.modalTextarea]}
                maxLength={2000}
              />

              {editingQuickReplyId ? (
                <Pressable
                  style={styles.modalDangerButton}
                  onPress={() => {
                    if (!editingQuickReplyId) return
                    quickReplyDeleteMutation.mutate(editingQuickReplyId, {
                      onSuccess: () => {
                        setShowQuickReplyManager(false)
                      }
                    })
                  }}
                  disabled={quickReplyDeleteMutation.isPending}
                >
                  <Text style={styles.modalDangerButtonText}>
                    {quickReplyDeleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowQuickReplyManager(false)}
                  disabled={quickReplySaveMutation.isPending}
                >
                  <Text style={styles.modalSecondaryButtonText}>Annuler</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalPrimaryButton,
                    (!quickReplyLabel.trim() || !quickReplyContent.trim() || quickReplySaveMutation.isPending) &&
                      styles.modalPrimaryButtonDisabled
                  ]}
                  onPress={() => quickReplySaveMutation.mutate()}
                  disabled={!quickReplyLabel.trim() || !quickReplyContent.trim() || quickReplySaveMutation.isPending}
                >
                  <Text style={styles.modalPrimaryButtonText}>
                    {quickReplySaveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  headerBody: {
    flex: 1
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  listingPreviewCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    ...shadows.soft
  },
  listingPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: radius.md
  },
  listingPreviewBody: {
    flex: 1
  },
  listingPreviewTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  listingPreviewPrice: {
    marginTop: 2,
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  listingPreviewHint: {
    marginTop: 4,
    color: colors.muted,
    fontSize: typography.caption
  },
  title: {
    flex: 1,
    color: colors.text,
    fontWeight: typography.weightExtrabold,
    fontSize: typography.body
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  presenceDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.borderStrong
  },
  presenceDotOnline: {
    backgroundColor: colors.success
  },
  presenceText: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: typography.weightMedium
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.caption
  },
  messagesList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md
  },
  paginationHeader: {
    alignItems: 'center',
    paddingBottom: spacing.md
  },
  paginationText: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.caption
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.sm,
    gap: spacing.xs
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    ...shadows.soft
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border
  },
  bubbleText: {
    color: colors.text,
    fontSize: typography.bodySm
  },
  mineText: {
    color: colors.white
  },
  meta: {
    color: colors.muted,
    fontSize: typography.captionSm
  },
  mineMeta: {
    color: colors.whiteMuted
  },
  metaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  metaRowMine: {
    justifyContent: 'flex-end'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  messageAttachmentsGroup: {
    gap: spacing.xs
  },
  messageAttachmentImage: {
    width: 176,
    height: 132,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  messageAttachmentImageMine: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  messageAttachmentFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  messageAttachmentFileMine: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.2)'
  },
  messageAttachmentFileText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.caption
  },
  messageAttachmentFileTextMine: {
    color: colors.white
  },
  quickRepliesPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.sm
  },
  quickRepliesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md
  },
  quickRepliesHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  quickRepliesTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  quickRepliesManageButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySurface
  },
  quickRepliesList: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  quickReplyChipWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  quickReplyChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  quickReplyChipLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  quickReplyChipEdit: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  quickRepliesEmpty: {
    justifyContent: 'center',
    paddingVertical: spacing.sm
  },
  quickRepliesEmptyText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  pendingAttachmentsRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  pendingAttachmentCard: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border
  },
  pendingAttachmentImage: {
    width: '100%',
    height: '100%'
  },
  pendingAttachmentFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pendingAttachmentRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(15,23,42,0.82)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm
  },
  composerActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  utilityButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    maxHeight: 120,
    color: colors.text,
    textAlignVertical: 'top',
    backgroundColor: colors.surface
  },
  sendButton: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.soft
  },
  sendButtonDisabled: {
    opacity: 0.5
  },
  sendLabel: {
    color: colors.white,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end'
  },
  modalSheetWrap: {
    justifyContent: 'flex-end'
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: typography.weightExtrabold
  },
  modalDescription: {
    color: colors.muted,
    fontSize: typography.bodySm
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.bodySm
  },
  modalTextarea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: spacing.md
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised
  },
  modalSecondaryButtonText: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.soft
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.55
  },
  modalPrimaryButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold
  },
  modalDangerButton: {
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerSoftStrong
  },
  modalDangerButtonText: {
    color: colors.danger,
    fontWeight: typography.weightBold
  }
})
