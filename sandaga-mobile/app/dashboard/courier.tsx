import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { usersApi } from '@/features/users/users.api'
import { geoApi } from '@/features/geo/geo.api'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

const RADIUS_OPTIONS = [5, 10, 15, 25, 35, 50]
type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected'
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() ?? ''
const MAPBOX_STYLE_ID = 'mapbox/streets-v12'
const DEFAULT_MAPBOX_CENTER = { lng: 11.5021, lat: 4.0511 }

function getMapboxZoom(radiusKm: number) {
  if (radiusKm <= 5) return 12.2
  if (radiusKm <= 10) return 11.4
  if (radiusKm <= 15) return 10.7
  if (radiusKm <= 25) return 10.3
  if (radiusKm <= 35) return 9.7
  if (radiusKm <= 50) return 9.2
  return 8.6
}

function buildMapboxStaticUrl(lat?: number, lng?: number, radiusKm = 15) {
  if (!MAPBOX_TOKEN) {
    return null
  }
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)
  const center = hasCoords ? { lng: lng as number, lat: lat as number } : DEFAULT_MAPBOX_CENTER
  const zoom = hasCoords ? getMapboxZoom(radiusKm) : 5.2
  const marker = hasCoords ? `pin-s+0f60c4(${center.lng},${center.lat})/` : ''
  return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE_ID}/static/${marker}${center.lng},${center.lat},${zoom},0/1200x700?access_token=${MAPBOX_TOKEN}`
}

function formatStatus(status?: VerificationStatus) {
  switch (status) {
    case 'approved':
      return 'Vérifié'
    case 'pending':
      return 'En revue'
    case 'rejected':
      return 'Refusé'
    default:
      return 'Non vérifié'
  }
}

function statusTheme(status?: VerificationStatus) {
  switch (status) {
    case 'approved':
      return { bg: colors.successSoft, border: colors.primarySoftStrong, text: colors.success }
    case 'pending':
      return { bg: colors.warningSoft, border: colors.accentOutline, text: colors.warning }
    case 'rejected':
      return { bg: colors.dangerSurface, border: colors.dangerSurfaceStrong, text: colors.danger }
    default:
      return { bg: colors.surfaceMuted, border: colors.border, text: colors.muted }
  }
}

export default function CourierSettingsScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const meQuery = useQuery({
    queryKey: ['users', 'me', 'courier-settings'],
    queryFn: () => usersApi.me()
  })

  const settings = meQuery.data?.settings ?? {}
  const courierStatus = (meQuery.data?.courierVerificationStatus ?? 'unverified') as VerificationStatus
  const courierDocUrl = meQuery.data?.courierVerificationDocumentUrl ?? ''
  const [isCourier, setIsCourier] = useState(Boolean(settings.isCourier))
  const [city, setCity] = useState(settings.courierLocation?.city ?? '')
  const [zipcode, setZipcode] = useState(settings.courierLocation?.zipcode ?? '')
  const [lat, setLat] = useState<number | undefined>(settings.courierLocation?.lat)
  const [lng, setLng] = useState<number | undefined>(settings.courierLocation?.lng)
  const [radiusKm, setRadiusKm] = useState<number>(settings.courierRadiusKm ?? 15)
  const [search, setSearch] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const mapPreviewUrl = useMemo(() => buildMapboxStaticUrl(lat, lng, radiusKm), [lat, lng, radiusKm])

  const onboardingSteps = useMemo(
    () => [
      {
        key: 'toggle',
        label: 'Activer le mode livreur',
        done: Boolean(isCourier)
      },
      {
        key: 'location',
        label: 'Définir une zone',
        done: Boolean(city.trim())
      },
      {
        key: 'radius',
        label: 'Choisir un rayon',
        done: Boolean(radiusKm)
      },
      {
        key: 'document',
        label: 'Ajouter un justificatif',
        done: Boolean(courierDocUrl)
      },
      {
        key: 'verification',
        label: 'Validation',
        done: courierStatus === 'approved'
      }
    ],
    [city, courierDocUrl, courierStatus, isCourier, radiusKm]
  )

  const completedSteps = onboardingSteps.filter(step => step.done).length
  const progress = onboardingSteps.length ? completedSteps / onboardingSteps.length : 0

  useEffect(() => {
    setIsCourier(Boolean(settings.isCourier))
    setCity(settings.courierLocation?.city ?? '')
    setZipcode(settings.courierLocation?.zipcode ?? '')
    setLat(settings.courierLocation?.lat)
    setLng(settings.courierLocation?.lng)
    setRadiusKm(settings.courierRadiusKm ?? 15)
  }, [settings.courierLocation?.city, settings.courierLocation?.lat, settings.courierLocation?.lng, settings.courierLocation?.zipcode, settings.courierRadiusKm, settings.isCourier])

  const suggestionsQuery = useQuery({
    queryKey: ['geo', 'courier', search],
    queryFn: async () => {
      const q = search.trim()
      if (q.length < 2) return []
      return geoApi.autocomplete(q, 8)
    },
    enabled: isCourier && search.trim().length >= 2
  })

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => usersApi.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'courier-settings'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
    }
  })

  const handleSave = () => {
    if (isCourier && !city.trim()) {
      Alert.alert('Lieu requis', 'Indique une ville ou un quartier.')
      return
    }
    updateMutation.mutate({
      isCourier,
      courierRadiusKm: isCourier ? radiusKm : undefined,
      courierLocation: isCourier
        ? {
            city: city.trim() || undefined,
            zipcode: zipcode.trim() || undefined,
            lat,
            lng
          }
        : null
    })
  }

  const resolveLocation = useCallback(async () => {
    if (isLocating) return
    const geolocation = globalThis.navigator?.geolocation
    if (!geolocation) {
      Alert.alert('Localisation', 'La géolocalisation n’est pas disponible sur cet appareil.')
      return
    }

    setIsLocating(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000
        })
      })
      const nextLat = position.coords.latitude
      const nextLng = position.coords.longitude
      const reverse = await geoApi.reverse(nextLat, nextLng).catch(() => null)
      setLat(nextLat)
      setLng(nextLng)
      setCity(reverse?.city ?? reverse?.label ?? city)
      setSearch('')
    } catch (error) {
      Alert.alert('Localisation', error instanceof Error ? error.message : 'Impossible de récupérer votre position.')
    } finally {
      setIsLocating(false)
    }
  }, [city, isLocating])

  const suggestions = useMemo(() => suggestionsQuery.data ?? [], [suggestionsQuery.data])

  useEffect(() => {
    if (!isCourier || city.trim()) {
      return
    }
    void resolveLocation()
  }, [city, isCourier, resolveLocation])

  return (
    <ScreenScaffold title="Livreur" subtitle="Configurez votre zone d’intervention.">
      <View style={dashboardStyles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={dashboardStyles.sectionTitle}>Checklist livreur</Text>
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <View style={styles.checklist}>
          {onboardingSteps.map(step => (
            <View key={step.key} style={styles.checklistRow}>
              <Ionicons
                name={step.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={step.done ? colors.success : colors.muted}
              />
              <Text style={[styles.checklistText, step.done && styles.checklistTextDone]}>{step.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={dashboardStyles.sectionTitle}>Vérification livreur</Text>
          <StatusPill status={courierStatus} />
        </View>
        {meQuery.data?.courierVerificationReviewNotes ? (
          <Text style={styles.reviewNotes}>{meQuery.data.courierVerificationReviewNotes}</Text>
        ) : (
          <Text style={styles.helperText}>Ajoutez un justificatif pour activer les courses.</Text>
        )}
        <Pressable style={styles.linkButton} onPress={() => router.push('/dashboard/verification')}>
          <Text style={styles.linkButtonText}>Gérer les documents</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </Pressable>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleContent}>
            <Text style={styles.toggleTitle}>Activer le mode livreur</Text>
            <Text style={styles.toggleSubtitle}>Recevez des courses près de chez vous.</Text>
          </View>
          <Switch value={isCourier} onValueChange={setIsCourier} />
        </View>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Zone de livraison</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Ville ou quartier"
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            editable={isCourier}
          />
        </View>

        {suggestions.length > 0 ? (
          <View style={styles.suggestionsCard}>
            {suggestions.map(item => (
              <Pressable
                key={item.id}
                style={styles.suggestionRow}
                onPress={() => {
                  setCity(item.city ?? item.label)
                  setLat(item.coordinates?.[1])
                  setLng(item.coordinates?.[0])
                  setSearch('')
                }}
              >
                <Ionicons
                  name={item.kind === 'neighborhood' ? 'location-outline' : 'business-outline'}
                  size={16}
                  color={colors.muted}
                />
                <Text style={styles.suggestionText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.fieldRow}>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Ville"
            placeholderTextColor={colors.placeholder}
            style={styles.fieldInput}
            editable={isCourier}
          />
          <TextInput
            value={zipcode}
            onChangeText={setZipcode}
            placeholder="Code postal"
            placeholderTextColor={colors.placeholder}
            style={styles.fieldInput}
            editable={isCourier}
          />
        </View>

        <Pressable style={styles.geoButton} onPress={resolveLocation} disabled={!isCourier}>
          {isLocating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="locate-outline" size={18} color={colors.primary} />
          )}
          <Text style={styles.geoButtonText}>Utiliser ma position</Text>
        </Pressable>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Rayon d’intervention</Text>
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map(option => {
            const active = radiusKm === option
            return (
              <Pressable
                key={option}
                style={[styles.radiusChip, active && styles.radiusChipActive]}
                onPress={() => setRadiusKm(option)}
                disabled={!isCourier}
              >
                <Text style={[styles.radiusChipText, active && styles.radiusChipTextActive]}>{option} km</Text>
              </Pressable>
            )
          })}
        </View>
        <View style={styles.mapPreviewCard}>
          {mapPreviewUrl ? (
            <>
              <Image source={{ uri: mapPreviewUrl }} style={styles.mapPreviewImage} resizeMode="cover" />
              <View style={styles.mapPreviewCenter}>
                <Ionicons name="locate" size={18} color={colors.accent} />
              </View>
              <View style={styles.mapPreviewBadge}>
                <Text style={styles.mapPreviewBadgeText}>Mapbox</Text>
              </View>
              <Text style={styles.mapPreviewLabel} numberOfLines={1}>
                {city?.trim() || 'Zone de livraison'}
              </Text>
            </>
          ) : (
            <View style={styles.mapPreviewFallback}>
              <Ionicons name="map-outline" size={30} color={colors.accent} />
              <Text style={styles.mapPreviewFallbackTitle}>
                {MAPBOX_TOKEN ? 'Carte centrée sur le Cameroun' : 'Token Mapbox manquant'}
              </Text>
              <Text style={styles.mapPreviewFallbackText}>
                {MAPBOX_TOKEN
                  ? 'Choisissez une ville ou utilisez votre position pour recentrer la carte.'
                  : 'Ajoutez EXPO_PUBLIC_MAPBOX_TOKEN dans le .env mobile pour afficher la carte Mapbox.'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Pressable style={styles.primaryButton} onPress={handleSave} disabled={updateMutation.isPending}>
        {updateMutation.isPending ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Enregistrer</Text>
        )}
      </Pressable>
    </ScreenScaffold>
  )
}

function StatusPill({ status }: { status: VerificationStatus }) {
  const theme = statusTheme(status)
  return (
    <View style={[styles.statusPill, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <Text style={[styles.statusPillText, { color: theme.text }]}>{formatStatus(status)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  statusPillText: {
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  progressText: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    marginBottom: spacing.md
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary
  },
  checklist: {
    gap: spacing.sm
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  checklistText: {
    color: colors.text,
    fontSize: typography.bodySm
  },
  checklistTextDone: {
    color: colors.muted,
    textDecorationLine: 'line-through'
  },
  reviewNotes: {
    color: colors.danger,
    fontSize: typography.caption,
    marginBottom: spacing.sm
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  toggleContent: {
    flex: 1,
    gap: 2
  },
  toggleTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  toggleSubtitle: {
    color: colors.muted,
    fontSize: typography.caption
  },
  searchRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
    minHeight: 44
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm
  },
  suggestionsCard: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden'
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  suggestionText: {
    color: colors.text,
    fontSize: typography.bodySm
  },
  fieldRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm
  },
  fieldInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    color: colors.text
  },
  geoButton: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primarySoftStrong,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center'
  },
  geoButtonText: {
    color: colors.primary,
    fontWeight: typography.weightSemibold
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  radiusChip: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center'
  },
  radiusChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  radiusChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  radiusChipTextActive: {
    color: colors.primary
  },
  mapPreviewCard: {
    marginTop: spacing.md,
    height: 190,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    position: 'relative'
  },
  mapPreviewImage: {
    width: '100%',
    height: '100%'
  },
  mapPreviewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm
  },
  mapPreviewFallbackTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold,
    textAlign: 'center'
  },
  mapPreviewFallbackText: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center'
  },
  mapPreviewCenter: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20
  },
  mapPreviewBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  mapPreviewBadgeText: {
    color: colors.text,
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  mapPreviewLabel: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    maxWidth: '80%',
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  helperText: {
    color: colors.muted,
    fontSize: typography.caption,
    marginBottom: spacing.sm
  },
  linkButton: {
    marginTop: spacing.xs,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentOutline,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  linkButtonText: {
    color: colors.accent,
    fontWeight: typography.weightSemibold
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  }
})
