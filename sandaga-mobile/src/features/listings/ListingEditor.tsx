import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { API_BASE_URL } from '@/core/config/env'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'
import { categoriesApi, type CategoryNode } from '@/features/categories/categories.api'
import { geoApi } from '@/features/geo/geo.api'
import { mediaApi } from '@/features/media/media.api'
import {
  listingsApi,
  type ListingFormField,
  type ListingFormSchema,
  type ListingImagePayload,
  type PriceSuggestion
} from './listings.api'
import { PrimaryButton } from '@/components/ui/PrimaryButton'

type EditorMode = 'create' | 'edit'

type ListingEditorProps = {
  mode: EditorMode
  listingId?: string
}

type EditorImage = {
  id: string
  uri: string
  isCover: boolean
  remote: boolean
}

type ListingValueMap = Record<string, string | number | boolean | string[]>

type LocationState = {
  input: string
  cityId?: string
  neighborhoodId?: string
  city?: string
  zipcode?: string
  lat?: number
  lng?: number
  hideExact?: boolean
}

type VisibilityCondition = {
  field: string
  equals?: unknown
  notEquals?: unknown
  in?: unknown[]
  notIn?: unknown[]
}

type StepDescriptor =
  | {
      kind: 'dynamic'
      id: string
      title: string
      schemaStep: ListingFormSchema['steps'][number]
      info: string[]
      isMapStep: boolean
    }
  | {
      kind: 'media'
      id: 'media'
      title: string
      info: string[]
    }

const LOCATION_NAME_MATCHER = /(location|localisation|adresse|address|city|ville|zipcode|zip|lat|lng|longitude|latitude)/i
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() ?? ''
const MAPBOX_STYLE_ID = 'mapbox/streets-v12'
const DEFAULT_MAPBOX_CENTER = { lng: 11.5021, lat: 4.0511 }

const knownPayloadKeys = new Set([
  'title',
  'subject',
  'description',
  'body',
  'price',
  'amount',
  'currency',
  'adType',
  'email',
  'phone',
  'phoneHidden',
  'phone_hidden',
  'phone_hidden_information_text',
  'noSalesmen',
  'no_salesmen',
  'customRef',
  'custom_ref',
  'city',
  'zipcode',
  'address',
  'location',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'locationHideExact',
  'newItemPrice',
  'new_item_price'
])

const normalizeString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    return ['1', 'true', 'yes', 'on', 'oui', 'vrai'].includes(normalized)
  }
  return false
}

const normalizeRegexpPattern = (raw: string): { pattern: string; flags?: string } => {
  let value = raw.trim()

  if (value.endsWith(',')) {
    value = value.slice(0, -1).trim()
  }
  if (value.startsWith('(') && value.endsWith(')')) {
    value = value.slice(1, -1).trim()
  }

  const slashPattern = value.match(/^\/(.+)\/([a-z]*)$/i)
  if (slashPattern) {
    return {
      pattern: slashPattern[1].replace(/\\\\/g, '\\'),
      flags: slashPattern[2] || undefined
    }
  }

  return { pattern: value.replace(/\\\\/g, '\\') }
}

const formatAmount = (amount: number | null | undefined, currency = 'XAF') => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(amount)
  } catch {
    return `${amount} ${currency}`.trim()
  }
}

const isEmptyValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (typeof value === 'number') return !Number.isFinite(value)
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0
  return false
}

const normalizeFlow = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

const getTextFromLabel = (label: string) => label.split(',')[0]?.trim() || label

const isLikelyGlyph = (value: string): boolean => {
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= 4 && !/[a-z0-9_-]/i.test(trimmed)
}

const isLikelyRemoteAsset = (value: string): boolean => {
  const trimmed = value.trim().toLowerCase()
  return (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.includes('/') ||
    trimmed.endsWith('.svg') ||
    trimmed.endsWith('.png') ||
    trimmed.endsWith('.jpg') ||
    trimmed.endsWith('.jpeg') ||
    trimmed.endsWith('.webp')
  )
}

const resolveIconUrl = (raw?: string | null): string | null => {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || !isLikelyRemoteAsset(trimmed)) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `${API_BASE_URL}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`
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

const resolveCategoryPalette = (color?: string | null, selected?: boolean) => {
  if (!color || !isHexColor(color)) {
    return selected
      ? { borderColor: colors.primary, iconBg: colors.primarySurface, iconBorder: colors.primarySurfaceStrong }
      : { borderColor: colors.borderStrong, iconBg: colors.surface, iconBorder: colors.surfaceMuted }
  }

  return {
    borderColor: selected ? color : hexToRgba(color, 0.3),
    iconBg: hexToRgba(color, selected ? 0.2 : 0.14),
    iconBorder: hexToRgba(color, selected ? 0.35 : 0.24)
  }
}

const isLocationField = (field: ListingFormField) => LOCATION_NAME_MATCHER.test(`${field.name} ${field.label}`)

const isMapControlField = (field: ListingFormField): boolean => {
  const name = normalizeString(field.name).toLowerCase()
  const type = normalizeString(field.type).toLowerCase()
  if (type === 'map') return true
  if (name.includes('map') || name.includes('carte')) return true
  return false
}

const isListingFormFieldEnabled = (field: ListingFormField): boolean => {
  if (field.disabled === true) return false
  if (field.active === false) return false
  if (field.isActive === false) return false
  return true
}

const isCoordinateStep = (step: ListingFormSchema['steps'][number]): boolean => {
  const stepName = normalizeString(step.name).toLowerCase()
  const stepLabel = normalizeString(step.label).toLowerCase()
  const stepVariant = normalizeString((step as { variant?: string | null }).variant).toLowerCase()
  if (['location', 'localisation', 'adresse', 'coordinates', 'map'].includes(stepVariant)) {
    return true
  }

  if (
    stepName.includes('location') ||
    stepName.includes('localisation') ||
    stepName.includes('adresse') ||
    stepLabel.includes('location') ||
    stepLabel.includes('localisation') ||
    stepLabel.includes('adresse') ||
    stepName.includes('coordinate') ||
    stepLabel.includes('coordinate')
  ) {
    return true
  }

  return step.fields.some(field => isLocationField(field))
}

const matchVisibility = (value: unknown, condition: VisibilityCondition): boolean => {
  if (condition.equals !== undefined) return value === condition.equals
  if (condition.notEquals !== undefined) return value !== condition.notEquals
  if (condition.in) {
    if (Array.isArray(value)) return value.some(entry => condition.in?.includes(entry))
    return condition.in.includes(value)
  }
  if (condition.notIn) {
    if (Array.isArray(value)) return value.every(entry => !condition.notIn?.includes(entry))
    return !condition.notIn.includes(value)
  }
  return Boolean(value)
}

const resolveRootCategoryId = (categories: CategoryNode[], categoryId: string): string => {
  if (!categoryId) return ''
  for (const category of categories) {
    if (category.id === categoryId) return category.id
    if (category.children.some(child => child.id === categoryId)) {
      return category.id
    }
  }
  return ''
}

const buildEditorMapboxStaticUrl = (location: LocationState) => {
  if (!MAPBOX_TOKEN) return null

  const hasCoordinates = typeof location.lat === 'number' && typeof location.lng === 'number'
  const center = hasCoordinates ? { lng: location.lng!, lat: location.lat! } : DEFAULT_MAPBOX_CENTER
  const marker = hasCoordinates ? `pin-s+0f60c4(${center.lng},${center.lat})/` : ''
  const zoom = hasCoordinates ? 13.4 : 5.2

  return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE_ID}/static/${marker}${center.lng},${center.lat},${zoom},0/1200x720?access_token=${MAPBOX_TOKEN}`
}

export function ListingEditor({ mode, listingId }: ListingEditorProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const footerSafePadding = Math.max(insets.bottom + spacing.sm, spacing.lg)
  const footerVisualHeight = 110
  const scrollRef = useRef<ScrollView>(null)
  const queryClient = useQueryClient()
  const initializedRef = useRef(false)

  const [selectedRootCategoryId, setSelectedRootCategoryId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedAdType, setSelectedAdType] = useState('')
  const [showSubCategorySlider, setShowSubCategorySlider] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [maxUnlockedStepIndex, setMaxUnlockedStepIndex] = useState(0)
  const [handoverModes, setHandoverModes] = useState<string[]>(['pickup'])
  const [values, setValues] = useState<ListingValueMap>({ currency: 'XAF' })
  const [locationState, setLocationState] = useState<LocationState>({
    input: '',
    hideExact: false
  })
  const [images, setImages] = useState<EditorImage[]>([])
  const [locationQuery, setLocationQuery] = useState('')
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [stepStartY, setStepStartY] = useState<number | null>(null)
  const subCategoryRevealAnim = useRef(new Animated.Value(0)).current
  const stepTransitionAnim = useRef(new Animated.Value(1)).current
  const previousStepIndexRef = useRef(0)
  const stepTransitionDirectionRef = useRef(1)
  const pendingScrollToStepRef = useRef(false)
  const previousCategoryIdRef = useRef('')

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => categoriesApi.active()
  })

  const listingQuery = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => listingsApi.getById(listingId as string),
    enabled: mode === 'edit' && Boolean(listingId)
  })

  const schemaQuery = useQuery({
    queryKey: ['listing', 'form-schema', selectedCategoryId],
    queryFn: () => listingsApi.formSchema(selectedCategoryId),
    enabled: selectedCategoryId.length > 0
  })

  const priceSuggestionQuery = useQuery({
    queryKey: [
      'listing',
      'price-suggestion',
      selectedRootCategoryId || selectedCategoryId,
      selectedCategoryId,
      locationState.city || ''
    ],
    queryFn: () =>
      listingsApi.priceSuggestion({
        categoryId: selectedRootCategoryId || selectedCategoryId,
        subCategoryId:
          selectedRootCategoryId && selectedRootCategoryId !== selectedCategoryId ? selectedCategoryId : undefined,
        city: locationState.city,
        sampleSize: 200
      }),
    enabled: Boolean(selectedRootCategoryId || selectedCategoryId)
  })

  const suggestionsQuery = useQuery({
    queryKey: ['geo', 'autocomplete', locationQuery],
    queryFn: () => geoApi.autocomplete(locationQuery, 8),
    enabled: locationQuery.trim().length >= 2
  })

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const parentCategories = useMemo(() => {
    const onlyParents = categories.filter(category => !category.parentId)
    return onlyParents.length > 0 ? onlyParents : categories
  }, [categories])

  const selectedRootCategory = useMemo(
    () => parentCategories.find(category => category.id === selectedRootCategoryId) ?? null,
    [parentCategories, selectedRootCategoryId]
  )
  const subCategories = selectedRootCategory?.children ?? []
  const selectedCategoryHasChildren = subCategories.length > 0

  const adTypeOptions = useMemo<{ value: string; label: string; description?: string }[]>(() => {
    const adTypes = schemaQuery.data?.adTypes
    if (!adTypes) return []
    return Object.entries(adTypes).map(([key, value]) => ({
      value: key,
      label: value?.label || key,
      description: value?.description
    }))
  }, [schemaQuery.data?.adTypes])

  const requiresAdTypeSelection = Boolean(selectedCategoryId) && adTypeOptions.length > 0

  const wizardSteps = useMemo<StepDescriptor[]>(() => {
    if (!selectedCategoryId) return []
    if (requiresAdTypeSelection && !selectedAdType) return []

    const dynamicSteps = (schemaQuery.data?.steps ?? [])
      .filter(step => {
        const flow = normalizeFlow((step as { flow?: string | null }).flow)
        if (!flow || !selectedAdType) return true
        return flow === normalizeFlow(selectedAdType)
      })
      .map(step => ({
        ...step,
        fields: (step.fields ?? []).filter(field => isListingFormFieldEnabled(field))
      }))
      .filter(step => step.fields.length > 0)

    const steps: StepDescriptor[] = []
    let hasCoordinateStep = false
    dynamicSteps.forEach(step => {
      const coordinateStep = isCoordinateStep(step)
      const mapStep = coordinateStep && !hasCoordinateStep
      if (mapStep) {
        hasCoordinateStep = true
      }

      steps.push({
        kind: 'dynamic',
        id: step.id,
        title: step.label || step.name || 'Etape',
        schemaStep: step,
        info: Array.isArray((step as { info?: unknown }).info)
          ? ((step as { info?: string[] }).info ?? [])
          : [],
        isMapStep: mapStep
      })
    })

    steps.push({
      kind: 'media',
      id: 'media',
      title: 'Photos',
      info: ['Ajoute une photo de couverture claire pour augmenter la conversion.']
    })

    return steps
  }, [requiresAdTypeSelection, schemaQuery.data?.steps, selectedAdType, selectedCategoryId])

  const currentStep = wizardSteps[Math.min(activeStepIndex, Math.max(0, wizardSteps.length - 1))]

  const resetWizardProgressState = useCallback(() => {
    setActiveStepIndex(0)
    setMaxUnlockedStepIndex(0)
    setSubmissionError(null)
    previousStepIndexRef.current = 0
    stepTransitionDirectionRef.current = 1
    pendingScrollToStepRef.current = false
  }, [])

  const resetStepFormValuesForCategoryChange = useCallback(() => {
    setValues(previous => ({
      currency:
        typeof previous.currency === 'string' && previous.currency.trim().length > 0
          ? previous.currency
          : 'XAF'
    }))
    setLocationState({
      input: '',
      hideExact: false
    })
    setLocationQuery('')
    setImages([])
    setHandoverModes(['pickup'])
    setSubmissionError(null)
  }, [])

  useEffect(() => {
    if (!selectedCategoryId) {
      resetWizardProgressState()
      return
    }
    resetWizardProgressState()
  }, [resetWizardProgressState, selectedCategoryId])

  useEffect(() => {
    const previousCategoryId = previousCategoryIdRef.current
    const hasChangedCategory = previousCategoryId.length > 0 && previousCategoryId !== selectedCategoryId

    if (hasChangedCategory) {
      resetStepFormValuesForCategoryChange()
    }

    previousCategoryIdRef.current = selectedCategoryId
  }, [resetStepFormValuesForCategoryChange, selectedCategoryId])

  useEffect(() => {
    if (!wizardSteps.length) {
      setActiveStepIndex(0)
      setMaxUnlockedStepIndex(0)
      return
    }
    setActiveStepIndex(previous => Math.min(previous, wizardSteps.length - 1))
    setMaxUnlockedStepIndex(previous => Math.min(Math.max(previous, 0), wizardSteps.length - 1))
  }, [wizardSteps.length])

  useEffect(() => {
    if (mode !== 'edit' || !listingQuery.data || initializedRef.current || categories.length === 0) {
      return
    }

    initializedRef.current = true
    const listing = listingQuery.data
    const listingCategoryId = listing.category?.id || ''
    const rootCategoryId = resolveRootCategoryId(categories, listingCategoryId)
    const rootCategory = parentCategories.find(category => category.id === rootCategoryId) ?? null

    setSelectedRootCategoryId(rootCategoryId)
    setSelectedCategoryId(listingCategoryId || rootCategoryId)
    setSelectedAdType(normalizeFlow(listing.flow) || '')
    setShowSubCategorySlider(Boolean(rootCategory && rootCategory.children.length > 0))

    const attributes = (listing.attributes ?? {}) as Record<string, unknown>
    const handoverRaw = attributes.handover_modes
    const normalizedHandover = Array.isArray(handoverRaw)
      ? handoverRaw
          .map(entry => normalizeString(entry).toLowerCase())
          .filter(entry => entry === 'pickup' || entry === 'delivery')
      : []

    setHandoverModes(normalizedHandover.length > 0 ? normalizedHandover : ['pickup'])
    setValues({
      ...attributes,
      title: listing.title,
      description: listing.description || '',
      price: Number(listing.price),
      currency: listing.currency || 'XAF',
      adType: normalizeFlow(listing.flow) || '',
      email: listing.contact?.email || '',
      phone: listing.contact?.phone || '',
      phoneHidden: Boolean(listing.contact?.phoneHidden),
      phone_hidden_information_text: Boolean(listing.contact?.phoneHidden),
      noSalesmen: Boolean(listing.contact?.noSalesmen),
      no_salesmen: Boolean(listing.contact?.noSalesmen),
      customRef: String(listing.meta?.customRef ?? ''),
      custom_ref: String(listing.meta?.customRef ?? '')
    })

    setLocationState({
      input: listing.location?.address || listing.location?.city || '',
      cityId: listing.location?.cityId,
      neighborhoodId: listing.location?.neighborhoodId,
      city: listing.location?.city,
      zipcode: listing.location?.zipcode,
      lat: listing.location?.lat,
      lng: listing.location?.lng,
      hideExact: Boolean(listing.location?.hideExact)
    })

    setImages(
      (listing.images ?? [])
        .map((item, index) => {
          const uri = typeof item === 'string' ? item : item.url || ''
          if (!uri) return null
          const isCover = typeof item === 'string' ? index === 0 : Boolean(item.isCover)
          return {
            id: `remote-${index}-${uri}`,
            uri,
            isCover,
            remote: true
          } satisfies EditorImage
        })
        .filter((item): item is EditorImage => Boolean(item))
    )
  }, [categories, listingQuery.data, mode, parentCategories])

  useEffect(() => {
    if (!selectedRootCategoryId || !selectedCategoryHasChildren) {
      setShowSubCategorySlider(false)
    }
  }, [selectedCategoryHasChildren, selectedRootCategoryId])

  useEffect(() => {
    if (!showSubCategorySlider) {
      subCategoryRevealAnim.setValue(0)
      return
    }
    subCategoryRevealAnim.setValue(0)
    Animated.timing(subCategoryRevealAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true
    }).start()
  }, [showSubCategorySlider, subCategoryRevealAnim, selectedRootCategoryId])

  useEffect(() => {
    if (!currentStep) return

    const previousStepIndex = previousStepIndexRef.current
    stepTransitionDirectionRef.current = activeStepIndex >= previousStepIndex ? 1 : -1
    previousStepIndexRef.current = activeStepIndex

    stepTransitionAnim.stopAnimation()
    stepTransitionAnim.setValue(0)
    Animated.timing(stepTransitionAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true
    }).start()
  }, [activeStepIndex, currentStep, stepTransitionAnim])

  useEffect(() => {
    if (!pendingScrollToStepRef.current) return
    if (!selectedAdType || wizardSteps.length === 0) return
    if (stepStartY === null) return

    const targetY = Math.max(stepStartY - (insets.top + spacing.md), 0)
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: targetY, animated: true })
      pendingScrollToStepRef.current = false
    }, 80)

    return () => clearTimeout(timer)
  }, [insets.top, selectedAdType, stepStartY, wizardSteps.length])

  const setValue = (name: string, value: string | number | boolean | string[]) => {
    setValues(previous => ({ ...previous, [name]: value }))
  }

  const toggleMultiValue = (name: string, optionValue: string) => {
    const current = values[name]
    const next = Array.isArray(current) ? [...current] : []
    const index = next.findIndex(entry => entry === optionValue)
    if (index >= 0) {
      next.splice(index, 1)
    } else {
      next.push(optionValue)
    }
    setValue(name, next)
  }

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission requise', 'Autorise la galerie pour ajouter des photos.')
      return
    }

    const remainingSlots = Math.max(0, 8 - images.length)
    if (remainingSlots === 0) {
      Alert.alert('Limite atteinte', 'Tu peux ajouter jusqu a 8 images.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remainingSlots
    })

    if (result.canceled) {
      return
    }

    const nextImages: EditorImage[] = result.assets.slice(0, remainingSlots).map((asset, index) => ({
      id: `local-${Date.now()}-${index}`,
      uri: asset.uri,
      isCover: images.length === 0 && index === 0,
      remote: false
    }))

    setImages(previous => {
      const merged = [...previous, ...nextImages]
      if (!merged.some(item => item.isCover) && merged[0]) {
        merged[0] = { ...merged[0], isCover: true }
      }
      return merged
    })
  }

  const markAsCover = (id: string) => {
    setImages(previous => previous.map(item => ({ ...item, isCover: item.id === id })))
  }

  const removeImage = (id: string) => {
    setImages(previous => {
      const filtered = previous.filter(item => item.id !== id)
      if (filtered.length > 0 && !filtered.some(item => item.isCover)) {
        filtered[0] = { ...filtered[0], isCover: true }
      }
      return filtered
    })
  }

  const resolveFieldValue = (fieldName: string): unknown => {
    const normalizedName = normalizeString(fieldName).toLowerCase()
    if (normalizedName === 'city') return locationState.city || values.city || ''
    if (normalizedName === 'zipcode' || normalizedName === 'zip') return locationState.zipcode || ''
    if (normalizedName === 'address' || normalizedName === 'location' || normalizedName === 'localisation') {
      return locationState.input
    }
    if (normalizedName === 'lat' || normalizedName === 'latitude') return locationState.lat
    if (normalizedName === 'lng' || normalizedName === 'longitude' || normalizedName === 'lon') return locationState.lng
    if (normalizedName === 'adtype' || normalizedName === 'flow') return selectedAdType
    return values[fieldName]
  }

  const shouldDisplayField = (field: ListingFormField): boolean => {
    if (!isListingFormFieldEnabled(field)) {
      return false
    }

    const visibility = (field as { visibility?: VisibilityCondition[] }).visibility
    if (!visibility || visibility.length === 0) {
      return true
    }
    return visibility.every(condition => matchVisibility(resolveFieldValue(condition.field), condition))
  }

  const resolveFieldOptions = (field: ListingFormField): { value: string; label: string }[] => {
    const dependsOn = field.dependsOn
    const conditionalOptions = field.conditionalOptions

    if (!dependsOn || !conditionalOptions) {
      return field.options ?? []
    }

    const rawDependency = resolveFieldValue(dependsOn)
    const candidateKeys = [
      rawDependency,
      typeof rawDependency === 'string' ? rawDependency.trim() : undefined,
      typeof rawDependency === 'string' ? rawDependency.trim().toLowerCase() : undefined,
      typeof rawDependency === 'string' ? rawDependency.trim().toUpperCase() : undefined
    ]
      .filter(Boolean)
      .map(entry => String(entry))

    for (const key of candidateKeys) {
      const options = conditionalOptions[key]
      if (Array.isArray(options) && options.length > 0) {
        return options
      }
    }

    return []
  }

  const isFieldDependencySatisfied = (field: ListingFormField): boolean => {
    if (!field.dependsOn) return true
    return !isEmptyValue(resolveFieldValue(field.dependsOn))
  }

  const getFieldPlaceholder = (field: ListingFormField): string => {
    if (typeof field.ui?.placeholder === 'string' && field.ui.placeholder.trim().length > 0) {
      return field.ui.placeholder.trim()
    }
    if (normalizeFlow(field.type) === 'date') {
      return 'JJ/MM/AAAA'
    }
    return field.label
  }

  const getFieldHint = (field: ListingFormField): string | null => {
    const infoEntries = Array.isArray(field.info) ? field.info.map(entry => normalizeString(entry)).filter(Boolean) : []
    const tooltipEntries = Array.isArray(field.tooltip)
      ? field.tooltip.map(entry => normalizeString(entry)).filter(Boolean)
      : []
    const entries = [...infoEntries, ...tooltipEntries]
    if (entries.length > 0) return entries.join(' · ')
    return null
  }

  const failStepValidation = (message: string) => {
    setSubmissionError(message)
    Alert.alert('Etape incomplete', message)
    return false
  }

  const validateDynamicStep = (step: ListingFormSchema['steps'][number]): boolean => {
    for (const field of step.fields) {
      if (!shouldDisplayField(field)) continue
      if (isMapControlField(field)) continue

      const mandatory = Boolean(field.rules?.mandatory)
      const value = resolveFieldValue(field.name)
      const type = normalizeFlow(field.type)
      const stringValue = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
      const numericValue = toNumber(value)

      if (isLocationField(field)) {
        if (mandatory && (!locationState.input.trim() || locationState.lat === undefined || locationState.lng === undefined)) {
          return failStepValidation('Selectionne une localisation valide depuis les suggestions.')
        }
        continue
      }

      if (type === 'checkbox' || type === 'switch') {
        if (mandatory && !toBoolean(value)) {
          return failStepValidation(field.rules?.err_mandatory || `Le champ "${field.label}" est obligatoire.`)
        }
        continue
      }

      if (type === 'chips' || type === 'multiselect') {
        if (mandatory && (!Array.isArray(value) || value.length === 0)) {
          return failStepValidation(field.rules?.err_mandatory || `Selectionne au moins une valeur pour "${field.label}".`)
        }
        continue
      }

      if (mandatory && isEmptyValue(value)) {
        return failStepValidation(field.rules?.err_mandatory || `Le champ "${field.label}" est obligatoire.`)
      }

      if (isEmptyValue(value)) continue

      const minLength = field.rules?.min_length
      if (typeof minLength === 'number' && stringValue && stringValue.length < minLength) {
        return failStepValidation(`Le champ "${field.label}" doit contenir au moins ${minLength} caracteres.`)
      }

      const maxLength = field.rules?.max_length
      if (typeof maxLength === 'number' && stringValue && stringValue.length > maxLength) {
        return failStepValidation(`Le champ "${field.label}" ne doit pas depasser ${maxLength} caracteres.`)
      }

      if (typeof field.rules?.min === 'number' && numericValue !== undefined && numericValue < field.rules.min) {
        return failStepValidation(`Le champ "${field.label}" doit etre superieur ou egal a ${field.rules.min}.`)
      }

      if (typeof field.rules?.max === 'number' && numericValue !== undefined && numericValue > field.rules.max) {
        return failStepValidation(`Le champ "${field.label}" doit etre inferieur ou egal a ${field.rules.max}.`)
      }

      if (typeof field.rules?.regexp === 'string' && stringValue) {
        try {
          const normalizedPattern = normalizeRegexpPattern(field.rules.regexp)
          const regex = new RegExp(normalizedPattern.pattern, normalizedPattern.flags)
          if (!regex.test(stringValue)) {
            return failStepValidation(field.rules.err_regexp || `Le champ "${field.label}" est invalide.`)
          }
        } catch {
          // Ignore invalid patterns coming from the schema and keep the form usable.
        }
      }
    }

    return true
  }

  const handleStepSelect = (index: number) => {
    if (!wizardSteps.length) return
    if (index < 0 || index >= wizardSteps.length) return
    if (index > maxUnlockedStepIndex) return
    setActiveStepIndex(index)
  }

  const handleNextStep = () => {
    if (!wizardSteps.length) return
    const step = wizardSteps[activeStepIndex]
    if (!step) return
    if (step.kind === 'dynamic' && !validateDynamicStep(step.schemaStep)) {
      return
    }

    const nextIndex = activeStepIndex + 1
    if (nextIndex < wizardSteps.length) {
      setActiveStepIndex(nextIndex)
      setMaxUnlockedStepIndex(previous => Math.max(previous, nextIndex))
      setSubmissionError(null)
    }
  }

  const handlePreviousStep = () => {
    if (activeStepIndex === 0) return
    setActiveStepIndex(previous => Math.max(previous - 1, 0))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const categoryId = selectedRootCategoryId || selectedCategoryId
      const subCategoryId = selectedCategoryId || undefined
      const dynamicSteps = wizardSteps.filter(
        (step): step is Extract<StepDescriptor, { kind: 'dynamic' }> => step.kind === 'dynamic'
      )
      const hasSubjectField = dynamicSteps.some(step => step.schemaStep.fields.some(field => field.name === 'subject'))
      const hasBodyField = dynamicSteps.some(step => step.schemaStep.fields.some(field => field.name === 'body'))

      const title = normalizeString(
        hasSubjectField ? values.subject ?? values.title : values.title ?? values.subject
      )
      const description = normalizeString(
        hasBodyField ? values.body ?? values.description : values.description ?? values.body
      )
      const priceAmount = toNumber(values.price ?? values.amount)
      const currency = normalizeString(values.currency).toUpperCase() || 'XAF'
      const adType = selectedAdType || normalizeFlow(values.adType) || undefined

      if (!categoryId || !selectedCategoryId) {
        throw new Error('Selectionne une categorie puis une sous categorie.')
      }
      if (!title || title.length < 3) {
        throw new Error('Le titre doit contenir au moins 3 caracteres.')
      }
      if (!description || description.length < 10) {
        throw new Error('La description doit contenir au moins 10 caracteres.')
      }
      if (priceAmount === undefined || priceAmount < 0) {
        throw new Error('Le prix est invalide.')
      }
      if (locationState.input.trim() && (locationState.lat === undefined || locationState.lng === undefined)) {
        throw new Error('Selectionne une suggestion de localisation valide.')
      }

      setUploading(true)

      const uploadedUrls: string[] = []
      for (const image of images) {
        if (image.remote) {
          uploadedUrls.push(image.uri)
          continue
        }
        const uploaded = await mediaApi.uploadImage(image.uri)
        uploadedUrls.push(uploaded.url)
      }

      const imagesPayload: ListingImagePayload[] = uploadedUrls.slice(0, 8).map((url, index) => ({
        url,
        position: index,
        isCover: images[index]?.isCover ?? index === 0
      }))

      const attributes: Record<string, unknown> = {}
      Object.entries(values).forEach(([key, value]) => {
        if (knownPayloadKeys.has(key)) return
        attributes[key] = value
      })
      attributes.handover_modes = handoverModes.length ? handoverModes : ['pickup']

      const customRef = normalizeString(values.customRef ?? values.custom_ref)
      const phoneHidden = toBoolean(values.phoneHidden ?? values.phone_hidden_information_text)
      const noSalesmen = toBoolean(values.noSalesmen ?? values.no_salesmen)
      const newItemPrice = toNumber(values.newItemPrice ?? values.new_item_price)

      const payload = {
        categoryId,
        subCategoryId,
        adType,
        title,
        description,
        price: {
          amount: priceAmount,
          currency,
          ...(newItemPrice !== undefined ? { newItemPrice } : {})
        },
        location: {
          cityId: locationState.cityId,
          neighborhoodId: locationState.neighborhoodId,
          city: locationState.city || normalizeString(values.city) || undefined,
          zipcode: locationState.zipcode || normalizeString(values.zipcode) || undefined,
          address: locationState.input || undefined,
          lat: locationState.lat,
          lng: locationState.lng,
          hideExact: Boolean(locationState.hideExact)
        },
        contact: {
          email: normalizeString(values.email),
          phone: normalizeString(values.phone),
          phoneHidden,
          noSalesmen
        },
        attributes,
        meta: customRef ? { customRef } : undefined,
        images: imagesPayload
      }

      if (mode === 'edit' && listingId) {
        return listingsApi.update(listingId, payload)
      }

      return listingsApi.create(payload)
    },
    onSuccess: listing => {
      queryClient.invalidateQueries({ queryKey: ['listings', 'mine'] })
      queryClient.invalidateQueries({ queryKey: ['listings', 'latest'] })
      if (mode === 'edit') {
        Alert.alert('Annonce', 'Modifications enregistrees.')
        router.back()
      } else {
        Alert.alert('Annonce', 'Annonce creee avec succes.')
        router.replace(`/listings/${listing.id}/edit`)
      }
    },
    onError: error => {
      setSubmissionError(error instanceof Error ? error.message : 'Erreur pendant la sauvegarde')
    },
    onSettled: () => {
      setUploading(false)
    }
  })

  const renderLocationBlock = () => {
    const suggestions = suggestionsQuery.data ?? []
    const mapPreviewUrl = buildEditorMapboxStaticUrl(locationState)
    const hasCoordinates = typeof locationState.lat === 'number' && typeof locationState.lng === 'number'
    const locationLabel = locationState.city
      ? [locationState.input || locationState.city, locationState.zipcode].filter(Boolean).join(' • ')
      : 'Saisis une ville ou un quartier puis choisis une suggestion.'

    return (
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Localisation</Text>
        <Text style={styles.helpText}>Recherche une ville ou un quartier, puis choisis une suggestion valide pour positionner l annonce.</Text>
        <TextInput
          value={locationState.input}
          onChangeText={text => {
            setLocationState(previous => ({
              ...previous,
              input: text,
              cityId: undefined,
              neighborhoodId: undefined,
              city: undefined,
              zipcode: undefined,
              lat: undefined,
              lng: undefined
            }))
            setLocationQuery(text)
          }}
          placeholder="Ex: Ndogbong, Douala"
          style={styles.input}
        />

        {suggestions.length > 0 ? (
          <View style={styles.suggestionsBox}>
            {suggestions.map(item => {
              const primary = getTextFromLabel(item.label)
              const city = item.city || item.context?.split(',')[0] || ''
              const label = city ? `${primary}, ${city}` : primary
              return (
                <Pressable
                  key={item.id}
                  style={styles.suggestionRow}
                  onPress={() => {
                    setLocationQuery(label)
                    setLocationState(previous => ({
                      ...previous,
                      input: label,
                      city: item.city || city,
                      cityId: item.cityId,
                      neighborhoodId: item.neighborhoodId,
                      zipcode: item.zipcode || undefined,
                      lat: item.coordinates?.[1],
                      lng: item.coordinates?.[0]
                    }))
                  }}
                >
                  <Text style={styles.suggestionMain}>{label}</Text>
                  <Text style={styles.suggestionMeta}>{item.kind === 'neighborhood' ? 'Quartier' : 'Ville'}</Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}

        <View style={styles.locationPreviewCard}>
          {mapPreviewUrl ? (
            <Image source={{ uri: mapPreviewUrl }} style={styles.locationPreviewMap} />
          ) : (
            <View style={[styles.locationPreviewMap, styles.locationPreviewFallback]}>
              <Ionicons name="map-outline" size={22} color={colors.accent} />
              <Text style={styles.locationPreviewFallbackTitle}>
                {MAPBOX_TOKEN ? 'Carte centrée sur le Cameroun' : 'Carte indisponible'}
              </Text>
              <Text style={styles.locationPreviewFallbackText}>
                {MAPBOX_TOKEN
                  ? 'Choisis une suggestion pour centrer la carte sur la zone sélectionnée.'
                  : 'Ajoute EXPO_PUBLIC_MAPBOX_TOKEN dans le .env mobile pour afficher la carte Mapbox.'}
              </Text>
            </View>
          )}
          <View style={styles.locationPreviewMeta}>
            <Text style={styles.locationPreviewLabel}>{locationLabel}</Text>
            <Text style={styles.locationPreviewHint}>
              {hasCoordinates ? 'Position validée à partir de la suggestion sélectionnée.' : 'Aucune coordonnée validée pour le moment.'}
            </Text>
          </View>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Masquer l adresse exacte</Text>
          <Switch
            value={Boolean(locationState.hideExact)}
            onValueChange={value => setLocationState(previous => ({ ...previous, hideExact: value }))}
          />
        </View>
      </View>
    )
  }

  const renderField = (field: ListingFormField) => {
    const value = values[field.name]
    const type = normalizeFlow(field.type)
    const options = resolveFieldOptions(field)
    const placeholder = getFieldPlaceholder(field)
    const dependencySatisfied = isFieldDependencySatisfied(field)
    const fieldDisabled = Boolean(field.ui?.disabledUntilDependsOnFilled && !dependencySatisfied)
    const normalizedFieldName = normalizeString(field.name).toLowerCase()
    const isPriceField = type === 'number' && ['price', 'amount'].includes(normalizedFieldName)
    const priceSuggestion = priceSuggestionQuery.data

    const renderPriceSuggestion = (suggestion: PriceSuggestion | undefined) => (
      <View style={styles.priceSuggestionCard}>
        {priceSuggestionQuery.isLoading ? (
          <Text style={styles.priceSuggestionHint}>Suggestion de prix en cours de chargement...</Text>
        ) : suggestion && suggestion.suggested !== null ? (
          <>
            <View style={styles.priceSuggestionHeader}>
              <Text style={styles.priceSuggestionTitle}>
                Prix conseille : {formatAmount(suggestion.suggested, suggestion.currency)}
              </Text>
              <Pressable
                onPress={() => {
                  setValue(field.name, suggestion.suggested ?? '')
                  setValue('currency', suggestion.currency || 'XAF')
                }}
                style={styles.priceSuggestionApplyButton}
              >
                <Text style={styles.priceSuggestionApplyButtonText}>Appliquer</Text>
              </Pressable>
            </View>
            <Text style={styles.priceSuggestionMeta}>
              Fourchette : {formatAmount(suggestion.min, suggestion.currency) ?? '-'} a{' '}
              {formatAmount(suggestion.max, suggestion.currency) ?? '-'}
              {suggestion.sampleSize ? ` · ${suggestion.sampleSize} annonces comparees` : ''}
            </Text>
            <Text style={styles.priceSuggestionHint}>
              Cette estimation s adapte a la categorie choisie{locationState.city ? ` et a ${locationState.city}` : ''}.
            </Text>
          </>
        ) : (
          <Text style={styles.priceSuggestionHint}>
            Aucune suggestion de prix disponible pour le moment avec cette categorie.
          </Text>
        )}
      </View>
    )

    if (type === 'textarea') {
      return (
        <TextInput
          value={typeof value === 'string' ? value : ''}
          onChangeText={text => setValue(field.name, text)}
          style={[styles.input, styles.textarea, fieldDisabled && styles.inputDisabled]}
          multiline
          numberOfLines={typeof field.rows === 'number' && field.rows > 0 ? field.rows : 6}
          placeholder={placeholder}
          editable={!fieldDisabled}
        />
      )
    }

    if (type === 'checkbox' || type === 'switch') {
      return (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{field.label}</Text>
          <Switch value={toBoolean(value)} onValueChange={next => setValue(field.name, next)} disabled={fieldDisabled} />
        </View>
      )
    }

    if (type === 'select' || type === 'radio') {
      const currentValue = String(value ?? '')
      return (
        <View style={styles.optionsContainer}>
          {options.map(option => {
            const selected = currentValue === option.value
            return (
              <Pressable
                key={option.value}
                disabled={fieldDisabled}
                onPress={() => setValue(field.name, option.value)}
                style={[styles.optionChip, selected && styles.optionChipSelected, fieldDisabled && styles.disabledOptionChip]}
              >
                <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{option.label}</Text>
              </Pressable>
            )
          })}
          {fieldDisabled || options.length === 0 ? (
            <Text style={styles.helpText}>Selectionne d abord le champ parent pour afficher les options.</Text>
          ) : null}
        </View>
      )
    }

    if (type === 'multiselect' || type === 'chips') {
      const selectedValues = Array.isArray(value) ? value : []
      return (
        <View style={styles.optionsContainer}>
          {options.map(option => {
            const selected = selectedValues.includes(option.value)
            return (
              <Pressable
                key={option.value}
                disabled={fieldDisabled}
                onPress={() => toggleMultiValue(field.name, option.value)}
                style={[styles.optionChip, selected && styles.optionChipSelected, fieldDisabled && styles.disabledOptionChip]}
              >
                <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{option.label}</Text>
              </Pressable>
            )
          })}
          {fieldDisabled ? <Text style={styles.helpText}>Selectionne d abord le champ parent pour afficher les options.</Text> : null}
        </View>
      )
    }

    const keyboardType =
      type === 'number'
        ? Platform.select({ ios: 'decimal-pad', android: 'numeric', default: 'numeric' })
        : type === 'email'
        ? 'email-address'
        : type === 'date'
        ? 'numbers-and-punctuation'
        : 'default'
    return (
      <View style={styles.fieldControlStack}>
        <View style={[styles.inputRow, fieldDisabled && styles.inputDisabled]}>
          <TextInput
            value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
            onChangeText={text => setValue(field.name, type === 'number' ? text.replace(',', '.') : text)}
            style={[styles.input, styles.inputInRow]}
            placeholder={placeholder}
            keyboardType={keyboardType as never}
            autoCapitalize={type === 'email' ? 'none' : 'sentences'}
            editable={!fieldDisabled}
          />
          {field.unit ? (
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>{field.unit}</Text>
            </View>
          ) : null}
        </View>
        {isPriceField ? renderPriceSuggestion(priceSuggestion) : null}
      </View>
    )
  }

  const renderCategorySection = () => (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>Categorie</Text>
      <Text style={styles.helpText}>1) Choisis une categorie parent. 2) Choisis une sous categorie.</Text>

      {showSubCategorySlider && selectedRootCategoryId && selectedCategoryHasChildren ? (
        <View style={styles.subSection}>
          <View style={styles.subCategoryHeader}>
            <View>
              <Text style={styles.subSectionTitle}>{selectedRootCategory?.name}</Text>
              <Text style={styles.helpText}>Selectionne la sous-categorie.</Text>
            </View>
            <Pressable
              onPress={() => {
                setShowSubCategorySlider(false)
                setSelectedRootCategoryId('')
                setSelectedCategoryId('')
                setSelectedAdType('')
                resetWizardProgressState()
                setHandoverModes(['pickup'])
              }}
              style={styles.changeParentButton}
            >
              <Text style={styles.changeParentText}>Changer</Text>
            </Pressable>
          </View>

          <Animated.View
            style={[
              styles.subCategoryAnimatedContainer,
              {
                opacity: subCategoryRevealAnim,
                transform: [
                  {
                    translateY: subCategoryRevealAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0]
                    })
                  }
                ]
              }
            ]}
          >
            <View style={styles.categoryList}>
              {subCategories.map(item => {
                const selected = selectedCategoryId === item.id
                const icon = item.icon ?? selectedRootCategory?.icon
                const palette = resolveCategoryPalette(item.color ?? selectedRootCategory?.color, selected)
                const iconUrl = resolveIconUrl(icon)
                const description = normalizeString(item.description)
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setSelectedCategoryId(item.id)
                      setSelectedAdType('')
                      resetWizardProgressState()
                      setHandoverModes(['pickup'])
                    }}
                    style={[styles.categoryRow, selected && styles.categoryRowSelected]}
                  >
                    <View style={styles.categoryRowContent}>
                      {icon && isLikelyGlyph(icon) ? (
                        <View
                          style={[
                            styles.categoryRowIconBadge,
                            { backgroundColor: palette.iconBg, borderColor: palette.iconBorder }
                          ]}
                        >
                          <Text style={styles.categoryRowIconText}>{icon}</Text>
                        </View>
                      ) : iconUrl ? (
                        <View
                          style={[
                            styles.categoryRowIconBadge,
                            { backgroundColor: palette.iconBg, borderColor: palette.iconBorder }
                          ]}
                        >
                          <Image source={{ uri: iconUrl }} style={styles.categoryRowIconImage} resizeMode="contain" />
                        </View>
                      ) : null}
                      <View style={styles.categoryRowMeta}>
                        <Text style={[styles.categoryRowText, selected && styles.categoryRowTextSelected]}>{item.name}</Text>
                        {description ? (
                          <Text style={styles.categoryRowDescription} numberOfLines={2}>
                            {description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={selected ? colors.primary : colors.muted} />
                  </Pressable>
                )
              })}
            </View>
          </Animated.View>
        </View>
      ) : (
        <View style={styles.categoryList}>
          {parentCategories.map(category => {
            const selected = category.id === selectedRootCategoryId
            const palette = resolveCategoryPalette(category.color, selected)
            const iconUrl = resolveIconUrl(category.icon)
            const description = normalizeString(category.description)
            return (
              <Pressable
                key={category.id}
                onPress={() => {
                  setSelectedRootCategoryId(category.id)
                  setSelectedAdType('')
                  resetWizardProgressState()
                  setHandoverModes(['pickup'])
                  if (category.children.length > 0) {
                    setSelectedCategoryId('')
                    setShowSubCategorySlider(true)
                  } else {
                    setSelectedCategoryId(category.id)
                    setShowSubCategorySlider(false)
                  }
                }}
                style={[
                  styles.categoryRow,
                  { borderColor: palette.borderColor },
                  selected && styles.categoryRowSelected
                ]}
              >
                <View style={styles.categoryRowContent}>
                  {category.icon && isLikelyGlyph(category.icon) ? (
                    <View
                      style={[
                        styles.categoryRowIconBadge,
                        { backgroundColor: palette.iconBg, borderColor: palette.iconBorder }
                      ]}
                    >
                      <Text style={styles.categoryRowIconText}>{category.icon}</Text>
                    </View>
                  ) : iconUrl ? (
                    <View
                      style={[
                        styles.categoryRowIconBadge,
                        { backgroundColor: palette.iconBg, borderColor: palette.iconBorder }
                      ]}
                    >
                      <Image source={{ uri: iconUrl }} style={styles.categoryRowIconImage} resizeMode="contain" />
                    </View>
                  ) : null}
                  <View style={styles.categoryRowMeta}>
                    <Text style={[styles.categoryRowText, selected && styles.categoryRowTextSelected]}>{category.name}</Text>
                    {description ? (
                      <Text style={styles.categoryRowDescription} numberOfLines={2}>
                        {description}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={selected ? colors.primary : colors.muted} />
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )

  const renderAdTypeSection = () => {
    if (!selectedCategoryId || adTypeOptions.length === 0) return null

    return (
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Type d annonce</Text>
        <View style={styles.verticalOptions}>
          {adTypeOptions.map(option => {
            const selected = selectedAdType === option.value
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  const nextAdType = selected ? '' : option.value
                  resetWizardProgressState()
                  pendingScrollToStepRef.current = nextAdType.length > 0
                  setSelectedAdType(nextAdType)
                }}
                style={[styles.verticalOption, selected && styles.verticalOptionSelected]}
              >
                <View style={styles.radioIndicator}>
                  <View style={[styles.radioDot, selected && styles.radioDotSelected]} />
                </View>
                <View style={styles.verticalOptionBody}>
                  <Text style={styles.verticalOptionTitle}>{option.label}</Text>
                  {option.description ? <Text style={styles.verticalOptionDescription}>{option.description}</Text> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }

  const renderSectionOverview = () => {
    if (!selectedCategoryId) return null

    if (schemaQuery.isLoading) {
      return (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Sections du formulaire</Text>
          <Text style={styles.helpText}>Chargement des sections...</Text>
        </View>
      )
    }

    if (requiresAdTypeSelection && !selectedAdType) {
      return (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Sections du formulaire</Text>
          <Text style={styles.helpText}>Selectionne un type d annonce pour debloquer les etapes.</Text>
        </View>
      )
    }

    if (!wizardSteps.length) return null

    return (
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Sections du formulaire</Text>
        <Text style={styles.helpText}>Complète chaque section pour publier l annonce, comme sur le web.</Text>
        <View style={styles.sectionsList}>
          {wizardSteps.map((step, index) => {
            const stateLabel =
              index < activeStepIndex
                ? 'Terminee'
                : index === activeStepIndex
                ? 'En cours'
                : index <= maxUnlockedStepIndex
                ? 'Disponible'
                : 'Verrouillee'

            return (
              <Pressable
                key={step.id}
                onPress={() => handleStepSelect(index)}
                disabled={index > maxUnlockedStepIndex}
                style={[
                  styles.sectionItem,
                  index === activeStepIndex && styles.sectionItemActive,
                  index > maxUnlockedStepIndex && styles.sectionItemLocked
                ]}
              >
                <Text style={styles.sectionBadge}>Etape {index + 1}</Text>
                <Text style={styles.sectionTitle}>{step.title}</Text>
                <Text style={styles.sectionState}>{stateLabel}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }

  const renderSchemaStep = (stepDescriptor: Extract<StepDescriptor, { kind: 'dynamic' }>) => {
    const step = stepDescriptor.schemaStep
    let locationRendered = false
    return (
      <View style={styles.block}>
        <Text style={styles.blockTitle}>{step.label || step.name || 'Informations'}</Text>
        {stepDescriptor.info.length > 0 ? (
          <View style={styles.stepInfoBox}>
            {stepDescriptor.info.map(info => (
              <Text key={info} style={styles.stepInfoText}>
                • {info}
              </Text>
            ))}
          </View>
        ) : null}
        {step.fields.map(field => {
          if (!shouldDisplayField(field)) return null
          const fieldHint = getFieldHint(field)

          if (isLocationField(field)) {
            if (locationRendered) return null
            locationRendered = true
            return <View key="location-block">{renderLocationBlock()}</View>
          }

          return (
            <View key={field.id} style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>
                {field.label}
                {field.rules?.mandatory ? <Text style={styles.requiredAsterisk}> *</Text> : null}
              </Text>
              {fieldHint ? <Text style={styles.fieldHint}>{fieldHint}</Text> : null}
              {renderField(field)}
            </View>
          )
        })}
      </View>
    )
  }

  const renderMediaStep = () => (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>Photos ({images.length}/8)</Text>
      <PrimaryButton label="Ajouter des images" onPress={() => void pickImages()} disabled={images.length >= 8} />
      <FlatList
        data={images}
        keyExtractor={item => item.id}
        horizontal
        contentContainerStyle={{ gap: spacing.md, marginTop: spacing.md }}
        renderItem={({ item }) => (
          <View style={styles.imageCard}>
            <Image source={{ uri: item.uri }} style={styles.imagePreview} />
            <Pressable onPress={() => markAsCover(item.id)}>
              <Text style={[styles.imageAction, item.isCover && styles.imageCover]}>Couverture</Text>
            </Pressable>
            <Pressable onPress={() => removeImage(item.id)}>
              <Text style={[styles.imageAction, { color: colors.danger }]}>Supprimer</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  )

  const canGoPrevious = activeStepIndex > 0
  const canGoNext = wizardSteps.length > 0 && activeStepIndex < wizardSteps.length - 1

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: footerSafePadding + footerVisualHeight
          }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageHeader}>
          <View style={styles.pageHero}>
            <Text style={styles.pageEyebrow}>Parcours guide</Text>
            <View style={styles.pageHeaderCopy}>
              <Text style={styles.pageTitle}>{mode === 'create' ? 'Créer une annonce' : 'Modifier l annonce'}</Text>
              <Text style={styles.pageSubtitle}>
                {mode === 'create'
                  ? 'Renseigne les informations de ton bien avec le meme parcours que sur le web.'
                  : 'Mets a jour ton annonce avec le meme parcours structure que sur le web.'}
              </Text>
            </View>
            <View style={styles.pageMetaRow}>
              <View style={styles.pageMetaBadge}>
                <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                <Text style={styles.pageMetaBadgeText}>Parcours structure, sections et photos</Text>
              </View>
            </View>
          </View>
          <Pressable style={styles.headerGhostButton} onPress={() => router.push('/dashboard/listings')}>
            <Text style={styles.headerGhostButtonText}>Voir mes annonces</Text>
          </Pressable>
        </View>

        {mode === 'edit' && listingQuery.isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
          </View>
        ) : null}

        {renderCategorySection()}
        {selectedCategoryId && (wizardSteps.length > 0 || schemaQuery.isLoading) ? (
          <Text style={styles.sectionsIntro}>Commence par choisir la categorie et le type d annonce, puis complete chaque etape.</Text>
        ) : null}
        {renderAdTypeSection()}
        {renderSectionOverview()}

        {currentStep ? (
          <View onLayout={event => setStepStartY(event.nativeEvent.layout.y)}>
            <View style={styles.stepHeaderCard}>
              <View style={styles.stepHeaderTop}>
                <Text style={styles.stepBadge}>Etape {activeStepIndex + 1} / {wizardSteps.length}</Text>
                <View style={styles.stepCounterPill}>
                  <Text style={styles.stepCounterText}>{currentStep.kind === 'media' ? 'Photos' : 'Informations'}</Text>
                </View>
              </View>
              <Text style={styles.stepTitle}>{currentStep.title}</Text>
              <Text style={styles.stepDescription}>
                {currentStep.kind === 'media'
                  ? 'Ajoute des visuels nets et choisis une couverture claire.'
                  : 'Complete cette section avant de passer a la suivante.'}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((activeStepIndex + 1) / wizardSteps.length) * 100}%` }]} />
              </View>
            </View>
          </View>
        ) : null}

        {currentStep ? (
          <Animated.View
            style={[
              styles.stepAnimatedContainer,
              {
                opacity: stepTransitionAnim,
                transform: [
                  {
                    translateY: stepTransitionAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [stepTransitionDirectionRef.current * 16, 0]
                    })
                  }
                ]
              }
            ]}
          >
            {currentStep.kind === 'dynamic' ? renderSchemaStep(currentStep) : renderMediaStep()}
          </Animated.View>
        ) : null}

        {submissionError ? <Text style={styles.errorText}>{submissionError}</Text> : null}
      </ScrollView>

      {wizardSteps.length > 0 ? (
        <View style={[styles.footerActions, { paddingBottom: footerSafePadding }]}>
          <Pressable
            disabled={!canGoPrevious || saveMutation.isPending || uploading}
            onPress={handlePreviousStep}
            style={[
              styles.secondaryButton,
              (!canGoPrevious || saveMutation.isPending || uploading) && styles.secondaryButtonDisabled
            ]}
          >
            <Text style={styles.secondaryButtonText}>Precedent</Text>
          </Pressable>

          {canGoNext ? (
            <Pressable
              disabled={saveMutation.isPending || uploading}
              onPress={handleNextStep}
              style={[styles.primaryButton, (saveMutation.isPending || uploading) && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryButtonText}>Suivant</Text>
            </Pressable>
          ) : (
            <PrimaryButton
              label={mode === 'create' ? 'Publier' : 'Enregistrer'}
              onPress={() => saveMutation.mutate()}
              loading={saveMutation.isPending || uploading}
            />
          )}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md
  },
  pageHeader: {
    gap: spacing.md
  },
  pageHero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primarySurfaceStrong,
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm
  },
  pageEyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightExtrabold,
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  pageHeaderCopy: {
    gap: spacing.xs
  },
  pageTitle: {
    color: colors.text,
    fontSize: typography.titleLg,
    fontWeight: typography.weightExtrabold
  },
  pageSubtitle: {
    color: colors.muted,
    fontSize: typography.bodySm
  },
  pageMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  pageMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  pageMetaBadgeText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  headerGhostButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    justifyContent: 'center'
  },
  headerGhostButtonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  sectionsIntro: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: -4,
    marginBottom: 4
  },
  stepHeaderCard: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.soft
  },
  stepHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  stepBadge: {
    color: colors.primary,
    fontWeight: typography.weightBold,
    textTransform: 'uppercase',
    fontSize: typography.caption
  },
  stepCounterPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  stepCounterText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  stepTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: typography.weightExtrabold
  },
  stepDescription: {
    color: colors.muted,
    fontSize: typography.caption
  },
  progressTrack: {
    marginTop: spacing.xs,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary
  },
  stepAnimatedContainer: {
    gap: spacing.md
  },
  block: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.soft
  },
  blockTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.body
  },
  subSection: {
    gap: spacing.sm
  },
  subCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  changeParentButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  changeParentText: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  subSectionTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  subCategoryAnimatedContainer: {
    paddingTop: spacing.xs
  },
  helpText: {
    color: colors.muted,
    fontSize: typography.caption
  },
  stepInfoBox: {
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4
  },
  stepInfoText: {
    color: colors.text,
    fontSize: typography.caption
  },
  fieldWrapper: {
    gap: spacing.sm
  },
  fieldControlStack: {
    gap: spacing.sm
  },
  fieldLabel: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  fieldHint: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: -2
  },
  requiredAsterisk: {
    color: colors.danger,
    fontWeight: typography.weightBold
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.bodySm
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    gap: spacing.sm
  },
  inputInRow: {
    flex: 1,
    minHeight: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0
  },
  inputDisabled: {
    opacity: 0.55
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: spacing.md
  },
  unitBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  unitBadgeText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  priceSuggestionCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs
  },
  priceSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  priceSuggestionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  priceSuggestionMeta: {
    color: colors.muted,
    fontSize: typography.caption
  },
  priceSuggestionHint: {
    color: colors.muted,
    fontSize: typography.caption
  },
  priceSuggestionApplyButton: {
    minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  priceSuggestionApplyButtonText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  categoryList: {
    gap: spacing.sm
  },
  categoryRow: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  categoryRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface
  },
  categoryRowContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1
  },
  categoryRowMeta: {
    flex: 1,
    gap: 2
  },
  categoryRowIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryRowIconText: {
    fontSize: typography.bodySm,
    lineHeight: 16
  },
  categoryRowIconImage: {
    width: 16,
    height: 16
  },
  categoryRowText: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  categoryRowTextSelected: {
    color: colors.primary
  },
  categoryRowDescription: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 16
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised
  },
  optionChipSelected: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary
  },
  disabledOptionChip: {
    opacity: 0.45
  },
  optionChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  optionChipIconBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  optionChipIconText: {
    fontSize: 14,
    lineHeight: 16
  },
  optionChipText: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  optionChipTextSelected: {
    color: colors.primary
  },
  verticalOptions: {
    gap: spacing.sm
  },
  verticalOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  verticalOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface
  },
  radioIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent'
  },
  radioDotSelected: {
    backgroundColor: colors.primary
  },
  verticalOptionBody: {
    flex: 1,
    gap: 4
  },
  verticalOptionTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  verticalOptionDescription: {
    color: colors.muted,
    fontSize: typography.caption
  },
  suggestionsBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised
  },
  suggestionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted
  },
  suggestionMain: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  suggestionMeta: {
    color: colors.muted,
    fontSize: typography.caption,
    marginTop: 2
  },
  locationPreviewCard: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised
  },
  locationPreviewMap: {
    width: '100%',
    height: 172,
    backgroundColor: colors.surfaceMuted
  },
  locationPreviewFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg
  },
  locationPreviewFallbackTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  locationPreviewFallbackText: {
    color: colors.muted,
    fontSize: typography.caption,
    textAlign: 'center'
  },
  locationPreviewMeta: {
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  locationPreviewLabel: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  locationPreviewHint: {
    color: colors.muted,
    fontSize: typography.caption
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  switchLabel: {
    flex: 1,
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  sectionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm
  },
  sectionItem: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 4,
    backgroundColor: colors.surfaceRaised
  },
  sectionItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
    ...shadows.soft
  },
  sectionItemLocked: {
    opacity: 0.55
  },
  sectionBadge: {
    color: colors.primary,
    fontWeight: typography.weightBold,
    fontSize: typography.caption
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  sectionState: {
    color: colors.muted,
    fontSize: typography.caption,
    textTransform: 'uppercase'
  },
  imageCard: {
    width: 130,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised
  },
  imagePreview: {
    width: '100%',
    height: 90
  },
  imageAction: {
    textAlign: 'center',
    paddingVertical: 6,
    fontWeight: typography.weightBold,
    color: colors.text,
    fontSize: typography.caption
  },
  imageCover: {
    color: colors.primary
  },
  errorText: {
    color: colors.danger,
    fontWeight: typography.weightBold,
    fontSize: typography.caption,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerSoftStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl
  },
  footerActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.soft
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg
  },
  secondaryButtonDisabled: {
    opacity: 0.5
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    ...shadows.soft
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold
  }
})
