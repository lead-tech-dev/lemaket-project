import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ListingCard } from '@/components/ui/ListingCard'
import { useSession } from '@/core/auth/session-context'
import { http } from '@/core/api/http'
import { API_BASE_URL } from '@/core/config/env'
import { listingsApi } from '@/features/listings/listings.api'
import { usersApi, type PublicUserProfile } from '@/features/users/users.api'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import { isUserOnline } from '@/core/utils/presence'

type ReviewItem = {
  id: string
  rating: number
  comment: string
  createdAt: string
  reviewer?: {
    name?: string
  }
}

type ReviewSummary = {
  averageRating: number
  totalReviews: number
}

type ReviewsResponse = {
  items: ReviewItem[]
  summary: ReviewSummary | null
}

const LISTINGS_LIMIT = 12

const resolveMediaUrl = (raw?: string | null) => {
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${API_BASE_URL}${raw.startsWith('/') ? raw : `/${raw}`}`
}

const formatDate = (value?: string | null) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return ''
  }
}

const formatMemberSinceDate = (value?: string | null) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return ''
  }
}

const formatLastActive = (value?: string | null) => {
  if (!value) return 'Activité récente indisponible'
  if (isUserOnline(value)) return 'En ligne'
  try {
    const last = new Date(value).getTime()
    const now = Date.now()
    const diff = Math.max(0, now - last)
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 24) {
      return `Dernière activité il y a ${Math.max(1, hours)} heures`
    }

    const days = Math.floor(hours / 24)
    return `Dernière activité il y a ${days} jours`
  } catch {
    return 'Activité récente indisponible'
  }
}

const formatResponseTime = (hours?: number | null) => {
  if (!hours || hours <= 0) return 'Réponse moyenne indisponible'
  if (hours < 1) return 'Répond en moyenne en moins d’1 heure'
  if (hours <= 2) return 'Répond en moyenne en 1–2 heures'
  if (hours <= 4) return 'Répond en moyenne en 2–4 heures'
  if (hours <= 8) return 'Répond en moyenne en 4–8 heures'
  if (hours <= 24) return 'Répond en moyenne en 8–24 heures'
  return 'Répond en moyenne en plus de 24 heures'
}

const formatResponseRate = (rate?: number | null) => {
  if (rate === null || rate === undefined) return 'Taux de réponse indisponible'
  const rounded = Math.round(rate / 5) * 5
  return `Taux de réponse à ${Math.min(100, Math.max(0, rounded))} %`
}

export default function PublicProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { width } = useWindowDimensions()
  const { user, isAuthenticated } = useSession()
  const { userId } = useLocalSearchParams<{ userId?: string | string[] }>()
  const normalizedUserId = Array.isArray(userId) ? userId[0] : userId
  const [sectionTab, setSectionTab] = useState<'listings' | 'reviews'>('listings')
  const [listingTab, setListingTab] = useState<'published' | 'archived'>('published')
  const [listingLimit, setListingLimit] = useState(LISTINGS_LIMIT)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showResponsiveModal, setShowResponsiveModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLocation, setReviewLocation] = useState('')
  const [reviewAsTestimonial, setReviewAsTestimonial] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportEmail, setReportEmail] = useState('')
  const [reportPhone, setReportPhone] = useState('')

  const meQuery = useQuery({
    queryKey: ['users', 'me', 'public-fallback'],
    queryFn: () => usersApi.me(),
    enabled: Boolean(user?.id) && !normalizedUserId
  })

  const publicQuery = useQuery({
    queryKey: ['users', 'public', normalizedUserId || user?.id],
    queryFn: () => usersApi.publicProfile((normalizedUserId || user?.id)!),
    enabled: Boolean(normalizedUserId || user?.id)
  })

  const effectiveProfile = useMemo<PublicUserProfile | null>(() => {
    if (publicQuery.data) return publicQuery.data
    if (!meQuery.data) return null
    return {
      id: meQuery.data.id,
      firstName: meQuery.data.firstName || 'Utilisateur',
      lastName: meQuery.data.lastName || '',
      avatarUrl: meQuery.data.avatarUrl ?? null,
      location: meQuery.data.location ?? null,
      createdAt: meQuery.data.created_at ?? new Date().toISOString(),
      lastLoginAt: meQuery.data.lastLoginAt ?? null,
      hasPhoneNumber: false,
      averageRating: 0,
      reviewsCount: 0,
      responseTimeHours: null,
      responseRate: null,
      listingCount: 0,
      proFollowsCount: 0
    }
  }, [meQuery.data, publicQuery.data])

  const listingsQuery = useQuery({
    queryKey: ['listings', 'public-profile', effectiveProfile?.id, listingTab, listingLimit],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('ownerId', effectiveProfile!.id)
      params.set('limit', String(listingLimit))
      params.set('status', listingTab)
      return listingsApi.search(params)
    },
    enabled: Boolean(effectiveProfile?.id)
  })

  const reviewsQuery = useQuery({
    queryKey: ['reviews', 'public-profile', effectiveProfile?.id],
    queryFn: () => http.get<ReviewsResponse>(`/reviews/sellers/${effectiveProfile!.id}`),
    enabled: Boolean(effectiveProfile?.id)
  })

  const followsQuery = useQuery({
    queryKey: ['users', 'follows', 'ids'],
    queryFn: () => usersApi.followedSellerIds(),
    enabled: isAuthenticated
  })

  const followersCountQuery = useQuery({
    queryKey: ['users', 'followers', 'count', effectiveProfile?.id],
    queryFn: () => usersApi.followersCount(effectiveProfile!.id),
    enabled: Boolean(effectiveProfile?.id)
  })

  const listings = listingsQuery.data?.data ?? []
  const listingsTotal = listingsQuery.data?.total ?? listings.length
  const avatarUrl = resolveMediaUrl(effectiveProfile?.avatarUrl)
  const fullName = [effectiveProfile?.firstName, effectiveProfile?.lastName].filter(Boolean).join(' ')
  const isOnline =
    effectiveProfile?.isOnline === true || isUserOnline(effectiveProfile?.lastLoginAt ?? null)
  const cardWidth = Math.max((width - spacing.lg * 2 - spacing.sm) / 2, 148)
  const reviews = reviewsQuery.data?.items ?? []
  const reviewSummary = reviewsQuery.data?.summary
  const isOwner = Boolean(user?.id && effectiveProfile?.id && effectiveProfile.id === user.id)
  const isFollowing = Boolean(
    effectiveProfile?.id && followsQuery.data?.sellerIds.includes(effectiveProfile.id)
  )
  const followersCount = followersCountQuery.data?.count ?? 0

  const invalidateProfileData = () => {
    void queryClient.invalidateQueries({ queryKey: ['users', 'public', normalizedUserId || user?.id] })
    void queryClient.invalidateQueries({ queryKey: ['reviews', 'public-profile', effectiveProfile.id] })
    void queryClient.invalidateQueries({ queryKey: ['users', 'follows', 'ids'] })
    void queryClient.invalidateQueries({ queryKey: ['users', 'followers', 'count', effectiveProfile.id] })
  }

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) {
        throw new Error('Veuillez vous connecter pour suivre ce profil.')
      }
      return isFollowing ? usersApi.unfollowSeller(effectiveProfile.id) : usersApi.followSeller(effectiveProfile.id)
    },
    onSuccess: () => {
      invalidateProfileData()
    },
    onError: error => {
      Alert.alert('Action impossible', error instanceof Error ? error.message : 'Réessaie dans un instant.')
    }
  })

  const reviewMutation = useMutation({
    mutationFn: async () =>
      http.post('/reviews/users', {
        sellerId: effectiveProfile.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
        location: reviewLocation.trim() || undefined,
        isTestimonial: reviewAsTestimonial
      }),
    onSuccess: () => {
      setShowReviewModal(false)
      setReviewComment('')
      setReviewLocation('')
      setReviewRating(5)
      setReviewAsTestimonial(false)
      setSectionTab('reviews')
      invalidateProfileData()
      Alert.alert('Avis envoyé', 'Merci pour votre avis.')
    },
    onError: error => {
      Alert.alert('Avis impossible', error instanceof Error ? error.message : "Impossible d'envoyer l'avis.")
    }
  })

  const reportMutation = useMutation({
    mutationFn: async () =>
      http.post('/reports', {
        reportedUserId: effectiveProfile.id,
        reason: reportReason.trim(),
        details: reportDetails.trim() || undefined,
        contactEmail: reportEmail.trim() || undefined,
        contactPhone: reportPhone.trim() || undefined
      }),
    onSuccess: () => {
      setShowReportModal(false)
      setReportReason('')
      setReportDetails('')
      setReportEmail('')
      setReportPhone('')
      Alert.alert('Signalement envoyé', 'Merci, votre signalement a bien été enregistré.')
    },
    onError: error => {
      Alert.alert('Signalement impossible', error instanceof Error ? error.message : "Impossible d'envoyer le signalement.")
    }
  })

  const handleShare = async () => {
    if (!effectiveProfile) return
    try {
      setMenuOpen(false)
      await Share.share({
        message: `${fullName}\nProfil public LEMAKET`
      })
    } catch {
      // ignore
    }
  }

  const handleReport = () => {
    setMenuOpen(false)
    if (!isAuthenticated) {
      router.push('/(auth)/login')
      return
    }
    setShowReportModal(true)
  }

  const handleOpenReview = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login')
      return
    }
    if (isOwner) {
      Alert.alert('Avis impossible', 'Vous ne pouvez pas laisser un avis sur votre propre profil.')
      return
    }
    setShowReviewModal(true)
  }

  if (!effectiveProfile && (publicQuery.isLoading || meQuery.isLoading)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  if (!effectiveProfile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Impossible de charger le profil public.</Text>
      </View>
    )
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl }]}>
        {menuOpen ? <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} /> : null}
        {publicQuery.isError ? (
          <View style={styles.retryBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.warning} />
            <Text style={styles.retryBannerText}>Aperçu partiel affiché. Certaines informations n’ont pas pu être chargées.</Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroBanner}>
            <View style={styles.heroBannerGlow} />
            <View style={styles.heroActions}>
              <Pressable style={styles.iconActionButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={18} color={colors.text} />
              </Pressable>
              <View style={styles.menuAnchor}>
                <Pressable style={styles.iconActionButton} onPress={() => setMenuOpen(current => !current)}>
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
                </Pressable>

                {menuOpen ? (
                  <View style={styles.menuDropdown}>
                    <Pressable style={styles.menuItem} onPress={handleShare}>
                      <Ionicons name="share-social-outline" size={16} color={colors.text} />
                      <Text style={styles.menuItemText}>Partager</Text>
                    </Pressable>
                    <Pressable style={styles.menuItem} onPress={handleReport}>
                      <Ionicons name="flag-outline" size={16} color={colors.text} />
                      <Text style={styles.menuItemText}>Signaler</Text>
                    </Pressable>
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        setMenuOpen(false)
                        setShowResponsiveModal(true)
                      }}
                    >
                      <Ionicons name="flash-outline" size={16} color={colors.text} />
                      <Text style={styles.menuItemText}>Réactivité</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.heroBody}>
            <View style={styles.identityBlock}>
              <View style={styles.avatarShell}>
                <View style={styles.avatar}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
                  ) : (
                    <Text style={styles.avatarFallback}>
                      {(effectiveProfile.firstName?.[0] ?? '').toUpperCase()}
                      {(effectiveProfile.lastName?.[0] ?? '').toUpperCase()}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.identityMeta}>
                <View style={styles.identityHeaderRow}>
                  <View style={styles.identityHeaderText}>
                    <Text style={styles.name}>
                      {effectiveProfile.firstName} {effectiveProfile.lastName}
                    </Text>
                    <Text style={styles.memberSinceText}>Membre depuis {formatMemberSinceDate(effectiveProfile.createdAt)}</Text>
                  </View>
                </View>

                {effectiveProfile.reviewsCount ? (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={15} color={colors.warning} />
                    <Text style={styles.ratingValue}>{effectiveProfile.averageRating?.toFixed(1) ?? '0.0'}</Text>
                    <Text style={styles.ratingMeta}>({effectiveProfile.reviewsCount} avis)</Text>
                  </View>
                ) : (
                  <View style={[styles.ratingRow, styles.ratingRowEmpty]}>
                    <Ionicons name="star-outline" size={15} color={colors.muted} />
                    <Text style={styles.ratingMeta}>0 avis</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.statsCardsRow}>
              <View style={styles.statsCard}>
                <Text style={styles.statsCardValue}>{followersCount}</Text>
                <Text style={styles.statsCardLabel}>abonnés</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsCardValue}>{effectiveProfile.listingCount ?? 0}</Text>
                <Text style={styles.statsCardLabel}>annonces</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsCardValue}>
                  {effectiveProfile.reviewsCount ? effectiveProfile.averageRating?.toFixed(1) ?? '0.0' : '-'}
                </Text>
                <Text style={styles.statsCardLabel}>note</Text>
              </View>
            </View>

            <View style={styles.factsList}>
              <View style={styles.factRow}>
                <Ionicons name="location-outline" size={14} color={colors.accent} />
                <Text style={styles.factText}>{effectiveProfile.location ?? 'Localisation non renseignée'}</Text>
              </View>
              <View style={styles.factRow}>
                <Ionicons name="time-outline" size={14} color={colors.accent} />
                <Text style={styles.factText}>
                  {isOnline ? 'En ligne' : formatLastActive(effectiveProfile.lastLoginAt)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.badgesRow}>
            <Pressable style={styles.badgeInteractive} onPress={() => setShowResponsiveModal(true)}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.accent} />
              <Text style={styles.badgeLabel}>Réactif</Text>
            </Pressable>
            {effectiveProfile.hasPhoneNumber ? (
              <View style={styles.badgeStatic}>
                <Ionicons name="call-outline" size={15} color={colors.success} />
                <Text style={styles.badgeLabel}>Numéro vérifié</Text>
              </View>
            ) : null}
            <Pressable style={styles.reviewCta} onPress={handleOpenReview}>
              <Text style={styles.reviewCtaText}>Laisser un avis</Text>
            </Pressable>
          </View>

          <View style={styles.followRow}>
            <Pressable
              style={[styles.followButton, (followMutation.isPending || isOwner) && styles.followButtonDisabled]}
              onPress={() => {
                if (!isAuthenticated) {
                  router.push('/(auth)/login')
                  return
                }
                if (!isOwner) {
                  followMutation.mutate()
                }
              }}
              disabled={followMutation.isPending || isOwner}
            >
              <Text style={styles.followButtonText}>
                {isOwner ? 'Votre profil' : isFollowing ? 'Suivi' : 'Suivre'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.mainTabs}>
          <Pressable
            style={[styles.mainTab, sectionTab === 'listings' && styles.mainTabActive]}
            onPress={() => setSectionTab('listings')}
          >
            <Text style={[styles.mainTabText, sectionTab === 'listings' && styles.mainTabTextActive]}>
              Annonces ({effectiveProfile.listingCount ?? 0})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.mainTab, sectionTab === 'reviews' && styles.mainTabActive]}
            onPress={() => setSectionTab('reviews')}
          >
            <Text style={[styles.mainTabText, sectionTab === 'reviews' && styles.mainTabTextActive]}>
              Avis ({effectiveProfile.reviewsCount ?? 0})
            </Text>
          </Pressable>
        </View>

        {sectionTab === 'listings' ? (
          <>
            <View style={styles.subTabs}>
              <Pressable
                style={[styles.subTab, listingTab === 'published' && styles.subTabActive]}
                onPress={() => setListingTab('published')}
              >
                <Text style={[styles.subTabText, listingTab === 'published' && styles.subTabTextActive]}>En vente</Text>
              </Pressable>
              <Pressable
                style={[styles.subTab, listingTab === 'archived' && styles.subTabActive]}
                onPress={() => setListingTab('archived')}
              >
                <Text style={[styles.subTabText, listingTab === 'archived' && styles.subTabTextActive]}>Vendu</Text>
              </Pressable>
            </View>

            {listingsQuery.isLoading ? (
              <View style={styles.centerInline}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : listingsQuery.isError ? (
              <Text style={styles.errorInline}>Impossible de charger les annonces.</Text>
            ) : listings.length ? (
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
              <Text style={styles.emptyText}>
                {listingTab === 'published'
                  ? 'Aucune annonce en vente pour le moment.'
                  : 'Aucune annonce vendue pour le moment.'}
              </Text>
            )}

            {listingsTotal > listingLimit ? (
              <View style={styles.moreRow}>
                <Pressable
                  style={styles.moreButton}
                  onPress={() => setListingLimit(current => current + LISTINGS_LIMIT)}
                >
                  <Text style={styles.moreButtonText}>Voir toutes les annonces</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.reviewsCard}>
            {reviewsQuery.isLoading ? (
              <View style={styles.centerInline}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : reviewsQuery.isError ? (
              <Text style={styles.errorInline}>Impossible de charger les avis.</Text>
            ) : (
              <>
                <View style={styles.reviewsSummary}>
                  <View style={styles.ratingScore}>
                    <Ionicons name="star" size={18} color={colors.warning} />
                    <Text style={styles.ratingScoreValue}>{reviewSummary?.averageRating?.toFixed(1) ?? '0.0'}</Text>
                    <Text style={styles.ratingScoreSuffix}>/5</Text>
                  </View>
                  <Text style={styles.reviewsSummaryText}>
                    {reviewSummary?.totalReviews ? `${reviewSummary.totalReviews} avis` : 'Aucun avis pour le moment.'}
                  </Text>
                </View>

                <View style={styles.reviewsList}>
                  {reviews.length ? (
                    reviews.map(review => (
                      <View key={review.id} style={styles.reviewItem}>
                        <View style={styles.reviewTop}>
                          <Text style={styles.reviewAuthor}>{review.reviewer?.name || 'Utilisateur'}</Text>
                          <Text style={styles.reviewRating}>★ {review.rating}</Text>
                        </View>
                        <Text style={styles.reviewComment}>{review.comment}</Text>
                        <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Aucun avis publié.</Text>
                  )}
                </View>
              </>
            )}
          </View>
        )}

        <View style={styles.responsiveInfoCard}>
          <Text style={styles.responsiveTitle}>Réactif</Text>
          <View style={styles.responsiveStats}>
            <View style={styles.responsiveStatItem}>
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={styles.responsiveStatText}>{formatResponseTime(effectiveProfile.responseTimeHours)}</Text>
            </View>
            <View style={styles.responsiveStatItem}>
              <Ionicons name="stats-chart-outline" size={16} color={colors.accent} />
              <Text style={styles.responsiveStatText}>{formatResponseRate(effectiveProfile.responseRate)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showResponsiveModal} transparent animationType="fade" onRequestClose={() => setShowResponsiveModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowResponsiveModal(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Réactif</Text>
            <Text style={styles.modalDescription}>
              Ce membre répond aux messages, mais à son propre rythme.
            </Text>
            <View style={styles.responsiveStats}>
              <View style={styles.responsiveStatItem}>
                <Ionicons name="time-outline" size={16} color={colors.accent} />
                <Text style={styles.responsiveStatText}>{formatResponseTime(effectiveProfile.responseTimeHours)}</Text>
              </View>
              <View style={styles.responsiveStatItem}>
                <Ionicons name="stats-chart-outline" size={16} color={colors.accent} />
                <Text style={styles.responsiveStatText}>{formatResponseRate(effectiveProfile.responseRate)}</Text>
              </View>
            </View>
            <Pressable style={styles.modalPrimaryButton} onPress={() => setShowResponsiveModal(false)}>
              <Text style={styles.modalPrimaryButtonText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showReviewModal} transparent animationType="slide" onRequestClose={() => setShowReviewModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !reviewMutation.isPending && setShowReviewModal(false)} />
          <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.modalSheetWrap}>
            <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
              <Text style={styles.modalTitle}>Laisser un avis</Text>
              <Text style={styles.modalDescription}>Votre avis concerne uniquement cet utilisateur.</Text>

              <View style={styles.ratingSelector}>
                {[1, 2, 3, 4, 5].map(value => (
                  <Pressable key={value} style={styles.starButton} onPress={() => setReviewRating(value)}>
                    <Ionicons name={value <= reviewRating ? 'star' : 'star-outline'} size={24} color={colors.warning} />
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="Votre avis..."
                placeholderTextColor={colors.placeholder}
                multiline
                style={[styles.modalInput, styles.modalTextarea]}
              />
              <TextInput
                value={reviewLocation}
                onChangeText={setReviewLocation}
                placeholder="Localisation (optionnel)"
                placeholderTextColor={colors.placeholder}
                style={styles.modalInput}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Afficher aussi comme témoignage</Text>
                <Switch value={reviewAsTestimonial} onValueChange={setReviewAsTestimonial} />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowReviewModal(false)}
                  disabled={reviewMutation.isPending}
                >
                  <Text style={styles.modalSecondaryButtonText}>Annuler</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalPrimaryButton, (!reviewComment.trim() || reviewMutation.isPending) && styles.modalPrimaryButtonDisabled]}
                  onPress={() => reviewMutation.mutate()}
                  disabled={!reviewComment.trim() || reviewMutation.isPending}
                >
                  <Text style={styles.modalPrimaryButtonText}>{reviewMutation.isPending ? 'Envoi...' : 'Envoyer'}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !reportMutation.isPending && setShowReportModal(false)} />
          <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.modalSheetWrap}>
            <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
              <Text style={styles.modalTitle}>Signaler cet utilisateur</Text>
              <Text style={styles.modalDescription}>Merci de préciser la raison du signalement.</Text>

              <TextInput
                value={reportReason}
                onChangeText={setReportReason}
                placeholder="Raison"
                placeholderTextColor={colors.placeholder}
                style={styles.modalInput}
              />
              <TextInput
                value={reportDetails}
                onChangeText={setReportDetails}
                placeholder="Détails (optionnel)"
                placeholderTextColor={colors.placeholder}
                multiline
                style={[styles.modalInput, styles.modalTextarea]}
              />
              <TextInput
                value={reportEmail}
                onChangeText={setReportEmail}
                placeholder="Email de contact (optionnel)"
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.modalInput}
              />
              <TextInput
                value={reportPhone}
                onChangeText={setReportPhone}
                placeholder="Téléphone (optionnel)"
                placeholderTextColor={colors.placeholder}
                keyboardType="phone-pad"
                style={styles.modalInput}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowReportModal(false)}
                  disabled={reportMutation.isPending}
                >
                  <Text style={styles.modalSecondaryButtonText}>Annuler</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalPrimaryButton, (!reportReason.trim() || reportMutation.isPending) && styles.modalPrimaryButtonDisabled]}
                  onPress={() => reportMutation.mutate()}
                  disabled={!reportReason.trim() || reportMutation.isPending}
                >
                  <Text style={styles.modalPrimaryButtonText}>{reportMutation.isPending ? 'Envoi...' : 'Envoyer'}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background
  },
  centerInline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl
  },
  errorText: {
    color: colors.text,
    fontSize: typography.body,
    textAlign: 'center'
  },
  container: {
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4
  },
  retryBanner: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warningSoft,
    backgroundColor: '#fff7e8',
    padding: spacing.sm
  },
  retryBannerText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.caption
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.soft
  },
  heroBanner: {
    minHeight: 104,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    justifyContent: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    position: 'relative'
  },
  heroBannerGlow: {
    position: 'absolute',
    right: -32,
    top: -26,
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: colors.primarySoftStrong
  },
  heroBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    marginTop: -spacing.xl
  },
  identityBlock: {
    flexDirection: 'row',
    gap: spacing.md
  },
  avatarShell: {
    width: 92,
    alignItems: 'center'
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadows.soft
  },
  avatarImage: {
    width: '100%',
    height: '100%'
  },
  avatarFallback: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold
  },
  identityMeta: {
    flex: 1
  },
  identityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  identityHeaderText: {
    flex: 1,
    paddingTop: spacing.xl
  },
  name: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold
  },
  memberSinceText: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  ratingRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  ratingRowEmpty: {
    opacity: 0.8
  },
  ratingValue: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  ratingMeta: {
    color: colors.muted,
    fontSize: typography.caption
  },
  statsCardsRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm
  },
  statsCard: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center'
  },
  statsCardValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightExtrabold
  },
  statsCardLabel: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.captionSm
  },
  factsList: {
    marginTop: spacing.lg,
    gap: spacing.sm
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  factText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.caption
  },
  heroActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    zIndex: 1
  },
  menuAnchor: {
    position: 'relative'
  },
  iconActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuDropdown: {
    position: 'absolute',
    top: 46,
    right: 0,
    minWidth: 156,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: spacing.xs,
    ...shadows.elevated,
    zIndex: 6
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  menuItemText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  followButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...shadows.soft
  },
  followButtonText: {
    color: colors.white,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  badgesRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md
  },
  followRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg
  },
  badgeInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  badgeStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  badgeLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  reviewCta: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  reviewCtaText: {
    color: colors.white,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  mainTabs: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  mainTab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
  },
  mainTabActive: {
    borderBottomColor: colors.accent
  },
  mainTabText: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: typography.weightSemibold
  },
  mainTabTextActive: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  subTabs: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm
  },
  subTab: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  subTabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  subTabText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  subTabTextActive: {
    color: colors.accent,
    fontWeight: typography.weightBold
  },
  grid: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md
  },
  errorInline: {
    marginTop: spacing.lg,
    color: colors.danger,
    fontSize: typography.bodySm
  },
  emptyText: {
    marginTop: spacing.lg,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  moreRow: {
    marginTop: spacing.lg,
    alignItems: 'flex-start'
  },
  moreButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  moreButtonText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  reviewsCard: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.soft
  },
  reviewsSummary: {
    marginBottom: spacing.lg
  },
  ratingScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  ratingScoreValue: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold
  },
  ratingScoreSuffix: {
    color: colors.muted,
    fontSize: typography.body
  },
  reviewsSummaryText: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  reviewsList: {
    gap: spacing.md
  },
  reviewItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  reviewAuthor: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  reviewRating: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  reviewComment: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: typography.bodySm,
    lineHeight: 20
  },
  reviewDate: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: typography.caption
  },
  responsiveInfoCard: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.soft
  },
  responsiveTitle: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold
  },
  responsiveStats: {
    marginTop: spacing.md,
    gap: spacing.md
  },
  responsiveStatItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  responsiveStatText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm,
    lineHeight: 20
  },
  followButtonDisabled: {
    opacity: 0.6
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlayStrong,
    justifyContent: 'flex-end'
  },
  modalCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.lg,
    ...shadows.elevated
  },
  modalSheetWrap: {
    justifyContent: 'flex-end'
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold
  },
  modalDescription: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.bodySm,
    lineHeight: 20
  },
  ratingSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  starButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt
  },
  modalInput: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.bodySm
  },
  modalTextarea: {
    minHeight: 112,
    textAlignVertical: 'top'
  },
  switchRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  switchLabel: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  modalSecondaryButton: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md
  },
  modalSecondaryButtonText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  modalPrimaryButton: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.6
  },
  modalPrimaryButtonText: {
    color: colors.white,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  }
})
