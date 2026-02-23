import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { Button } from '../../components/ui/Button'
import { FavoriteButton } from '../../components/ui/FavoriteButton'
import { apiGet, apiPost } from '../../utils/api'
import type { Listing } from '../../types/listing'
import type { Review, ReviewSummary, SellerReviewsResponse } from '../../types/review'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import type { ConversationDetail } from '../../types/messages'
import { useAuth } from '../../hooks/useAuth'
import { useFollowedSellers } from '../../hooks/useFollowedSellers'
import { useI18n } from '../../contexts/I18nContext'
import { formatCityZip } from '../../utils/location'
import { toRenderableRichTextHtml } from '../../utils/richText'
type MapboxMap = import('mapbox-gl').Map
type MapboxMarker = import('mapbox-gl').Marker
import 'mapbox-gl/dist/mapbox-gl.css'

const STREET_SEGMENT_PATTERN = /\b(rue|avenue|av\.?|boulevard|bd\.?|street|st\.?|road|rd\.?|route|impasse|allee|lotissement)\b/i
const COUNTRY_SEGMENT_PATTERN = /^(cameroon|cameroun)$/i

function normalizeLocationToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitLocationParts(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

function dedupeLocationParts(parts: string[]): string[] {
  const seen = new Set<string>()
  return parts.filter(part => {
    const normalized = normalizeLocationToken(part)
    if (!normalized || seen.has(normalized)) {
      return false
    }
    seen.add(normalized)
    return true
  })
}

function looksLikeStreetSegment(value: string): boolean {
  return /\d/.test(value) || STREET_SEGMENT_PATTERN.test(value)
}

function buildExactLocationLabel(input: {
  label?: string
  address?: string
  city?: string
  zipcode?: string
}): string {
  const city = typeof input.city === 'string' ? input.city.trim() : ''
  const zipcode = typeof input.zipcode === 'string' ? input.zipcode.trim() : ''
  const cityZip = formatCityZip(city, zipcode)
  const rawLabel =
    (typeof input.label === 'string' && input.label.trim()) ||
    (typeof input.address === 'string' && input.address.trim()) ||
    ''

  const parts = dedupeLocationParts(splitLocationParts(rawLabel)).filter(
    part => !COUNTRY_SEGMENT_PATTERN.test(part.trim())
  )

  // Prefer broad location tokens (neighborhood/city/region) over street-level fragments.
  const broadParts = parts.filter(part => !looksLikeStreetSegment(part))
  const tokens = broadParts.length ? broadParts : parts

  if (city && tokens.length) {
    const normalizedCity = normalizeLocationToken(city)
    const cityIndex = tokens.findIndex(part => normalizeLocationToken(part) === normalizedCity)

    if (cityIndex > 0) {
      return `${tokens[cityIndex - 1]}, ${tokens[cityIndex]}`
    }

    if (cityIndex === 0) {
      if (tokens[1]) {
        return `${tokens[0]}, ${tokens[1]}`
      }
      return tokens[0]
    }
  }

  if (tokens.length >= 2) {
    return `${tokens[0]}, ${tokens[1]}`
  }

  if (tokens[0]) {
    return tokens[0]
  }

  return cityZip || city || ''
}

function buildPublicLocationLabel(input: {
  label?: string
  address?: string
  city?: string
  zipcode?: string
}): string {
  const city = typeof input.city === 'string' ? input.city.trim() : ''
  const zipcode = typeof input.zipcode === 'string' ? input.zipcode.trim() : ''
  const cityZip = formatCityZip(city, zipcode)
  const rawLabel =
    (typeof input.label === 'string' && input.label.trim()) ||
    (typeof input.address === 'string' && input.address.trim()) ||
    ''
  const parts = splitLocationParts(rawLabel)

  if (city) {
    const normalizedCity = normalizeLocationToken(city)
    const cityPartIndex = parts.findIndex(part => {
      const normalized = normalizeLocationToken(part)
      return (
        normalized === normalizedCity ||
        normalized.includes(normalizedCity) ||
        normalizedCity.includes(normalized)
      )
    })

    if (cityPartIndex > 0) {
      const previous = parts[cityPartIndex - 1]
      if (
        previous &&
        !looksLikeStreetSegment(previous) &&
        normalizeLocationToken(previous) !== normalizedCity
      ) {
        return `${previous}, ${parts[cityPartIndex]}`
      }
    }

    if (cityPartIndex >= 0) {
      return parts[cityPartIndex]
    }
  }

  if (parts.length >= 2 && !looksLikeStreetSegment(parts[0])) {
    return `${parts[0]}, ${parts[1]}`
  }

  if (cityZip) {
    return cityZip
  }

  if (city) {
    return city
  }

  if (parts.length) {
    return parts[0]
  }

  return ''
}

function formatPrice(listing: Listing | null, locale: string): string {
  if (!listing) {
    return ''
  }

  const numericPrice = Number(listing.price)

  if (Number.isFinite(numericPrice)) {
    try {
      const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
      return new Intl.NumberFormat(numberLocale, {
        style: 'currency',
        currency: listing.currency || 'XAF'
      }).format(numericPrice)
    } catch {
      // Fallback handled below
    }
  }

  return [listing.price, listing.currency].filter(Boolean).join(' ')
}

function formatDate(value: string | null | undefined, locale: string): string | null {
  if (!value) {
    return null
  }

  try {
    const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
    return new Date(value).toLocaleDateString(dateLocale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return value
  }
}

function formatRating(value?: number | null): string {
  if (!value || !Number.isFinite(value)) {
    return '0/5'
  }
  return `${value}/5`
}

function formatDeliveryLabel(delivery: import('../../types/deliveries').Delivery | null): string | null {
  if (!delivery) return null
  const statusMap: Record<string, string> = {
    requested: 'En attente',
    accepted: 'Assignée',
    picked_up: 'En cours',
    delivered: delivery.handoverMode === 'pickup' ? 'Remise effectuée' : 'Livrée',
    canceled: 'Annulée'
  }
  const escrowMap: Record<string, string> = {
    pending: 'Paiement en attente',
    held: 'Paiement sécurisé',
    released: 'Paiement libéré',
    refunded: 'Paiement remboursé'
  }
  const statusLabel = statusMap[delivery.status] ?? delivery.status
  const escrowLabel =
    delivery.escrowStatus && delivery.escrowStatus !== 'none'
      ? escrowMap[delivery.escrowStatus] ?? delivery.escrowStatus
      : null
  return escrowLabel ? `${statusLabel} · ${escrowLabel}` : statusLabel
}

function buildDefaultHighlights(
  listing: Listing | null,
  t: (key: string, values?: Record<string, string | number>) => string
): string[] {
  if (!listing) {
    return []
  }

  const computed: string[] = []

  if (listing.rooms) {
    computed.push(
      listing.rooms > 1
        ? t('listings.detail.roomsPlural', { count: listing.rooms })
        : t('listings.detail.roomsSingle', { count: listing.rooms })
    )
  }

  if (listing.surface) {
    computed.push(listing.surface)
  }

  if (listing.tag) {
    computed.push(listing.tag)
  }

  return computed.slice(0, 4)
}

export default function ListingDetail() {
  const { t, locale } = useI18n()
  const { id } = useParams<{ id: string }>()
  const listingId = id ?? ''

  const [listing, setListing] = useState<Listing | null>(null)
  const [similarListings, setSimilarListings] = useState<Listing[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportEmail, setReportEmail] = useState('')
  const [isReporting, setIsReporting] = useState(false)
  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [isShortLoading, setIsShortLoading] = useState(false)
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [approxCoords, setApproxCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [deliveryInfo, setDeliveryInfo] = useState<import('../../types/deliveries').Delivery | null>(null)
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: '',
    location: ''
  })
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { user, isAuthenticated } = useAuth()
  const { isFollowing, followSeller, unfollowSeller } = useFollowedSellers()

  useEffect(() => {
    if (!listingId) {
      setListing(null)
      setSimilarListings([])
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    const listingPromise = apiGet<Listing>(`/listings/${listingId}`, {
      signal: controller.signal
    })

    const similarPromise = apiGet<Listing[]>(
      `/listings/${listingId}/similar?limit=4`,
      {
        signal: controller.signal
      }
    ).catch(() => [])

    Promise.all([listingPromise, similarPromise])
      .then(([details, similars]) => {
        setListing(details)
        setSimilarListings(similars)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        console.error('Unable to load listing detail', err)
        setError(t('listings.detail.unavailable'))
        setListing(null)
        setSimilarListings([])
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [listingId, t])

  const loadReviews = useCallback((sellerId?: string) => {
    if (!sellerId) {
      setReviews([])
      setReviewSummary(null)
      return
    }

    const controller = new AbortController()
    setReviewsLoading(true)
    setReviewsError(null)

    apiGet<SellerReviewsResponse>(`/reviews/sellers/${sellerId}`, {
      signal: controller.signal
    })
      .then(data => {
        setReviews(data.items ?? [])
        setReviewSummary(data.summary ?? null)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        console.error('Unable to load reviews', err)
        setReviewsError(t('listings.detail.reviews.loadError'))
        setReviews([])
        setReviewSummary(null)
      })
      .finally(() => setReviewsLoading(false))

    return () => controller.abort()
  }, [t])

  useEffect(() => {
    return loadReviews(listing?.owner?.id)
  }, [listing?.owner?.id, loadReviews])

  useEffect(() => {
    if (!listingId || !isAuthenticated) {
      setDeliveryInfo(null)
      return
    }
    apiGet<import('../../types/deliveries').Delivery | null>(`/deliveries/listing/${listingId}`)
      .then(data => setDeliveryInfo(data))
      .catch(() => setDeliveryInfo(null))
  }, [listingId, isAuthenticated])

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending || !listingId) return;

    setIsSending(true);
    try {
      const conversation = await apiPost<ConversationDetail>('/messages/conversations', {
        listingId,
        content: newMessage
      })
      setShowContactModal(false);
      setNewMessage('');
      addToast({
        variant: 'success',
        title: t('listings.detail.conversation.createdTitle'),
        message: t('listings.detail.conversation.createdMessage')
      })
      navigate(`/dashboard/messages/${conversation.id}`);
    } catch (err) {
      console.error('Unable to start conversation', err);
      addToast({
        variant: 'error',
        title: t('listings.detail.conversation.errorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('listings.detail.conversation.errorMessage')
      })
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmitReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!listingId || !reportReason.trim() || isReporting) {
      return
    }

    setIsReporting(true)
    try {
      await apiPost('/reports', {
        listingId,
        reason: reportReason.trim(),
        details: reportDetails.trim() || undefined,
        contactEmail: reportEmail.trim() || undefined
      })
      addToast({
        variant: 'success',
        title: t('listings.detail.report.sentTitle'),
        message: t('listings.detail.report.sentMessage')
      })
      setShowReportModal(false)
      setReportReason('')
      setReportDetails('')
      setReportEmail('')
    } catch (err) {
      console.error('Unable to submit report', err)
      addToast({
        variant: 'error',
        title: t('listings.detail.report.errorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('listings.detail.report.errorMessage')
      })
    } finally {
      setIsReporting(false)
    }
  }

  const handleSubmitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!listing?.id || !listing.owner?.id || !isAuthenticated || isSubmittingReview) {
      return
    }

    const rating = Number(reviewForm.rating)
    const comment = reviewForm.comment.trim()
    const location = reviewForm.location.trim()

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      addToast({
        variant: 'info',
        title: t('listings.detail.review.invalidRatingTitle'),
        message: t('listings.detail.review.invalidRatingMessage')
      })
      return
    }

    if (comment && comment.length < 10) {
      addToast({
        variant: 'info',
        title: t('listings.detail.review.tooShortTitle'),
        message: t('listings.detail.review.tooShortMessage')
      })
      return
    }

    setIsSubmittingReview(true)
    try {
      await apiPost('/reviews', {
        listingId: listing.id,
        rating,
        comment: comment || undefined,
        location: location || undefined
      })
      setReviewForm({ rating: 5, comment: '', location: '' })
      addToast({
        variant: 'success',
        title: t('listings.detail.review.successTitle'),
        message: t('listings.detail.review.successMessage')
      })
      loadReviews(listing.owner.id)
    } catch (err) {
      console.error('Unable to submit review', err)
      addToast({
        variant: 'error',
        title: t('listings.detail.review.errorTitle'),
        message: err instanceof Error ? err.message : t('listings.detail.review.errorMessage')
      })
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const listingIdentifier = listing?.id

  useEffect(() => {
    if (!listingIdentifier) {
      return
    }

    const controller = new AbortController()
    void apiPost(`/listings/${listingIdentifier}/views`, undefined, {
      signal: controller.signal
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      console.error('Unable to increment views', err)
    })

    return () => controller.abort()
  }, [listingIdentifier])

  const handleGenerateShortLink = useCallback(async () => {
    if (!listing) return
    if (typeof window === 'undefined') return
    setIsShortLoading(true)
    setCopyHint(null)
    try {
      const targetUrl = window.location.href
      if (!/^https?:\/\//.test(targetUrl)) {
        throw new Error(t('listings.detail.shortLink.invalidUrl'))
      }
      const response = await apiPost<{ shortUrl: string; slug: string; targetUrl: string }>(
        '/links/shorten',
        { targetUrl }
      )
      setShortUrl(response.shortUrl)
    } catch (err) {
      console.error('Unable to create short link', err)
      addToast({
        variant: 'error',
        title: t('listings.detail.shortLink.errorTitle'),
        message: err instanceof Error ? err.message : t('listings.detail.shortLink.errorMessage')
      })
    } finally {
      setIsShortLoading(false)
    }
  }, [addToast, listing, t])

  const resolvedShareUrl =
    shortUrl ?? (typeof window !== 'undefined' ? window.location.href : '')

  const handleCopyShortLink = useCallback(async () => {
    if (!resolvedShareUrl || typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }
    try {
      await navigator.clipboard.writeText(resolvedShareUrl)
      setCopyHint(t('listings.detail.shortLink.copied'))
      setTimeout(() => setCopyHint(null), 1500)
    } catch {
      setCopyHint(t('listings.detail.shortLink.copyError'))
    }
  }, [resolvedShareUrl, t])

  const handleExportPdf = useCallback(async () => {
    if (!listing) return
    setIsExporting(true)
    try {
      const response = await fetch(`/listings/${listing.id}/export`, {
        method: 'GET'
      })
      if (!response.ok) {
        throw new Error(`Statut ${response.status}`)
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `annonce-${listing.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Unable to export PDF', err)
      addToast({
        variant: 'error',
        title: t('listings.detail.export.errorTitle'),
        message: err instanceof Error ? err.message : t('listings.detail.export.errorMessage')
      })
    } finally {
      setIsExporting(false)
    }
  }, [addToast, listing, t])

  const shareLabel = listing?.title || t('listings.detail.share.title')
  const encodedShareUrl = resolvedShareUrl ? encodeURIComponent(resolvedShareUrl) : ''
  const encodedShareText = encodeURIComponent(shareLabel)
  const whatsappShareUrl = resolvedShareUrl
    ? `https://wa.me/?text=${encodedShareText}%20${encodedShareUrl}`
    : ''
  const messengerShareUrl = resolvedShareUrl
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`
    : ''
  const twitterShareUrl = resolvedShareUrl
    ? `https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedShareUrl}`
    : ''
  const emailShareUrl = resolvedShareUrl
    ? `mailto:?subject=${encodedShareText}&body=${encodedShareText}%0A${encodedShareUrl}`
    : ''

  const images = listing?.images ?? []
  const mainImage = useMemo(
    () => images.find(image => image.isCover) ?? images[0] ?? null,
    [images]
  )
  useEffect(() => {
    if (!images.length) {
      setActiveImageIndex(0)
      return
    }
    const coverIndex = images.findIndex(image => image.isCover)
    setActiveImageIndex(coverIndex >= 0 ? coverIndex : 0)
  }, [images])
  const activeImage = images[activeImageIndex] ?? mainImage
  const publishedAt = formatDate(listing?.publishedAt, locale)
  const publishedFallback = publishedAt ?? formatDate(listing?.created_at, locale)
  const highlights = listing?.highlights?.length
    ? listing.highlights
    : buildDefaultHighlights(listing, t)
  const renderedDescription = useMemo(
    () => toRenderableRichTextHtml(listing?.description ?? ''),
    [listing?.description]
  )
  const formattedPrice = formatPrice(listing, locale)
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const formatListingDate = (value: string | null | undefined) => {
    if (!value) return null
    try {
      return new Date(value).toLocaleDateString(dateLocale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    } catch {
      return null
    }
  }
  const countLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const ownerListingCount =
    typeof listing?.owner?.listingCount === 'number'
      ? new Intl.NumberFormat(countLocale).format(listing.owner.listingCount)
      : null
  const ownerName = listing?.owner
    ? `${listing.owner.firstName} ${listing.owner.lastName}`.trim()
    : t('listings.detail.sellerFallback')
  const listingViews = typeof listing?.views === 'number' ? listing.views : 0
  const listingMessages =
    typeof listing?.messagesCount === 'number' ? listing.messagesCount : 0
  const ownerLink = listing?.owner?.isPro
    ? listing?.owner?.storefrontSlug
      ? `/store/${listing.owner.storefrontSlug}`
      : undefined
    : listing?.owner?.storefrontSlug
      ? `/u/${listing.owner.storefrontSlug}`
      : listing?.owner?.id
        ? `/u/${listing.owner.id}`
        : undefined
  const isSeller = Boolean(user?.id && listing?.owner?.id && user.id === listing.owner.id)
  const canFollowSeller = Boolean(listing?.owner?.isPro && listing?.owner?.id && !isSeller)
  const canBuy = Boolean(listing?.id && !isSeller && listing?.status === 'published')
  const isBuyerPurchaseInProgress = Boolean(
    canBuy &&
      user?.id &&
      deliveryInfo?.buyer?.id === user.id &&
      deliveryInfo.status !== 'canceled' &&
      deliveryInfo.escrowStatus !== 'released' &&
      deliveryInfo.escrowStatus !== 'refunded'
  )
  const handleBuyNow = () => {
    if (!canBuy || isBuyerPurchaseInProgress) {
      return
    }
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    navigate(`/listing/${listingId}/checkout`)
  }
  const isFollowingSeller = listing?.owner?.id ? isFollowing(listing.owner.id) : false
  const handleFollowSeller = async () => {
    if (!listing?.owner?.id) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (isFollowingSeller) {
      await unfollowSeller(listing.owner.id)
    } else {
      await followSeller(listing.owner.id)
    }
  }
  const hasReviewed = useMemo(
    () => Boolean(user?.id && reviews.some(review => review.reviewer.id === user.id)),
    [reviews, user?.id]
  )

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<MapboxMap | null>(null)
  const mapMarkerRef = useRef<MapboxMarker | null>(null)

  const reservedDetailKeys = useMemo(
    () =>
      new Set([
        'subject',
        'body',
        'price_cents',
        'price_reco',
        'donation',
        'phone',
        'phone_hidden_information_text',
        'location',
        'latitude',
        'longitude',
        'address',
        'email',
        'category',
        'categoryId',
        'contact_email',
        'owner_email',
        'handover_modes',
        'handover_mode',
        'lat',
        'lng',
        'latitude',
        'longitude'
      ]),
    []
  )

  const formatDetailLabel = (key: string) => {
    const normalized = key.toLowerCase()
    const labelMap: Record<string, string> = {
      regdate: t('listings.detail.fields.regdate'),
      issuance_date: t('listings.detail.fields.issuanceDate'),
      spare_parts_availability: t('listings.detail.fields.sparePartsAvailability'),
      handover_modes: t('listings.new.handover.title'),
      handover_mode: t('listings.new.handover.title')
    }

    if (labelMap[normalized]) {
      return labelMap[normalized]
    }

    return normalized
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
  }

  const formatDetailValue = (key: string, value: unknown): string => {
    const normalized = key.toLowerCase()
    const values = Array.isArray(value) ? value : [value]

    if (normalized === 'handover_modes' || normalized === 'handover_mode') {
      return values
        .map(entry => {
          const token = String(entry ?? '').trim().toLowerCase()
          if (!token) return ''
          if (token === 'pickup') return t('listings.new.handover.pickup')
          if (token === 'delivery') return t('listings.new.handover.delivery')
          return String(entry)
        })
        .filter(Boolean)
        .join(', ')
    }

    return Array.isArray(value)
      ? value
          .map(entry => (entry === null || entry === undefined ? '' : String(entry)))
          .filter(Boolean)
          .join(', ')
      : typeof value === 'object'
      ? ''
      : String(value ?? '')
  }

  const detailEntries = useMemo(() => {
    if (!listing) {
      return []
    }

    const entries: Array<{ label: string; value: string }> = []

    const pushEntry = (label: string, value: unknown, key?: string) => {
      if (value === null || value === undefined) return
      const stringValue = key ? formatDetailValue(key, value) : formatDetailValue('', value)
      if (stringValue.trim()) {
        entries.push({ label, value: stringValue.trim() })
      }
    }

    pushEntry(t('listings.detail.fields.surface'), listing.surface)
    pushEntry(t('listings.detail.fields.rooms'), listing.rooms)
    pushEntry(t('listings.detail.fields.type'), listing.tag)

    const details = listing.attributes ?? listing.details ?? {}
    Object.entries(details).forEach(([key, value]) => {
      if (reservedDetailKeys.has(key)) {
        return
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return
      }

      pushEntry(formatDetailLabel(key), value, key)
    })

    return entries
  }, [listing, reservedDetailKeys, t])

  const handoverModes = useMemo<Array<'pickup' | 'delivery'>>(() => {
    if (!listing) {
      return []
    }

    const raw =
      (listing.attributes as Record<string, unknown> | undefined)?.handover_modes ??
      (listing.details as Record<string, unknown> | undefined)?.handover_modes ??
      (listing.attributes as Record<string, unknown> | undefined)?.handover_mode ??
      (listing.details as Record<string, unknown> | undefined)?.handover_mode

    const normalized = Array.isArray(raw)
      ? raw
          .map(entry => String(entry ?? '').trim().toLowerCase())
          .filter(mode => mode === 'pickup' || mode === 'delivery')
      : typeof raw === 'string'
      ? raw
          .split(',')
          .map(entry => entry.trim().toLowerCase())
          .filter(mode => mode === 'pickup' || mode === 'delivery')
      : []

    return Array.from(new Set(normalized)) as Array<'pickup' | 'delivery'>
  }, [listing])

  const hasPickupHandover = handoverModes.includes('pickup')
  const hasDeliveryHandover = handoverModes.includes('delivery')

  const resolvedLocation = listing?.location as any
  const locationAddress =
    (resolvedLocation && typeof resolvedLocation === 'object'
      ? resolvedLocation.address
      : typeof resolvedLocation === 'string'
      ? resolvedLocation
      : '') || ''
  const locationLabel =
    (resolvedLocation && typeof resolvedLocation === 'object' ? resolvedLocation.label : '') || ''
  const locationHideExact =
    resolvedLocation && typeof resolvedLocation === 'object'
      ? Boolean((resolvedLocation as { hideExact?: boolean }).hideExact)
      : false
  const locationPostalCode =
    (resolvedLocation && typeof resolvedLocation === 'object'
      ? (resolvedLocation as { zipcode?: string; zipCode?: string; postal_code?: string }).zipcode ??
        (resolvedLocation as { zipcode?: string; zipCode?: string; postal_code?: string }).zipCode ??
        (resolvedLocation as { zipcode?: string; zipCode?: string; postal_code?: string }).postal_code
      : undefined) || ''
  const locationCity =
    (resolvedLocation && typeof resolvedLocation === 'object'
      ? (resolvedLocation as { city?: string }).city
      : typeof resolvedLocation === 'string'
      ? resolvedLocation
      : undefined) ??
    listing?.city ??
    ''

  const publicLocation = (() => {
    const value = buildPublicLocationLabel({
      label: locationLabel,
      address: locationAddress,
      city: locationCity,
      zipcode: locationPostalCode
    })
    return value || t('listings.detail.locationUnavailable')
  })()

  const displayLocation = (() => {
    const exactLabel = buildExactLocationLabel({
      label: locationLabel,
      address: locationAddress,
      city: locationCity,
      zipcode: locationPostalCode
    })

    if (locationHideExact) {
      return publicLocation
    }

    if (exactLabel) {
      return exactLabel
    }

    return t('listings.detail.locationUnavailable')
  })()

  const showExactLocation =
    !locationHideExact &&
    Boolean(displayLocation) &&
    normalizeLocationToken(displayLocation) !== normalizeLocationToken(publicLocation)

  const handlePrevImage = () => {
    if (images.length <= 1) return
    setActiveImageIndex(prev => (prev - 1 + images.length) % images.length)
  }

  const handleNextImage = () => {
    if (images.length <= 1) return
    setActiveImageIndex(prev => (prev + 1) % images.length)
  }

  const parseCoordinate = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
    return null
  }

  const latitude =
    parseCoordinate(
      resolvedLocation && typeof resolvedLocation === 'object'
        ? (resolvedLocation as { latitude?: unknown; lat?: unknown }).latitude ??
          (resolvedLocation as { latitude?: unknown; lat?: unknown }).lat
        : (listing?.attributes as { latitude?: unknown; lat?: unknown })?.latitude ??
          (listing?.attributes as { latitude?: unknown; lat?: unknown })?.lat ??
          (listing?.details as { latitude?: unknown; lat?: unknown })?.latitude ??
          (listing?.details as { latitude?: unknown; lat?: unknown })?.lat
    ) ?? null

  const longitude =
    parseCoordinate(
      resolvedLocation && typeof resolvedLocation === 'object'
        ? (resolvedLocation as { longitude?: unknown; lng?: unknown }).longitude ??
          (resolvedLocation as { longitude?: unknown; lng?: unknown }).lng
        : (listing?.attributes as { longitude?: unknown; lng?: unknown })?.longitude ??
          (listing?.attributes as { longitude?: unknown; lng?: unknown })?.lng ??
          (listing?.details as { longitude?: unknown; lng?: unknown })?.longitude ??
          (listing?.details as { longitude?: unknown; lng?: unknown })?.lng
    ) ?? null

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    console.log('[ListingDetail] Mapbox token present:', Boolean(token))
    if (!token) {
      setApproxCoords(null)
      return
    }
    if (!locationHideExact) {
      setApproxCoords(null)
      return
    }
    if (!locationCity && !locationPostalCode) {
      setApproxCoords(null)
      return
    }

    let isCancelled = false
    const controller = new AbortController()
    const query = [locationPostalCode, locationCity].filter(Boolean).join(' ')
    console.log('[ListingDetail] Mapbox geocode query:', query)

    const fetchCoords = async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
            `limit=1&types=place,postcode&access_token=${token}`,
          { signal: controller.signal }
        )
        console.log('[ListingDetail] Mapbox geocode status:', response.status)
        if (!response.ok) {
          throw new Error(`Mapbox ${response.status}`)
        }
        const data = (await response.json()) as { features?: Array<{ center?: [number, number] }> }
        const center = data.features?.[0]?.center
        if (!isCancelled && center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
          setApproxCoords({ lng: center[0], lat: center[1] })
        } else if (!isCancelled) {
          setApproxCoords(null)
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Unable to geocode masked location', error)
          setApproxCoords(null)
        }
      }
    }

    void fetchCoords()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [locationHideExact, locationCity, locationPostalCode])

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    const targetLat = locationHideExact ? approxCoords?.lat ?? null : latitude
    const targetLng = locationHideExact ? approxCoords?.lng ?? null : longitude
    if (!token || targetLat === null || targetLng === null) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        mapMarkerRef.current = null
      }
      return
    }

    if (!mapContainerRef.current) {
      return
    }

    let isCancelled = false

    import('mapbox-gl')
      .then(module => {
        if (isCancelled) {
          return
        }
        const mapboxgl = (module.default ?? module) as unknown as typeof import('mapbox-gl')
        ;(mapboxgl as any).accessToken = token

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove()
        }

        const map = new mapboxgl.Map({
          container: mapContainerRef.current as HTMLDivElement,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [targetLng, targetLat],
          zoom: locationHideExact ? 11 : 13,
          pitch: 20,
          bearing: 0
        })

        map.on('load', () => {
          if (!locationHideExact) {
            const marker =
              mapMarkerRef.current ??
              new mapboxgl.Marker({ color: '#ff6e14' }).setLngLat([targetLng, targetLat])
            marker.setLngLat([targetLng, targetLat]).addTo(map)
            mapMarkerRef.current = marker
          }
        })

        mapInstanceRef.current = map
      })
      .catch(err => {
        console.error('Unable to initialize mapbox on listing detail', err)
      })

    return () => {
      isCancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        mapMarkerRef.current = null
      }
    }
  }, [latitude, longitude, approxCoords, locationHideExact])

  return (
    <MainLayout>
      <div className="listing-detail">
        {isLoading ? (
          <p style={{ padding: '1.5rem 0', color: '#6c757d' }}>
            {t('listings.detail.loading')}
          </p>
        ) : null}

        {error ? (
          <div className="listing-details__section" role="alert">
            <h2>{t('listings.detail.unavailableTitle')}</h2>
            <p>{error}</p>
            <Link to="/search" className="btn btn--outline">
              {t('listings.detail.backToListings')}
            </Link>
          </div>
        ) : null}

        {!isLoading && !error && !listing ? (
          <div className="listing-details__section">
            <h2>{t('listings.detail.notFoundTitle')}</h2>
            <p>
              {t('listings.detail.notFoundMessage')}
            </p>
            <Link to="/search" className="btn btn--outline">
              {t('listings.detail.notFoundCta')}
            </Link>
          </div>
        ) : null}

        {listing ? (
          <>
            <div className="listing-detail__main">
              <div className="listing-gallery">
                <div
                  className="listing-gallery__main"
                  style={
                    activeImage?.url
                      ? {
                          backgroundImage: `url(${activeImage.url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }
                      : undefined
                  }
                  role={activeImage ? 'button' : undefined}
                  tabIndex={activeImage ? 0 : undefined}
                  onClick={activeImage ? () => setLightboxOpen(true) : undefined}
                >
                  <FavoriteButton
                    listingId={listing.id}
                    className="favorite-toggle--overlay"
                  />
                  {images.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className="listing-gallery__nav listing-gallery__nav--prev"
                        onClick={event => {
                          event.stopPropagation()
                          handlePrevImage()
                        }}
                        aria-label={t('listing.gallery.prev')}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className="listing-gallery__nav listing-gallery__nav--next"
                        onClick={event => {
                          event.stopPropagation()
                          handleNextImage()
                        }}
                        aria-label={t('listing.gallery.next')}
                      >
                        ›
                      </button>
                    </>
                  ) : null}
                  {!activeImage ? (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6c757d',
                        fontWeight: 600
                      }}
                    >
                      {t('listings.detail.noPhoto')}
                    </div>
                  ) : null}
                </div>
                <div className="listing-gallery__thumbs">
                  {images.length
                    ? images.map(image => (
                        <div
                          key={image.id}
                          className={`listing-gallery__thumb${image.id === activeImage?.id ? ' is-active' : ''}`}
                          style={{
                            backgroundImage: `url(${image.url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            const nextIndex = images.findIndex(item => item.id === image.id)
                            if (nextIndex >= 0) {
                              setActiveImageIndex(nextIndex)
                            }
                          }}
                        />
                      ))
                    : Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="listing-gallery__thumb"
                        />
                      ))}
                </div>
              </div>

              <Modal
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                className="modal__content--lightbox"
              >
                <div className="listing-lightbox">
                  {images.length > 1 ? (
                    <button
                      type="button"
                      className="listing-lightbox__nav listing-lightbox__nav--prev"
                      onClick={handlePrevImage}
                      aria-label={t('listing.gallery.prev')}
                    >
                      ‹
                    </button>
                  ) : null}
                  {activeImage?.url ? (
                    <img src={activeImage.url} alt={listing.title} className="listing-lightbox__image" />
                  ) : null}
                  {images.length > 1 ? (
                    <button
                      type="button"
                      className="listing-lightbox__nav listing-lightbox__nav--next"
                      onClick={handleNextImage}
                      aria-label={t('listing.gallery.next')}
                    >
                      ›
                    </button>
                  ) : null}
                </div>
              </Modal>

              <section className="listing-details">
                <header>
                  <h1>{listing.title}</h1>
                  <p className="listing-details__price">{formattedPrice}</p>
                  {publishedFallback ? (
                    <p className="listing-details__published">
                      {t('listings.detail.publishedAt', { date: publishedFallback })}
                    </p>
                  ) : null}
                  
                  <div className="listing-overview__badges">
                    {highlights.map(highlight => (
                      <span key={highlight}>{highlight}</span>
                    ))}
                  </div>
                </header>

                <section className="listing-details__section listing-details__section--key-info">
                  <h2>{t('listings.detail.detailsTitle')}</h2>
                  {detailEntries.length ? (
                    <div className="listing-details__grid">
                      {detailEntries.map(entry => (
                        <div key={entry.label} className="listing-details__item">
                          <span className="listing-details__icon" aria-hidden />
                          <div className="listing-details__meta">
                            <span className="listing-details__label">{entry.label}</span>
                            <strong className="listing-details__value">{entry.value}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>{t('listings.detail.detailsEmpty')}</p>
                  )}
                </section>

                <article className="listing-details__section listing-details__section--description">
                  <h2>{t('listings.detail.descriptionTitle')}</h2>
                  <div
                    className="listing-details__description"
                    dangerouslySetInnerHTML={{ __html: renderedDescription }}
                  />
                </article>

                {handoverModes.length ? (
                  <section className="listing-details__section listing-details__section--handover">
                    <h2>{t('listings.new.handover.title')}</h2>
                    <div className="listing-handover">
                      {hasPickupHandover ? (
                        <article className="listing-handover__mode">
                          <h4>{t('listings.new.handover.pickup')}</h4>
                          <span className="listing-handover__badge">
                            <span aria-hidden className="listing-handover__badge-icon">✦</span>
                            {t('listings.detail.handover.pickupLocation', {
                              location:
                                formatCityZip(locationCity, locationPostalCode) ||
                                locationCity ||
                                locationAddress ||
                                t('listings.detail.locationUnavailable')
                            })}
                          </span>
                          <p>{t('listings.new.handover.pickupHelp')}</p>
                        </article>
                      ) : null}

                      {hasDeliveryHandover ? (
                        <article className="listing-handover__mode">
                          <h4>{t('listings.new.handover.delivery')}</h4>
                          <p className="listing-handover__helper">{t('listings.new.handover.deliveryHelp')}</p>
                        </article>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                <section className="listing-details__section">
                  <h2>{t('listings.detail.locationTitle')}</h2>
                  <div className="listing-location">
                    <div className="listing-location__row">
                      <span className="listing-location__label">
                        {t('listings.detail.locationPublicLabel')}:
                      </span>
                      <strong className="listing-location__value">{publicLocation}</strong>
                    </div>
                    {showExactLocation ? (
                      <div className="listing-location__row">
                        <span className="listing-location__label">
                          {t('listings.detail.locationExactLabel')}:
                        </span>
                        <span className="listing-location__value">{displayLocation}</span>
                      </div>
                    ) : null}
                    {locationHideExact ? (
                      <p className="listing-location__privacy">
                        {t('listings.detail.locationPrivacyHint')}
                      </p>
                    ) : null}
                  </div>
                  {locationHideExact ? (
                    approxCoords ? (
                      <div ref={mapContainerRef} className="listing-details__map" />
                    ) : (
                      <p style={{ color: '#64748b' }}>
                        {t('listings.detail.locationNotProvided')}
                      </p>
                    )
                  ) : latitude !== null && longitude !== null ? (
                    <div ref={mapContainerRef} className="listing-details__map" />
                  ) : (
                    <p style={{ color: '#64748b' }}>
                      {t('listings.detail.locationNotProvided')}
                    </p>
                  )}
                </section>
              </section>

              <section className="listing-details__section">
                <h2>{t('listings.detail.similarTitle')}</h2>
                <div className="lbc-listings lbc-listings--grid lbc-listings--grid-3">
                  {similarListings.length ? (
                    similarListings.map(similar => {
                      const similarCover =
                        similar.images?.find(image => image.isCover) ??
                        similar.images?.[0]

                      return (
                        <Link
                          key={similar.id}
                          to={`/listing/${similar.id}`}
                          className="lbc-mini-card"
                        >
                          <div
                            className="lbc-mini-card__image"
                            style={
                              similarCover?.url
                                ? {
                                    backgroundImage: `url(${similarCover.url})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center'
                                  }
                                : undefined
                            }
                          />
                          <div className="lbc-mini-card__body">
                            <h3>{similar.title}</h3>
                            {similar.publishedAt ? (
                              <p className="lbc-mini-card__date">
                                {formatListingDate(similar.publishedAt)}
                              </p>
                            ) : null}
                            <span>{formatPrice(similar, locale)}</span>
                          </div>
                          <span className="lbc-mini-card__category">
                            {similar.category?.name ?? t('listings.detail.similarCategoryFallback')}
                          </span>
                        </Link>
                      )
                    })
                  ) : (
                    <p style={{ padding: '0.75rem 0', color: '#6c757d' }}>
                      {t('listings.detail.similarEmpty')}
                    </p>
                  )}
                </div>
              </section>

            </div>

            <aside className="listing-overview">
              <div className="listing-agent">
                <div className="listing-agent__meta">
                  <div className="listing-agent__identity">
                    {ownerLink ? (
                      <Link to={ownerLink} className="listing-agent__avatar" />
                    ) : (
                      <div className="listing-agent__avatar" />
                    )}
                    <div className="listing-agent__text">
                      {ownerLink ? (
                        <Link to={ownerLink} className="listing-agent__name">
                          <strong>{ownerName}</strong>
                        </Link>
                      ) : (
                        <strong>{ownerName}</strong>
                      )}
                      <p className="listing-agent__badge">
                        {listing.owner?.isPro
                          ? t('listings.detail.seller.proBadge')
                          : t('listings.detail.seller.individualBadge')}
                      </p>
                      {publishedAt ? (
                        <span className="listing-agent__since">
                          {t('listings.detail.seller.since', { date: publishedAt })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {ownerLink ? (
                    <Link to={ownerLink} className="listing-agent__arrow" aria-label={t('actions.view')}>
                      &gt;
                    </Link>
                  ) : (
                    <span className="listing-agent__arrow" aria-hidden>
                      &gt;
                    </span>
                  )}
                </div>
                <div className="listing-agent__stats">
                  {listing.owner?.isCompanyVerified ? (
                    <span className="listing-agent__stat listing-agent__stat--verified">
                      {t('listings.badge.companyVerified')}
                    </span>
                  ) : null}
                  {deliveryInfo ? (
                    <span className="listing-agent__stat">
                      {deliveryInfo.handoverMode === 'pickup' ? 'Remise:' : 'Livraison:'}{' '}
                      {formatDeliveryLabel(deliveryInfo)}
                    </span>
                  ) : null}
                </div>
                <div className="listing-agent__actions">
                  {canBuy ? (
                    <Button
                      disabled={isBuyerPurchaseInProgress}
                      onClick={handleBuyNow}
                    >
                      {isBuyerPurchaseInProgress ? 'En cours' : 'Acheter'}
                    </Button>
                  ) : null}
                  {canFollowSeller ? (
                    <Button variant={isFollowingSeller ? 'ghost' : 'outline'} onClick={handleFollowSeller}>
                      {isFollowingSeller ? 'Suivi' : 'Suivre'}
                    </Button>
                  ) : null}
                  <Link to={ownerLink ?? '/search'} className="btn btn--outline">
                    {t('listings.detail.seller.viewListings')}
                    {ownerListingCount ? ` (${ownerListingCount})` : ''}
                  </Link>
                  {deliveryInfo && deliveryInfo.escrowStatus === 'pending' ? (
                    <span className="listing-agent__stat">Paiement en attente de confirmation</span>
                  ) : null}
                  {deliveryInfo &&
                  deliveryInfo.buyer?.id === user?.id &&
                  deliveryInfo.escrowStatus === 'held' &&
                  (deliveryInfo.status === 'delivered' || deliveryInfo.handoverMode === 'pickup') ? (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          if (deliveryInfo.sellerPayoutReady === false) {
                            setShowPayoutModal(true)
                            return
                          }
                          await apiPost(`/deliveries/${deliveryInfo.id}/escrow/release`)
                          const fresh = await apiGet<import('../../types/deliveries').Delivery | null>(
                            `/deliveries/listing/${listingId}`
                          )
                          setDeliveryInfo(fresh)
                        } catch (err) {
                          console.error('Unable to release escrow', err)
                          addToast({
                            variant: 'error',
                            title: 'Paiement sécurisé',
                            message: 'Impossible de libérer le paiement.'
                          })
                        }
                      }}
                    >
                      Confirmer la réception
                    </Button>
                  ) : null}
                  <Button onClick={() => setShowContactModal(true)}>
                    {t('listings.detail.actions.contact')}
                  </Button>
                </div>
              </div>

              <p>
                {listing.isFeatured ? t('listings.detail.badges.featured') : null}
                {listing.isBoosted ? ` • ${t('listings.detail.badges.boosted')}` : null}
              </p>
              <div className="listing-overview__badges">
                {listing.tag ? <span>{listing.tag}</span> : null}
              </div>
              <div className="listing-details__section">
                <h3>{t('listings.detail.share.title')}</h3>
                <div className="listing-share">
                  <div className="listing-share__icons">
                    <a
                      className="listing-share__icon listing-share__icon--whatsapp"
                      href={whatsappShareUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="WhatsApp"
                      aria-disabled={!resolvedShareUrl}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M20.52 3.48A11.91 11.91 0 0012.06 0C5.5 0 .2 5.29.2 11.85c0 2.09.55 4.12 1.6 5.93L0 24l6.4-1.68a11.8 11.8 0 005.66 1.44h.01c6.56 0 11.85-5.29 11.86-11.85 0-3.17-1.23-6.15-3.41-8.43zm-8.46 18.2h-.01a9.83 9.83 0 01-5-1.37l-.36-.22-3.8 1 1.02-3.7-.24-.38a9.84 9.84 0 1118.17-5.16c0 5.44-4.42 9.83-9.82 9.83zm5.4-7.3c-.3-.15-1.78-.87-2.05-.98-.27-.1-.47-.15-.67.15-.2.3-.77.98-.95 1.18-.17.2-.34.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.67-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.5.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.67-1.61-.92-2.2-.24-.57-.48-.5-.67-.5h-.57c-.2 0-.52.08-.79.38-.27.3-1.04 1.02-1.04 2.5 0 1.48 1.06 2.9 1.2 3.1.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.61.7.22 1.34.19 1.84.11.56-.08 1.78-.73 2.03-1.44.25-.7.25-1.3.18-1.44-.07-.13-.27-.2-.57-.35z" />
                      </svg>
                    </a>
                    <a
                      className="listing-share__icon listing-share__icon--messenger"
                      href={messengerShareUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Messenger"
                      aria-disabled={!resolvedShareUrl}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M12 0C5.37 0 0 4.98 0 11.12c0 3.5 1.74 6.62 4.46 8.68V24l4.07-2.24c1.1.3 2.26.47 3.47.47 6.63 0 12-4.98 12-11.12S18.63 0 12 0zm1.2 14.9l-3.06-3.27-5.98 3.27 6.57-6.99 3.07 3.27 5.97-3.27-6.57 6.99z" />
                      </svg>
                    </a>
                    <a
                      className="listing-share__icon listing-share__icon--twitter"
                      href={twitterShareUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Twitter"
                      aria-disabled={!resolvedShareUrl}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M23.95 4.57c-.88.39-1.83.65-2.83.77a4.92 4.92 0 002.16-2.72 9.86 9.86 0 01-3.13 1.2 4.92 4.92 0 00-8.38 4.49A13.98 13.98 0 011.64 3.16a4.92 4.92 0 001.52 6.57 4.9 4.9 0 01-2.23-.62v.06a4.93 4.93 0 003.95 4.83 4.94 4.94 0 01-2.22.08 4.93 4.93 0 004.6 3.42A9.86 9.86 0 010 19.54a13.93 13.93 0 007.55 2.21c9.06 0 14.01-7.5 14.01-14v-.64c.96-.69 1.8-1.56 2.46-2.54z" />
                      </svg>
                    </a>
                    <a
                      className="listing-share__icon listing-share__icon--email"
                      href={emailShareUrl}
                      aria-label="Email"
                      aria-disabled={!resolvedShareUrl}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                      </svg>
                    </a>
                  </div>
                  <div className="listing-share__actions">
                    <Button variant="outline" onClick={handleCopyShortLink} disabled={!resolvedShareUrl}>
                      {t('listings.detail.share.copy')}
                    </Button>
                    <Button variant="ghost" onClick={handleGenerateShortLink} disabled={isShortLoading}>
                      {isShortLoading ? t('listings.detail.share.generating') : t('listings.detail.share.generate')}
                    </Button>
                  </div>
                  {shortUrl ? (
                    <code className="listing-share__link">{shortUrl}</code>
                  ) : null}
                  {copyHint ? <span className="listing-share__hint">{copyHint}</span> : null}
                </div>
              </div>

              <div className="listing-details__section">
                <h3>{t('listings.detail.tips.title')}</h3>
                <p>
                  {t('listings.detail.tips.body')}
                </p>
                <Link to="/faq" className="lbc-link">
                  {t('listings.detail.tips.cta')}
                </Link>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowReportModal(true)}
                style={{ marginTop: '8px' }}
              >
                {t('listings.detail.actions.report')}
              </Button>
            </aside>

            {canBuy || !isSeller ? (
              <div className="listing-mobile-actions">
                {canBuy ? (
                  <Button
                    className="listing-mobile-actions__buy"
                    disabled={isBuyerPurchaseInProgress}
                    onClick={handleBuyNow}
                  >
                    {isBuyerPurchaseInProgress ? 'En cours' : 'Acheter'}
                  </Button>
                ) : null}
                {!isSeller ? (
                  <Button
                    variant={canBuy ? 'outline' : 'primary'}
                    className="listing-mobile-actions__contact"
                    onClick={() => setShowContactModal(true)}
                  >
                    {t('listings.detail.actions.contact')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <Modal
        open={showReportModal}
        title={t('listings.detail.report.modal.title')}
        description={t('listings.detail.report.modal.description')}
        onClose={() => {
          if (!isReporting) {
            setShowReportModal(false)
          }
        }}
        footer={null}
      >
        <form onSubmit={handleSubmitReport} className="listing-report-form">
          <label className="form-field">
            <span className="form-field__label">{t('listings.detail.report.form.reason')}</span>
            <input
              className="input"
              value={reportReason}
              onChange={event => setReportReason(event.target.value)}
              required
              maxLength={200}
              placeholder={t('listings.detail.report.form.reasonPlaceholder')}
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('listings.detail.report.form.details')}</span>
            <textarea
              className="input"
              rows={4}
              value={reportDetails}
              onChange={event => setReportDetails(event.target.value)}
              placeholder={t('listings.detail.report.form.detailsPlaceholder')}
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('listings.detail.report.form.email')}</span>
            <input
              className="input"
              type="email"
              value={reportEmail}
              onChange={event => setReportEmail(event.target.value)}
              placeholder={t('listings.detail.report.form.emailPlaceholder')}
            />
          </label>
          <div className="auth-form__actions" style={{ justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!isReporting) {
                  setShowReportModal(false)
                }
              }}
            >
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isReporting || !reportReason.trim()}>
              {isReporting ? t('actions.sending') : t('actions.send')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showPayoutModal}
        title="Payout requis"
        description="Le vendeur doit renseigner son Mobile Money pour recevoir le paiement."
        onClose={() => setShowPayoutModal(false)}
        footer={
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', width: '100%' }}>
            <Button type="button" variant="outline" onClick={() => setShowPayoutModal(false)}>
              Fermer
            </Button>
          </div>
        }
      />


      <Modal
        open={showContactModal}
        title={t('listings.detail.contact.modalTitle', { name: ownerName })}
        description={t('listings.detail.contact.modalDescription', { title: listing?.title ?? '' })}
        onClose={() => setShowContactModal(false)}
        footer={
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowContactModal(false)}
              disabled={isSending}
            >
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleStartConversation} disabled={isSending}>
              {isSending ? t('actions.sending') : t('listings.detail.contact.send')}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleStartConversation}>
          <textarea
            className="input"
            rows={5}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder={t('listings.detail.contact.placeholder')}
          />
        </form>
      </Modal>
    </MainLayout>
  )
}
