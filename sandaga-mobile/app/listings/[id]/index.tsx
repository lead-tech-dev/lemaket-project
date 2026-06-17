import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ListingCard } from '@/components/ui/ListingCard'
import { useSession } from '@/core/auth/session-context'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import { getListingImageSource, resolveMediaUrl } from '@/core/utils/listing-image'
import { geoApi, type GeoAutocompleteItem } from '@/features/geo/geo.api'
import { deliveriesApi } from '@/features/deliveries/deliveries.api'
import { getListingHandoverModes } from '@/features/listings/handover'
import { listingsApi, type ListingItem } from '@/features/listings/listings.api'
import { messagesApi } from '@/features/messages/messages.api'
import { paymentsApi } from '@/features/payments/payments.api'
import { usersApi } from '@/features/users/users.api'

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() ?? ''
const MAPBOX_STYLE_ID = 'mapbox/streets-v12'
const DEFAULT_MAPBOX_CENTER = { lng: 11.5021, lat: 4.0511 }
const STREET_SEGMENT_PATTERN =
  /\b(rue|avenue|av\.?|boulevard|bd\.?|street|st\.?|road|rd\.?|route|impasse|allee|all[eé]e|lotissement)\b/i
const COUNTRY_SEGMENT_PATTERN = /^(cameroon|cameroun)$/i
const RESERVED_DETAIL_KEYS = new Set([
  'subject',
  'body',
  'pricecents',
  'pricereco',
  'donation',
  'phone',
  'phonehiddeninformationtext',
  'latitude',
  'longitude',
  'address',
  'email',
  'category',
  'categoryid',
  'contactemail',
  'owneremail',
  'handover_modes',
  'handover_mode',
  'handovermodes',
  'handovermode',
  'adtype',
  'contact',
  'location',
  'images',
  'price',
  'currency',
  'lat',
  'lng'
])
const DEFAULT_CONTACT_MESSAGE = 'Bonjour, cette annonce est-elle toujours disponible ?'

function formatPrice(price: string, currency = 'XAF') {
  const value = Number(price)
  if (!Number.isFinite(value)) {
    return [price, currency].filter(Boolean).join(' ')
  }
  return new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value)
}

function formatDate(value?: string | null) {
  if (!value) return null
  try {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return value
  }
}

function normalizeLocationToken(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitLocationParts(value: string) {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

function dedupeLocationParts(parts: string[]) {
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

function looksLikeStreetSegment(value: string) {
  return /\d/.test(value) || STREET_SEGMENT_PATTERN.test(value)
}

function formatCityZip(city?: string | null, zipcode?: string | null) {
  const cleanCity = city?.trim() ?? ''
  const cleanZip = zipcode?.trim() ?? ''
  return [cleanCity, cleanZip].filter(Boolean).join(' ')
}

function buildExactLocationLabel(item: ListingItem) {
  const city = item.location?.city?.trim() ?? ''
  const zipcode = item.location?.zipcode?.trim() ?? ''
  const cityZip = formatCityZip(city, zipcode)
  const rawLabel = item.location?.address?.trim() ?? ''
  const parts = dedupeLocationParts(splitLocationParts(rawLabel)).filter(
    part => !COUNTRY_SEGMENT_PATTERN.test(part.trim())
  )
  const broadParts = parts.filter(part => !looksLikeStreetSegment(part))
  const tokens = broadParts.length ? broadParts : parts

  if (city && tokens.length) {
    const normalizedCity = normalizeLocationToken(city)
    const cityIndex = tokens.findIndex(part => normalizeLocationToken(part) === normalizedCity)
    if (cityIndex > 0) {
      return `${tokens[cityIndex - 1]}, ${tokens[cityIndex]}`
    }
    if (cityIndex === 0) {
      return tokens[1] ? `${tokens[0]}, ${tokens[1]}` : tokens[0]
    }
  }

  if (tokens.length >= 2) return `${tokens[0]}, ${tokens[1]}`
  if (tokens[0]) return tokens[0]
  return cityZip || city || ''
}

function buildPublicLocationLabel(item: ListingItem) {
  const city = item.location?.city?.trim() ?? ''
  const zipcode = item.location?.zipcode?.trim() ?? ''
  const cityZip = formatCityZip(city, zipcode)
  const rawLabel = item.location?.address?.trim() ?? ''
  const parts = splitLocationParts(rawLabel)

  if (city) {
    const normalizedCity = normalizeLocationToken(city)
    const cityIndex = parts.findIndex(part => {
      const normalized = normalizeLocationToken(part)
      return (
        normalized === normalizedCity ||
        normalized.includes(normalizedCity) ||
        normalizedCity.includes(normalized)
      )
    })

    if (cityIndex > 0) {
      const previous = parts[cityIndex - 1]
      if (previous && !looksLikeStreetSegment(previous) && normalizeLocationToken(previous) !== normalizedCity) {
        return `${previous}, ${parts[cityIndex]}`
      }
    }

    if (cityIndex >= 0) {
      return parts[cityIndex] ?? cityZip
    }
  }

  if (parts.length >= 2 && !looksLikeStreetSegment(parts[0] ?? '')) {
    return `${parts[0]}, ${parts[1]}`
  }

  return cityZip || city || parts[0] || 'Localisation non renseignée'
}

function getMapboxZoom() {
  return 13
}

function getCheckoutMapZoom(distanceKm?: number | null) {
  if (!distanceKm || distanceKm <= 0) return 11
  if (distanceKm <= 3) return 13
  if (distanceKm <= 8) return 12
  if (distanceKm <= 20) return 11
  return 10
}

function buildMapboxStaticUrl(item: ListingItem) {
  if (!MAPBOX_TOKEN) return null

  const lat = item.location?.lat
  const lng = item.location?.lng
  const center =
    typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : DEFAULT_MAPBOX_CENTER
  const marker =
    typeof lat === 'number' && typeof lng === 'number' ? `pin-s+0f60c4(${lng},${lat})/` : ''

  return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE_ID}/static/${marker}${center.lng},${center.lat},${getMapboxZoom()},0/1200x720?access_token=${MAPBOX_TOKEN}`
}

function buildCheckoutMapStaticUrl(
  pickup: { lat: number; lng: number } | null,
  dropoff: { lat: number; lng: number } | null,
  distanceKm?: number | null
) {
  if (!MAPBOX_TOKEN) return null

  const center =
    pickup && dropoff
      ? { lat: (pickup.lat + dropoff.lat) / 2, lng: (pickup.lng + dropoff.lng) / 2 }
      : pickup ?? dropoff ?? DEFAULT_MAPBOX_CENTER

  const markers = [
    pickup ? `pin-s-warehouse+0f60c4(${pickup.lng},${pickup.lat})` : null,
    dropoff ? `pin-s-home+f97316(${dropoff.lng},${dropoff.lat})` : null
  ]
    .filter(Boolean)
    .join(',')

  const markerSegment = markers ? `${markers}/` : ''
  return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE_ID}/static/${markerSegment}${center.lng},${center.lat},${getCheckoutMapZoom(distanceKm)},0/1200x680?access_token=${MAPBOX_TOKEN}`
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function buildPrettyGeoLabel(item: GeoAutocompleteItem) {
  const city = item.city?.trim() || item.context?.split(',')[0]?.trim() || ''
  const primary = item.label.split(',')[0]?.trim() || item.label
  return city && !primary.toLowerCase().includes(city.toLowerCase()) ? `${primary}, ${city}` : primary
}

function buildGeoSuggestionKey(item: GeoAutocompleteItem) {
  return [
    item.kind,
    item.id,
    item.cityId ?? '',
    item.neighborhoodId ?? '',
    item.label.trim().toLowerCase()
  ].join(':')
}

function normalizeRichText(value?: string | null) {
  if (!value) return 'Aucune description fournie.'
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function humanizeKey(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, match => match.toUpperCase())
}

function formatDetailLabel(key: string) {
  const normalized = key.toLowerCase()
  const labelMap: Record<string, string> = {
    regdate: 'Année modèle',
    issuance_date: 'Mise en circulation',
    spare_parts_availability: 'Disponibilité des pièces',
    handover_modes: 'Modes de remise',
    handover_mode: 'Modes de remise'
  }

  return labelMap[normalized] ?? humanizeKey(key)
}

function formatDetailValue(key: string, value: unknown): string {
  const normalized = key.toLowerCase()
  const values = Array.isArray(value) ? value : [value]

  if (normalized === 'handover_modes' || normalized === 'handover_mode') {
    return values
      .map(entry => {
        const token = String(entry ?? '').trim().toLowerCase()
        if (!token) return ''
        if (token === 'pickup') return 'Remise en main propre'
        if (token === 'delivery') return 'Livraison'
        return String(entry)
      })
      .filter(Boolean)
      .join(', ')
  }

  if (Array.isArray(value)) {
    return value
      .map(entry => (entry === null || entry === undefined ? '' : String(entry)))
      .filter(Boolean)
      .join(', ')
  }

  if (value && typeof value === 'object') {
    return ''
  }

  return value === null || value === undefined ? '' : String(value)
}

function buildDetailEntries(item: ListingItem) {
  const entries: { label: string; value: string }[] = []

  const pushEntry = (label: string, value: unknown, key?: string) => {
    if (value === null || value === undefined || value === '') return
    const stringValue = formatDetailValue(key ?? '', value).trim()
    if (!stringValue) return
    if (entries.some(entry => entry.label.toLowerCase() === label.toLowerCase())) return
    entries.push({ label, value: stringValue })
  }

  pushEntry('Surface', item.surface)
  pushEntry('Pièces', item.rooms)
  pushEntry('Type', item.tag)

  const details = item.attributes ?? item.details ?? {}
  for (const [key, value] of Object.entries(details)) {
    const normalizedKey = key.replace(/[_\s-]/g, '').toLowerCase()
    if (RESERVED_DETAIL_KEYS.has(normalizedKey)) continue
    if (value && typeof value === 'object' && !Array.isArray(value)) continue
    pushEntry(formatDetailLabel(key), value, key)
  }

  const fallbackDetails = item.attributes ? item.details : undefined
  if (fallbackDetails) {
    for (const [key, value] of Object.entries(fallbackDetails)) {
      const normalizedKey = key.replace(/[_\s-]/g, '').toLowerCase()
      if (RESERVED_DETAIL_KEYS.has(normalizedKey)) continue
      if (value && typeof value === 'object' && !Array.isArray(value)) continue
      pushEntry(formatDetailLabel(key), value, key)
    }
  }

  return entries
}

function buildHighlights(item: ListingItem) {
  if (item.highlights?.length) return item.highlights.slice(0, 4)

  const values = [item.surface, item.rooms ? `${item.rooms} pièce${item.rooms > 1 ? 's' : ''}` : null, item.tag]
    .filter(Boolean)
    .map(String)

  return values.slice(0, 4)
}

function sellerDisplayName(item: ListingItem) {
  return [item.owner?.firstName, item.owner?.lastName].filter(Boolean).join(' ') || 'Vendeur'
}

function normalizeCameroonMobileNumber(rawValue: string) {
  return rawValue.replace(/[\s().-]/g, '')
}

function isValidCameroonMobileNumber(value?: string | null) {
  if (!value) return false
  const normalized = normalizeCameroonMobileNumber(value)
  return /^(\+237|237)?6\d{8}$/.test(normalized)
}

function toCameroonE164(value?: string | null): string | null {
  if (!value) return null
  const normalized = normalizeCameroonMobileNumber(value)

  if (/^00\d+$/.test(normalized)) {
    const trimmed = normalized.replace(/^00+/, '')
    if (/^2376\d{8}$/.test(trimmed)) {
      return `+${trimmed}`
    }
  }

  if (/^\+2376\d{8}$/.test(normalized)) {
    return normalized
  }
  if (/^2376\d{8}$/.test(normalized)) {
    return `+${normalized}`
  }
  if (/^6\d{8}$/.test(normalized)) {
    return `+237${normalized}`
  }
  return null
}

function resolveListingContactPhone(item?: ListingItem | null): string | null {
  if (!item || item.contact?.phoneHidden) {
    return null
  }

  const rawCandidates: (string | null | undefined)[] = [
    item.contact?.phone,
    (item.details?.phone as string | undefined) ?? null,
    (item.meta?.phone as string | undefined) ?? null
  ]

  for (const candidate of rawCandidates) {
    const normalized = toCameroonE164(candidate)
    if (normalized) {
      return normalized
    }
  }

  return null
}

function buildDefaultContactMessage(item?: ListingItem | null): string {
  const title = item?.title?.trim()
  if (!title) {
    return DEFAULT_CONTACT_MESSAGE
  }
  return `Bonjour, votre annonce "${title}" est-elle toujours disponible ?`
}

export default function ListingDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { isAuthenticated, user } = useSession()
  const { id } = useLocalSearchParams<{ id: string | string[] }>()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [handoverMode, setHandoverMode] = useState<'delivery' | 'pickup'>('delivery')
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'card' | 'wallet'>('mobile_money')
  const [paymentOperator, setPaymentOperator] = useState<'mtn' | 'orange'>('mtn')
  const [paymentPhone, setPaymentPhone] = useState('')
  const [contactComposerOpen, setContactComposerOpen] = useState(false)
  const [contactDraft, setContactDraft] = useState(DEFAULT_CONTACT_MESSAGE)
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [dropoffNotes, setDropoffNotes] = useState('')
  const [dropoffCoordinates, setDropoffCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [deliveryBudget, setDeliveryBudget] = useState('')

  const listingId = Array.isArray(id) ? id[0] : id

  const listingQuery = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => {
      if (!listingId) throw new Error("L'identifiant de l'annonce est manquant")
      return listingsApi.getById(listingId)
    },
    enabled: Boolean(listingId)
  })

  const similarQuery = useQuery({
    queryKey: ['listing', listingId, 'similar'],
    queryFn: () => listingsApi.similar(listingId!, 4),
    enabled: Boolean(listingId)
  })

  const sellerProfileQuery = useQuery({
    queryKey: ['users', 'public', listingQuery.data?.owner?.id],
    queryFn: () => usersApi.publicProfile(listingQuery.data!.owner!.id!),
    enabled: Boolean(listingQuery.data?.owner?.id)
  })

  const existingDeliveryQuery = useQuery({
    queryKey: ['deliveries', 'listing', listingQuery.data?.id],
    queryFn: () => deliveriesApi.getForListing(listingQuery.data!.id),
    enabled: Boolean(isAuthenticated && listingQuery.data?.id && listingQuery.data?.owner?.id && user?.id !== listingQuery.data?.owner?.id)
  })

  const walletSummaryQuery = useQuery({
    queryKey: ['payments', 'wallet', 'listing-checkout'],
    queryFn: () => paymentsApi.walletSummary(),
    enabled: checkoutOpen && paymentMethod === 'wallet' && isAuthenticated
  })
  const addressesQuery = useQuery({
    queryKey: ['users', 'addresses', 'listing-checkout'],
    queryFn: () => usersApi.addresses(),
    enabled: checkoutOpen && handoverMode === 'delivery' && isAuthenticated
  })

  const checkoutLocationSuggestionsQuery = useQuery({
    queryKey: ['geo', 'checkout-dropoff', dropoffAddress.trim()],
    queryFn: async () => {
      const q = dropoffAddress.trim()
      if (q.length < 2) {
        return []
      }

      const [autocompleteResult, citiesResult, neighborhoodsResult] = await Promise.allSettled([
        geoApi.autocomplete(q, 8),
        geoApi.searchCities(q, 6),
        geoApi.searchNeighborhoods(q, 6)
      ])

      const autocomplete = autocompleteResult.status === 'fulfilled' ? autocompleteResult.value : []
      const cities = citiesResult.status === 'fulfilled' ? citiesResult.value : []
      const neighborhoods = neighborhoodsResult.status === 'fulfilled' ? neighborhoodsResult.value : []

      const seen = new Set<string>()
      return [...autocomplete, ...neighborhoods, ...cities].filter(item => {
        const key = buildGeoSuggestionKey(item)
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
    },
    enabled: checkoutOpen && handoverMode === 'delivery' && dropoffAddress.trim().length >= 2
  })

  const contactMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!listingId) throw new Error("L'identifiant de l'annonce est manquant")
      return messagesApi.startConversation(listingId, content)
    },
    onSuccess: conversation => {
      setContactComposerOpen(false)
      router.push({ pathname: '/messages/[id]', params: { id: conversation.id } })
    },
    onError: error => {
      Alert.alert('Contact impossible', error instanceof Error ? error.message : 'Réessaie dans un instant.')
    }
  })

  const escrowMutation = useMutation({
    mutationFn: async () => {
      if (!listing) throw new Error("L'annonce est introuvable")
      return deliveriesApi.initEscrow({
        listingId: listing.id,
        handoverMode,
        dropoffAddress: handoverMode === 'delivery' ? dropoffAddress.trim() : undefined,
        dropoffNotes: handoverMode === 'delivery' ? dropoffNotes.trim() || undefined : undefined,
        dropoffLat: handoverMode === 'delivery' ? dropoffCoordinates?.lat : undefined,
        dropoffLng: handoverMode === 'delivery' ? dropoffCoordinates?.lng : undefined,
        price: handoverMode === 'delivery' && deliveryBudget.trim() ? Number(deliveryBudget) : undefined,
        currency: listing.currency || 'XAF',
        paymentMethod,
        paymentOperator: paymentMethod === 'mobile_money' ? paymentOperator : undefined,
        paymentPhone: paymentMethod === 'mobile_money' ? paymentPhone.trim() : undefined
      })
    },
    onSuccess: async result => {
      setCheckoutOpen(false)
      try {
        const delivery = await deliveriesApi.getForListing(listingId!)
        if (delivery?.id) {
          router.push({ pathname: '/dashboard/deliveries/[id]', params: { id: delivery.id } })
        }
      } catch {
        // ignore follow-up lookup errors
      }

      if (result.paymentUrl) {
        try {
          await Linking.openURL(result.paymentUrl)
        } catch {
          Alert.alert('Paiement sécurisé', `Ouvre ce lien pour finaliser le paiement: ${result.paymentUrl}`)
        }
        return
      }

      Alert.alert('Paiement sécurisé', 'Le paiement a été lancé avec succès.')
    },
    onError: error => {
      Alert.alert('Paiement sécurisé', error instanceof Error ? error.message : 'Impossible de lancer le paiement sécurisé.')
    }
  })

  const listing = listingQuery.data
  const similarListings = (similarQuery.data ?? []).filter(item => item.id !== listing?.id).slice(0, 4)
  const heroImageSource = getListingImageSource(listing)
  const sellerAvatarUrl = resolveMediaUrl(listing?.owner?.avatarUrl)
  const mapUrl = listing ? buildMapboxStaticUrl(listing) : null
  const handoverModes = useMemo(() => (listing ? getListingHandoverModes(listing) : []), [listing])
  const detailEntries = listing ? buildDetailEntries(listing) : []
  const highlights = listing ? buildHighlights(listing) : []
  const publicLocation = listing ? buildPublicLocationLabel(listing) : ''
  const exactLocation = listing ? buildExactLocationLabel(listing) : ''
  const sellerName = listing ? sellerDisplayName(listing) : ''
  const sellerProfile = sellerProfileQuery.data
  const sellerListingCount = sellerProfile?.listingCount ?? listing?.owner?.listingCount ?? 0
  const savedAddresses = addressesQuery.data ?? []
  const savedShippingAddresses = savedAddresses.filter(address => address.isDefaultShipping || address.city || address.line1)
  const defaultShippingAddress = savedShippingAddresses.find(address => address.isDefaultShipping) ?? savedShippingAddresses[0] ?? null
  const similarCardWidth = Math.max((width - spacing.lg * 4 - spacing.sm * 3) / 2, 136)
  const description = normalizeRichText(listing?.description)
  const isOwner = Boolean(user?.id && listing?.owner?.id && user.id === listing.owner.id)
  const sellerWhatsappPhone = resolveListingContactPhone(listing)
  const existingDelivery = existingDeliveryQuery.data
  const walletSummary = walletSummaryQuery.data
  const checkoutPickupCoordinates =
    typeof listing?.location?.lat === 'number' && typeof listing?.location?.lng === 'number'
      ? { lat: listing.location.lat, lng: listing.location.lng }
      : null
  const checkoutDistanceKm =
    checkoutPickupCoordinates && dropoffCoordinates ? haversineKm(checkoutPickupCoordinates, dropoffCoordinates) : null
  const checkoutRouteMapUrl = buildCheckoutMapStaticUrl(checkoutPickupCoordinates, dropoffCoordinates, checkoutDistanceKm)
  const checkoutLocationSuggestions = checkoutLocationSuggestionsQuery.data ?? []
  const checkoutLocationResolved =
    handoverMode === 'delivery' && Boolean(dropoffCoordinates && dropoffAddress.trim())
  const totalEstimate =
    Number(listing?.price ?? 0) + (handoverMode === 'delivery' ? Number(deliveryBudget || 0) : 0)
  const mobileMoneyValid = paymentMethod !== 'mobile_money' || isValidCameroonMobileNumber(paymentPhone.trim())
  const mobileMoneyInvalid =
    paymentMethod === 'mobile_money' && paymentPhone.trim().length > 0 && !mobileMoneyValid
  const walletCurrencyMismatch =
    paymentMethod === 'wallet' &&
    Boolean(walletSummary) &&
    walletSummary.currency !== (listing?.currency || 'XAF')
  const walletInsufficient =
    paymentMethod === 'wallet' &&
    Boolean(walletSummary) &&
    !walletCurrencyMismatch &&
    walletSummary.balance < totalEstimate
  const walletUnavailable = paymentMethod === 'wallet' && walletSummaryQuery.isError
  const canSubmitCheckout =
    Boolean(listing) &&
    (handoverMode === 'pickup' || Boolean(dropoffAddress.trim() && dropoffCoordinates)) &&
    (paymentMethod !== 'mobile_money' || Boolean(paymentOperator)) &&
    mobileMoneyValid &&
      (paymentMethod !== 'wallet' ||
      (walletSummary ? walletSummary.currency === (listing?.currency || 'XAF') && walletSummary.balance >= totalEstimate : false))
  const canSendContactMessage = contactDraft.trim().length > 0 && !contactMutation.isPending

  useEffect(() => {
    if (handoverModes.length) {
      setHandoverMode(prev => (handoverModes.includes(prev) ? prev : handoverModes[0]))
    }
  }, [handoverModes])

  useEffect(() => {
    if (handoverMode !== 'delivery') {
      setDropoffCoordinates(null)
    }
  }, [handoverMode])

  useEffect(() => {
    if (!checkoutOpen || handoverMode !== 'delivery' || dropoffAddress.trim() || !defaultShippingAddress) {
      return
    }

    const prefilled = [defaultShippingAddress.line1, defaultShippingAddress.city].filter(Boolean).join(', ')
    setDropoffAddress(prefilled)
    setDropoffNotes(
      [defaultShippingAddress.line2, defaultShippingAddress.state, defaultShippingAddress.postalCode]
        .filter(Boolean)
        .join(' • ')
    )
  }, [checkoutOpen, defaultShippingAddress, dropoffAddress, handoverMode])

  const handleShare = async () => {
    if (!listing) return
    try {
      await Share.share({
        message: `${listing.title}\n${formatPrice(listing.price, listing.currency || 'XAF')}\n${publicLocation}`
      })
    } catch {
      // ignore share cancellation
    }
  }

  const handleReport = () => {
    Alert.alert(
      'Signaler cette annonce',
      'Merci. Le signalement complet sera branché au même niveau que le web, mais tu peux déjà nous remonter cette annonce via le support.'
    )
  }

  const handleOpenPublicProfile = () => {
    if (!listing?.owner?.id) {
      return
    }

    router.push({
      pathname: '/profile/public',
      params: { userId: listing.owner.id }
    })
  }

  const handleContactSeller = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login')
      return
    }
    setContactDraft(buildDefaultContactMessage(listing))
    setContactComposerOpen(true)
  }

  const handleSendContactMessage = () => {
    const content = contactDraft.trim()
    if (!content) {
      Alert.alert('Message requis', 'Saisis un message avant envoi.')
      return
    }
    contactMutation.mutate(content)
  }

  const handleContactSellerOnWhatsApp = async () => {
    if (!listing || !sellerWhatsappPhone) {
      Alert.alert('WhatsApp', 'Le numéro WhatsApp du vendeur est indisponible.')
      return
    }

    const phoneDigits = sellerWhatsappPhone.replace('+', '')
    const text = encodeURIComponent(`Bonjour, votre annonce "${listing.title}" est-elle toujours disponible ?`)
    const nativeUrl = `whatsapp://send?phone=${phoneDigits}&text=${text}`
    const webUrl = `https://wa.me/${phoneDigits}?text=${text}`

    try {
      const canOpenNative = await Linking.canOpenURL(nativeUrl)
      if (canOpenNative) {
        await Linking.openURL(nativeUrl)
        return
      }
      await Linking.openURL(webUrl)
    } catch {
      Alert.alert('WhatsApp', "Impossible d'ouvrir WhatsApp pour le moment.")
    }
  }

  const handleSecureCheckout = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login')
      return
    }
    if (existingDelivery?.id) {
      router.push({ pathname: '/dashboard/deliveries/[id]', params: { id: existingDelivery.id } })
      return
    }
    setCheckoutOpen(true)
  }

  const handleOwnerPrimaryAction = () => {
    if (!listing) return

    if (!isAuthenticated) {
      router.push('/(auth)/login')
      return
    }

    router.push({
      pathname: '/dashboard/promotions',
      params: {
        listingId: listing.id,
        category: listing.category?.slug ?? ''
      }
    })
  }

  if (!listingId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Annonce introuvable.</Text>
      </View>
    )
  }

  if (listingQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    )
  }

  if (listingQuery.isError || !listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Impossible de charger cette annonce.</Text>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Détail de l’annonce
        </Text>
        <Pressable style={styles.headerButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 108 + Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.heroCard}>
          <View style={styles.media}>
            <Image source={heroImageSource} style={styles.heroImage} resizeMode="cover" />

            <View style={styles.heroBadges}>
              {listing.isPremium ? <Text style={[styles.heroBadge, styles.heroBadgeFeatured]}>Premium</Text> : null}
              {listing.isFeatured ? <Text style={[styles.heroBadge, styles.heroBadgeFeatured]}>À la une</Text> : null}
              {listing.isBoosted ? <Text style={[styles.heroBadge, styles.heroBadgeBoosted]}>Boostée</Text> : null}
            </View>
          </View>

          <View style={styles.heroBody}>
            <Text style={styles.price}>{formatPrice(listing.price, listing.currency || 'XAF')}</Text>
            <Text style={styles.title}>{listing.title}</Text>

            {highlights.length ? (
              <View style={styles.highlightsRow}>
                {highlights.map(highlight => (
                  <View key={highlight} style={styles.highlightChip}>
                    <Text style={styles.highlightText}>{highlight}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.metaRow}>
              {listing.category?.name ? (
                <View style={styles.metaPill}>
                  <Ionicons name="grid-outline" size={13} color={colors.accent} />
                  <Text style={styles.metaPillText}>{listing.category.name}</Text>
                </View>
              ) : null}
              {publicLocation ? (
                <View style={styles.metaPill}>
                  <Ionicons name="location-outline" size={13} color={colors.accent} />
                  <Text style={styles.metaPillText}>{publicLocation}</Text>
                </View>
              ) : null}
            </View>

            {formatDate(listing.publishedAt || listing.created_at) ? (
              <Text style={styles.publishText}>Publiée le {formatDate(listing.publishedAt || listing.created_at)}</Text>
            ) : null}
          </View>
        </View>

        <Pressable style={styles.sectionCard} onPress={handleOpenPublicProfile}>
          <View style={styles.sellerCompactRow}>
            <View style={styles.sellerIdentity}>
              <View style={styles.avatar}>
                {sellerAvatarUrl ? (
                  <Image source={{ uri: sellerAvatarUrl }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <Ionicons name="person-outline" size={22} color={colors.text} />
                )}
              </View>
              <View style={styles.sellerMetaCompact}>
                <Text style={styles.sellerNameText} numberOfLines={1}>
                  {sellerName}
                </Text>
                <Text style={styles.sellerListingText} numberOfLines={1}>
                  {sellerListingCount} annonce{sellerListingCount > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </View>
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Les informations clés</Text>
          <View style={styles.detailsGrid}>
            {detailEntries.length ? (
              detailEntries.map(entry => (
                <View key={`${entry.label}-${entry.value}`} style={styles.detailItem}>
                  <Text style={styles.detailLabel}>{entry.label}</Text>
                  <Text style={styles.detailValue}>{entry.value}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptySectionText}>Aucune information complémentaire disponible.</Text>
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.sectionParagraph}>{description}</Text>
        </View>

        {handoverModes.length ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Modes de remise</Text>
            <View style={styles.deliveryStack}>
              {handoverModes.includes('pickup') ? (
                <View style={styles.deliveryItem}>
                  <View style={styles.deliveryHeadingRow}>
                    <Ionicons name="navigate-circle-outline" size={18} color={colors.accent} />
                    <Text style={styles.deliveryTitle}>Remise en main propre</Text>
                  </View>
                  <Text style={styles.deliveryBadge}>{publicLocation || 'Zone publique'}</Text>
                  <Text style={styles.deliveryTextBlock}>
                    Rencontrez le vendeur pour vérifier l’article avant validation de l’échange.
                  </Text>
                </View>
              ) : null}

              {handoverModes.includes('delivery') ? (
                <View style={styles.deliveryItem}>
                  <View style={styles.deliveryHeadingRow}>
                    <Ionicons name="cube-outline" size={18} color={colors.primary} />
                    <Text style={styles.deliveryTitle}>Livraison</Text>
                  </View>
                  <Text style={styles.deliveryBadge}>Livraison possible</Text>
                  <Text style={styles.deliveryTextBlock}>
                    Cette annonce accepte une remise par livraison selon les modalités convenues avec le vendeur.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Localisation</Text>
          <View style={styles.locationInfo}>
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>Zone publique</Text>
              <Text style={styles.locationValue}>{publicLocation || 'Non renseignée'}</Text>
            </View>

            {!listing.location?.hideExact && exactLocation && exactLocation !== publicLocation ? (
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Adresse exacte</Text>
                <Text style={styles.locationValue}>{exactLocation}</Text>
              </View>
            ) : null}

            {listing.location?.hideExact ? (
              <Text style={styles.locationPrivacy}>L’adresse précise est masquée pour protéger le vendeur.</Text>
            ) : null}
          </View>

          {mapUrl ? (
            <Image source={{ uri: mapUrl }} style={styles.mapPreview} resizeMode="cover" />
          ) : (
            <View style={styles.mapFallback}>
              <Ionicons name="map-outline" size={22} color={colors.muted} />
              <Text style={styles.mapFallbackTitle}>Carte indisponible</Text>
              <Text style={styles.mapFallbackText}>
                Ajoute `EXPO_PUBLIC_MAPBOX_TOKEN` dans le `.env` mobile pour afficher la carte Mapbox.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Annonces similaires</Text>
            {similarQuery.isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>

          {similarListings.length ? (
            <View style={styles.grid}>
              {similarListings.map(item => (
                <ListingCard
                  key={item.id}
                  item={item}
                  style={{ width: similarCardWidth }}
                  onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.id } })}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptySectionText}>Aucune annonce similaire disponible pour le moment.</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Partager cette annonce</Text>
          <Text style={styles.sectionParagraph}>
            Partage cette annonce avec quelqu’un qui pourrait être intéressé.
          </Text>
          <Pressable style={styles.inlineAction} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={16} color={colors.accent} />
            <Text style={styles.inlineActionText}>Partager maintenant</Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Conseils de sécurité</Text>
          <View style={styles.tipsList}>
            <View style={styles.tipRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
              <Text style={styles.tipText}>Privilégie un échange dans un lieu public et fréquenté.</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="cash-outline" size={16} color={colors.success} />
              <Text style={styles.tipText}>Vérifie l’article avant de confirmer le paiement.</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.success} />
              <Text style={styles.tipText}>Reste dans la messagerie LEMAKET pour garder une trace.</Text>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, styles.reportCard]}>
          <Text style={styles.sectionTitle}>Signaler cette annonce</Text>
          <Text style={styles.sectionParagraph}>
            Signale le contenu si tu remarques une fraude, un doublon ou une annonce non conforme.
          </Text>
          <Pressable style={styles.inlineAction} onPress={handleReport}>
            <Ionicons name="flag-outline" size={16} color={colors.danger} />
            <Text style={[styles.inlineActionText, styles.reportText]}>Signaler</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {isOwner ? (
          <View style={styles.ownerFooterRow}>
            <Pressable
              style={styles.ownerSecondaryButton}
              onPress={() => router.push({ pathname: '/listings/[id]/edit', params: { id: listing.id } })}
            >
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={styles.ownerSecondaryButtonText}>Modifier</Text>
            </Pressable>
            <Pressable style={styles.contactButton} onPress={handleOwnerPrimaryAction}>
              <Ionicons name="flash-outline" size={18} color={colors.white} />
              <Text style={styles.contactButtonText}>Booster l’annonce</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.ownerFooterRow}>
            {existingDelivery?.id ? (
              <Pressable style={styles.ownerSecondaryButton} onPress={handleSecureCheckout}>
                <Ionicons name="cube-outline" size={18} color={colors.text} />
                <Text style={styles.ownerSecondaryButtonText}>Suivre la livraison</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.whatsappButton} onPress={handleContactSellerOnWhatsApp}>
              <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
              <Text style={styles.whatsappButtonText}>WhatsApp</Text>
            </Pressable>
            <Pressable
              style={[styles.contactButton, contactMutation.isPending && styles.contactButtonDisabled]}
              onPress={handleContactSeller}
              disabled={contactMutation.isPending}
            >
              {contactMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.white} />
                  <Text style={styles.contactButtonText}>Contacter le vendeur</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>

      <Modal
        visible={contactComposerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!contactMutation.isPending) {
            setContactComposerOpen(false)
          }
        }}
      >
        <View style={styles.composerOverlay}>
          <View style={styles.composerCard}>
            <Text style={styles.composerTitle}>Contacter le vendeur</Text>
            <Text style={styles.composerSubtitle}>
              Tu peux modifier le message avant envoi.
            </Text>
            <TextInput
              value={contactDraft}
              onChangeText={setContactDraft}
              multiline
              autoFocus
              placeholder={DEFAULT_CONTACT_MESSAGE}
              placeholderTextColor={colors.placeholder}
              style={[styles.checkoutInput, styles.composerInput]}
            />
            <View style={styles.composerActions}>
              <Pressable
                style={styles.modalGhostButton}
                onPress={() => setContactComposerOpen(false)}
                disabled={contactMutation.isPending}
              >
                <Text style={styles.modalGhostButtonText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, !canSendContactMessage && styles.contactButtonDisabled]}
                onPress={handleSendContactMessage}
                disabled={!canSendContactMessage}
              >
                {contactMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalPrimaryButtonText}>Envoyer</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={checkoutOpen} transparent animationType="slide" onRequestClose={() => setCheckoutOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Paiement sécurisé</Text>
                <Text style={styles.modalSubtitle}>Finalise l’achat en choisissant le mode de remise et le paiement.</Text>
              </View>
              <Pressable style={styles.headerButton} onPress={() => setCheckoutOpen(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.checkoutLabel}>Mode de remise</Text>
              <View style={styles.checkoutRow}>
                {handoverModes.includes('pickup') ? (
                  <Pressable style={[styles.modeChip, handoverMode === 'pickup' && styles.modeChipActive]} onPress={() => setHandoverMode('pickup')}>
                    <Text style={[styles.modeChipText, handoverMode === 'pickup' && styles.modeChipTextActive]}>Remise</Text>
                  </Pressable>
                ) : null}
                {handoverModes.includes('delivery') ? (
                  <Pressable style={[styles.modeChip, handoverMode === 'delivery' && styles.modeChipActive]} onPress={() => setHandoverMode('delivery')}>
                    <Text style={[styles.modeChipText, handoverMode === 'delivery' && styles.modeChipTextActive]}>Livraison</Text>
                  </Pressable>
                ) : null}
              </View>

              {paymentMethod === 'mobile_money' ? (
                <>
                  <Text style={styles.checkoutLabel}>Téléphone</Text>
                  <TextInput
                    value={paymentPhone}
                    onChangeText={setPaymentPhone}
                    placeholder="Numéro Mobile Money (+2376XXXXXXXX)"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="phone-pad"
                    style={styles.checkoutInput}
                  />
                  {mobileMoneyInvalid ? (
                    <Text style={[styles.checkoutHint, styles.checkoutWarningText]}>
                      Numéro camerounais invalide. Utilise le format +2376XXXXXXXX.
                    </Text>
                  ) : null}
                </>
              ) : null}

              {handoverMode === 'delivery' ? (
                <>
                  {savedShippingAddresses.length ? (
                    <>
                      <Text style={styles.checkoutLabel}>Mes adresses</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.savedAddressRow}
                      >
                        {savedShippingAddresses.map(address => {
                          const selected = dropoffAddress.includes(address.line1) && dropoffAddress.includes(address.city)
                          return (
                            <Pressable
                              key={address.id}
                              style={[styles.savedAddressCard, selected && styles.savedAddressCardActive]}
                              onPress={() => {
                                setDropoffAddress([address.line1, address.city].filter(Boolean).join(', '))
                                setDropoffNotes(
                                  [address.recipientName, address.line2, address.state, address.postalCode]
                                    .filter(Boolean)
                                    .join(' • ')
                                )
                                setDropoffCoordinates(null)
                              }}
                            >
                              <View style={styles.savedAddressHeader}>
                                <Text style={styles.savedAddressLabel} numberOfLines={1}>
                                  {address.label}
                                </Text>
                                {address.isDefaultShipping ? (
                                  <View style={styles.savedAddressBadge}>
                                    <Text style={styles.savedAddressBadgeText}>Défaut</Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.savedAddressLine} numberOfLines={2}>
                                {address.line1}
                              </Text>
                              <Text style={styles.savedAddressMeta} numberOfLines={1}>
                                {address.city}, {address.postalCode}
                              </Text>
                            </Pressable>
                          )
                        })}
                      </ScrollView>
                    </>
                  ) : null}

                  <Text style={styles.checkoutLabel}>Adresse de livraison</Text>
                  <TextInput
                    value={dropoffAddress}
                    onChangeText={value => {
                      setDropoffAddress(value)
                      setDropoffCoordinates(null)
                    }}
                    placeholder="Quartier, rue, repère"
                    placeholderTextColor={colors.placeholder}
                    style={styles.checkoutInput}
                  />

                  {dropoffAddress.trim().length >= 2 ? (
                    checkoutLocationSuggestionsQuery.isLoading ? (
                      <View style={styles.checkoutSuggestionsState}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.checkoutSuggestionsStateText}>Recherche des quartiers et villes...</Text>
                      </View>
                    ) : checkoutLocationSuggestions.length ? (
                      <View style={styles.checkoutSuggestionsCard}>
                        {checkoutLocationSuggestions.map(item => {
                          const pretty = buildPrettyGeoLabel(item)
                          return (
                            <Pressable
                              key={buildGeoSuggestionKey(item)}
                              style={({ pressed }) => [styles.checkoutSuggestionRow, pressed && styles.checkoutSuggestionRowPressed]}
                              onPress={() => {
                                setDropoffAddress(pretty)
                                setDropoffCoordinates(
                                  item.coordinates ? { lng: item.coordinates[0], lat: item.coordinates[1] } : null
                                )
                              }}
                            >
                              <View style={styles.checkoutSuggestionIcon}>
                                <Ionicons
                                  name={item.kind === 'neighborhood' ? 'location-outline' : 'business-outline'}
                                  size={16}
                                  color={colors.muted}
                                />
                              </View>
                              <View style={styles.checkoutSuggestionContent}>
                                <Text style={styles.checkoutSuggestionTitle}>{pretty}</Text>
                                <Text style={styles.checkoutSuggestionMeta}>
                                  {item.kind === 'neighborhood' ? 'Quartier' : 'Ville'}
                                  {item.city && item.kind === 'neighborhood' ? ` • ${item.city}` : ''}
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                            </Pressable>
                          )
                        })}
                      </View>
                    ) : (
                      <Text style={styles.checkoutHint}>Aucune suggestion pour cette zone.</Text>
                    )
                  ) : null}

                  {checkoutRouteMapUrl ? (
                    <View style={styles.checkoutMapCard}>
                      <Image source={{ uri: checkoutRouteMapUrl }} style={styles.checkoutMapImage} resizeMode="cover" />
                      <View style={styles.checkoutMapBadge}>
                        <Text style={styles.checkoutMapBadgeText}>
                          {checkoutDistanceKm ? `${checkoutDistanceKm.toFixed(1)} km estimés` : 'Trajet estimé'}
                        </Text>
                      </View>
                    </View>
                  ) : MAPBOX_TOKEN ? (
                    <View style={styles.checkoutMapFallback}>
                      <Ionicons name="map-outline" size={18} color={colors.muted} />
                      <Text style={styles.checkoutMapFallbackText}>
                        Sélectionne une ville ou un quartier pour prévisualiser le trajet.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.checkoutMapFallback}>
                      <Ionicons name="map-outline" size={18} color={colors.muted} />
                      <Text style={styles.checkoutMapFallbackText}>
                        Ajoute `EXPO_PUBLIC_MAPBOX_TOKEN` dans le `.env` mobile pour afficher la carte de trajet.
                      </Text>
                    </View>
                  )}

                  {checkoutLocationResolved ? (
                    <Text style={styles.checkoutHint}>
                      Zone confirmée. Le livreur sera orienté vers {dropoffAddress.trim()}.
                    </Text>
                  ) : (
                    <Text style={[styles.checkoutHint, styles.checkoutWarningText]}>
                      Choisis une ville ou un quartier suggéré pour localiser précisément la livraison.
                    </Text>
                  )}

                  <Text style={styles.checkoutLabel}>Précisions</Text>
                  <TextInput
                    value={dropoffNotes}
                    onChangeText={setDropoffNotes}
                    placeholder="Étage, appel, heure..."
                    placeholderTextColor={colors.placeholder}
                    multiline
                    style={[styles.checkoutInput, styles.checkoutTextarea]}
                  />

                  <Text style={styles.checkoutLabel}>Frais estimés</Text>
                  <TextInput
                    value={deliveryBudget}
                    onChangeText={setDeliveryBudget}
                    placeholder="Montant estimé de livraison"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="number-pad"
                    style={styles.checkoutInput}
                  />
                </>
              ) : (
                <Text style={styles.checkoutHint}>Le vendeur conviendra avec toi d’un lieu de remise après confirmation du paiement sécurisé.</Text>
              )}

              <Text style={styles.checkoutLabel}>Paiement</Text>
              <View style={styles.checkoutRow}>
                {(['mobile_money', 'card', 'wallet'] as const).map(option => (
                  <Pressable
                    key={option}
                    style={[styles.modeChip, paymentMethod === option && styles.modeChipActive]}
                    onPress={() => setPaymentMethod(option)}
                  >
                    <Text style={[styles.modeChipText, paymentMethod === option && styles.modeChipTextActive]}>
                      {option === 'mobile_money' ? 'Mobile Money' : option === 'card' ? 'Carte' : 'Wallet'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {paymentMethod === 'mobile_money' ? (
                <>
                  <Text style={styles.checkoutLabel}>Opérateur</Text>
                  <View style={styles.checkoutRow}>
                    {(['mtn', 'orange'] as const).map(option => (
                      <Pressable
                        key={option}
                        style={[styles.modeChip, paymentOperator === option && styles.modeChipActive]}
                        onPress={() => setPaymentOperator(option)}
                      >
                        <Text style={[styles.modeChipText, paymentOperator === option && styles.modeChipTextActive]}>
                          {option === 'mtn' ? 'MTN' : 'Orange'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {paymentMethod === 'wallet' ? (
                <>
                  <Text style={styles.checkoutHint}>
                    {walletSummary
                      ? `Solde wallet: ${Math.round(walletSummary.balance).toLocaleString('fr-FR')} ${walletSummary.currency}`
                      : 'Chargement du wallet...'}
                  </Text>
                  {walletCurrencyMismatch ? (
                    <Text style={[styles.checkoutHint, styles.checkoutWarningText]}>
                      Le wallet est en {walletSummary?.currency}. Cette annonce est en {listing?.currency || 'XAF'}.
                    </Text>
                  ) : null}
                  {walletInsufficient ? (
                    <Text style={[styles.checkoutHint, styles.checkoutWarningText]}>
                      Solde insuffisant pour régler le total estimé.
                    </Text>
                  ) : null}
                  {walletUnavailable ? (
                    <Text style={[styles.checkoutHint, styles.checkoutWarningText]}>
                      Impossible de charger le solde du wallet pour le moment.
                    </Text>
                  ) : null}
                </>
              ) : null}
              {paymentMethod === 'card' ? (
                <Text style={styles.checkoutHint}>
                  Le paiement par carte sera finalisé via une page sécurisée. La confirmation peut prendre quelques minutes.
                </Text>
              ) : null}
              {paymentMethod === 'mobile_money' ? (
                <Text style={styles.checkoutHint}>
                  Mobile Money : la confirmation peut prendre quelques minutes. Suis le statut dans tes livraisons.
                </Text>
              ) : null}

              <View style={styles.checkoutSummaryCard}>
                <Text style={styles.checkoutSummaryTitle}>Résumé</Text>
                <View style={styles.checkoutSummaryRow}>
                  <Text style={styles.checkoutSummaryLabel}>Article</Text>
                  <Text style={styles.checkoutSummaryValue}>{formatPrice(listing.price, listing.currency || 'XAF')}</Text>
                </View>
                <View style={styles.checkoutSummaryRow}>
                  <Text style={styles.checkoutSummaryLabel}>Livraison</Text>
                  <Text style={styles.checkoutSummaryValue}>
                    {handoverMode === 'delivery' && deliveryBudget.trim() ? formatPrice(deliveryBudget, listing.currency || 'XAF') : 'Incluse / à définir'}
                  </Text>
                </View>
                {checkoutDistanceKm && handoverMode === 'delivery' ? (
                  <View style={styles.checkoutSummaryRow}>
                    <Text style={styles.checkoutSummaryLabel}>Distance</Text>
                    <Text style={styles.checkoutSummaryValue}>{checkoutDistanceKm.toFixed(1)} km</Text>
                  </View>
                ) : null}
                <View style={[styles.checkoutSummaryRow, styles.checkoutSummaryRowTotal]}>
                  <Text style={styles.checkoutSummaryTotalLabel}>Total estimé</Text>
                  <Text style={styles.checkoutSummaryTotalValue}>
                    {formatPrice(String(totalEstimate), listing.currency || 'XAF')}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.modalGhostButton} onPress={() => setCheckoutOpen(false)} disabled={escrowMutation.isPending}>
                <Text style={styles.modalGhostButtonText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, (!canSubmitCheckout || escrowMutation.isPending) && styles.contactButtonDisabled]}
                onPress={() => escrowMutation.mutate()}
                disabled={!canSubmitCheckout || escrowMutation.isPending}
              >
                <Text style={styles.modalPrimaryButtonText}>{escrowMutation.isPending ? 'Traitement...' : 'Payer en sécurisé'}</Text>
              </Pressable>
            </View>
          </View>
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
    backgroundColor: colors.background,
    padding: spacing.xl
  },
  errorText: {
    color: colors.text,
    fontSize: typography.body,
    textAlign: 'center'
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold,
    textAlign: 'center'
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.soft
  },
  media: {
    height: 286,
    backgroundColor: colors.surfaceMuted,
    position: 'relative'
  },
  heroImage: {
    width: '100%',
    height: '100%'
  },
  heroBadges: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm
  },
  heroBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    color: colors.white,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  heroBadgeFeatured: {
    backgroundColor: '#8b32ff'
  },
  heroBadgeBoosted: {
    backgroundColor: colors.primary
  },
  heroBody: {
    padding: spacing.lg
  },
  price: {
    color: colors.success,
    fontSize: typography.title,
    fontWeight: typography.weightBlack
  },
  title: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: typography.titleSm,
    lineHeight: 26,
    fontWeight: typography.weightExtrabold
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md
  },
  highlightChip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accentSoft
  },
  highlightText: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  metaPillText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  publishText: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: typography.caption
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.soft
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderStrong,
    marginVertical: spacing.xs
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold,
    marginBottom: spacing.md
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  sellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  sellerIdentity: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarImage: {
    width: '100%',
    height: '100%'
  },
  sellerMeta: {
    flex: 1
  },
  sellerSubline: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: -spacing.sm
  },
  sellerBadges: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  sellerBadge: {
    backgroundColor: colors.primarySurface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  sellerBadgeVerified: {
    backgroundColor: colors.accentSoft
  },
  sellerBadgeText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  sellerBadgeVerifiedText: {
    color: colors.accent
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  secondaryButtonDisabled: {
    opacity: 0.6
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  sellerStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  statBox: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    alignItems: 'center'
  },
  statValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightExtrabold
  },
  statLabel: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.caption
  },
  detailsGrid: {
    gap: spacing.sm
  },
  detailItem: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md
  },
  detailLabel: {
    color: colors.muted,
    fontSize: typography.caption
  },
  detailValue: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  emptySectionText: {
    color: colors.muted,
    fontSize: typography.bodySm
  },
  sectionParagraph: {
    color: colors.text,
    fontSize: typography.bodySm,
    lineHeight: 22
  },
  deliveryStack: {
    gap: spacing.md
  },
  deliveryItem: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md
  },
  deliveryHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  deliveryTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightBold
  },
  deliveryBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  deliveryTextBlock: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: typography.bodySm,
    lineHeight: 21
  },
  locationInfo: {
    gap: spacing.md,
    marginBottom: spacing.md
  },
  locationRow: {
    gap: spacing.xs
  },
  locationLabel: {
    color: colors.muted,
    fontSize: typography.caption
  },
  locationValue: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  locationPrivacy: {
    color: colors.muted,
    fontSize: typography.caption
  },
  mapPreview: {
    width: '100%',
    height: 184,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  mapFallback: {
    height: 160,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  mapFallbackTitle: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  mapFallbackText: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.caption,
    textAlign: 'center',
    lineHeight: 18
  },
  sellerCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  sellerMetaCompact: {
    flex: 1,
    justifyContent: 'center'
  },
  sellerNameText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weightExtrabold
  },
  sellerListingText: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.caption
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md
  },
  inlineAction: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  inlineActionText: {
    color: colors.accent,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  tipsList: {
    gap: spacing.md
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  tipText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm,
    lineHeight: 21
  },
  reportCard: {
    borderColor: colors.dangerSurfaceStrong,
    backgroundColor: colors.dangerSurface
  },
  reportText: {
    color: colors.danger
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 18, 28, 0.42)',
    justifyContent: 'flex-end'
  },
  composerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 18, 28, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  composerCard: {
    width: '100%',
    borderRadius: radius.xl,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.soft
  },
  composerTitle: {
    color: colors.text,
    fontSize: typography.titleSm,
    fontWeight: typography.weightExtrabold
  },
  composerSubtitle: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  composerInput: {
    marginTop: spacing.md,
    minHeight: 116,
    textAlignVertical: 'top',
    paddingTop: spacing.md
  },
  composerActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: typography.weightBlack
  },
  modalSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.bodySm
  },
  modalContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md
  },
  checkoutLabel: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold,
    marginTop: spacing.md,
    marginBottom: spacing.sm
  },
  checkoutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  modeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  modeChipActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  modeChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  modeChipTextActive: {
    color: colors.primary
  },
  checkoutInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    paddingHorizontal: spacing.md
  },
  checkoutTextarea: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: spacing.md
  },
  checkoutHint: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18
  },
  checkoutWarningText: {
    color: colors.warning
  },
  checkoutSuggestionsState: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  savedAddressRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg
  },
  savedAddressCard: {
    width: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs
  },
  savedAddressCardActive: {
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft
  },
  savedAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  savedAddressLabel: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  savedAddressBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4
  },
  savedAddressBadgeText: {
    color: colors.accent,
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  savedAddressLine: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  savedAddressMeta: {
    color: colors.muted,
    fontSize: typography.caption
  },
  checkoutSuggestionsStateText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  checkoutSuggestionsCard: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden'
  },
  checkoutSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  checkoutSuggestionRowPressed: {
    backgroundColor: colors.surfaceAlt
  },
  checkoutSuggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkoutSuggestionContent: {
    flex: 1
  },
  checkoutSuggestionTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  checkoutSuggestionMeta: {
    marginTop: 1,
    color: colors.muted,
    fontSize: typography.caption
  },
  checkoutMapCard: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised
  },
  checkoutMapImage: {
    width: '100%',
    height: 152,
    backgroundColor: colors.surfaceRaised
  },
  checkoutMapBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  checkoutMapBadgeText: {
    color: colors.white,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  checkoutMapFallback: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md
  },
  checkoutMapFallbackText: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.caption
  },
  checkoutSummaryCard: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.sm
  },
  checkoutSummaryTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  checkoutSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  checkoutSummaryRowTotal: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  checkoutSummaryLabel: {
    color: colors.muted,
    fontSize: typography.caption
  },
  checkoutSummaryValue: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold,
    textAlign: 'right'
  },
  checkoutSummaryTotalLabel: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  checkoutSummaryTotalValue: {
    color: colors.primary,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBlack,
    textAlign: 'right'
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  modalGhostButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  modalGhostButtonText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    ...shadows.soft
  },
  modalPrimaryButtonText: {
    color: colors.white,
    fontSize: typography.bodySm,
    fontWeight: typography.weightExtrabold
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  ownerFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  ownerSecondaryButton: {
    minWidth: 124,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  ownerSecondaryButtonText: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  contactButton: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    ...shadows.soft
  },
  contactButtonDisabled: {
    opacity: 0.7
  },
  contactButtonText: {
    color: colors.white,
    fontSize: typography.bodySm,
    fontWeight: typography.weightExtrabold
  },
  whatsappButton: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    ...shadows.soft
  },
  whatsappButtonText: {
    color: colors.white,
    fontSize: typography.bodySm,
    fontWeight: typography.weightExtrabold
  }
})
