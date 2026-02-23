import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Controller, FormProvider, useForm, type FieldErrors } from 'react-hook-form'

import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { ImagesManager, type ListingImageFormItem } from '../../components/listings/ImagesManager'
import { DynamicFormStep, isCoordinateStep } from '../../components/forms/DynamicFormStep'
import { FormStepper } from '../../components/forms/FormStepper'

import { apiDelete, apiGet, apiPatch } from '../../utils/api'
import { resolveMediaUrl } from '../../utils/media'

import { useListingFormSchema, type FormSchemaDTO } from '../../hooks/useListingFormSchema'
import { useCategoryHierarchy } from '../../hooks/useCategoryHierarchy'
import { usePriceSuggestion } from '../../hooks/usePriceSuggestion'
import { useI18n } from '../../contexts/I18nContext'
import type { TranslationKey } from '../../i18n/translations'

import type { Category, FormStep } from '../../types/category'
import type { Listing } from '../../types/listing'
import type { ListingStatus } from '../../types/listing-status'
import { richTextToPlainText, sanitizeRichTextHtml } from '../../utils/richText'

import { ROOT_LISTING_FIELDS } from '../../constants/listingForm'

type SchemaStep = FormSchemaDTO['steps'][number] & Partial<FormStep>

const STATUS_OPTIONS: Array<{ value: ListingStatus; labelKey: TranslationKey }> = [
  { value: 'draft', labelKey: 'dashboard.listings.status.draft' },
  { value: 'pending', labelKey: 'dashboard.listings.status.pending' },
  { value: 'published', labelKey: 'dashboard.listings.status.published' },
  { value: 'archived', labelKey: 'dashboard.listings.status.archived' },
  { value: 'expired', labelKey: 'dashboard.listings.status.expired' },
  { value: 'rejected', labelKey: 'dashboard.listings.status.rejected' }
]

type EditListingFormValues = {
  categoryId: string
  subCategoryId?: string
  adType?: string | null
  title: string
  description: string
  subject?: string
  body?: string
  price: string
  currency: string
  city: string
  location: string
  details: Record<string, unknown>
  status: ListingStatus
  // Contact fields (for UI binding)
  email?: string
  phone?: string
  phone_hidden_information_text?: boolean | string
  locationHideExact?: boolean | string
}

type WizardStep =
  | {
      id: string
      label: string
      info: string[]
      kind: 'dynamic'
      formStep: SchemaStep
      isMapStep?: boolean
    }
  | {
      id: string
      label: string
      info: string[]
      kind: 'media'
    }

const INITIAL_FORM: EditListingFormValues = {
  categoryId: '',
  subCategoryId: '',
  adType: null,
  title: '',
  description: '',
  subject: '',
  body: '',
  price: '',
  currency: 'EUR',
  city: '',
  location: '',
  details: {},
  email: '',
  phone: '',
  phone_hidden_information_text: false,
  locationHideExact: false,
  status: 'draft'
}

const CATEGORY_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '16px',
  width: '100%'
}

const CATEGORY_CARD_ICON_STYLE: CSSProperties = {
  fontSize: '1.8rem',
  lineHeight: 1,
  marginBottom: '6px'
}

const CATEGORY_CARD_NAME_STYLE: CSSProperties = {
  fontWeight: 600,
  fontSize: '1rem',
  color: '#0f172a'
}

const CATEGORY_CARD_DESC_STYLE: CSSProperties = {
  fontSize: '0.85rem',
  color: '#6b7280',
  lineHeight: 1.4
}

const FORM_SECTIONS_WRAPPER_STYLE: CSSProperties = {
  marginTop: '28px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
}

const STEP_ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  marginTop: '18px'
}

const MEDIA_STEP_CARD_STYLE: CSSProperties = {
  background: '#ffffff',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 18px 36px rgba(15, 23, 42, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '18px'
}

const toTrimmedString = (value: unknown): string => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return false
    }
    return ['1', 'true', 'yes', 'oui', 'vrai'].includes(normalized)
  }
  return false
}

const sanitizeDetails = (details: Record<string, unknown>) => {
  return Object.entries(details).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        return acc
      }
      acc[key] = trimmed
      return acc
    }

    if (Array.isArray(value)) {
      const normalized = value
        .map(entry => (typeof entry === 'string' ? entry.trim() : entry))
        .filter(entry => {
          if (typeof entry === 'string') {
            return entry.length > 0
          }
          return entry !== undefined && entry !== null
        })
      if (!normalized.length) {
        return acc
      }
      acc[key] = normalized
      return acc
    }

    acc[key] = value
    return acc
  }, {})
}

const getDisplayName = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined
  }
  try {
    const url = new URL(value, window.location.origin)
    const segments = url.pathname.split('/')
    const lastSegment = segments[segments.length - 1]
    return lastSegment || value
  } catch {
    const cleaned = value.replace(/\\/g, '/').split('/')
    return cleaned[cleaned.length - 1] || value
  }
}

const toStringValue = (value: unknown, fallback = ''): string => {
  if (value === undefined || value === null) {
    return fallback
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'object') {
    const obj = value as { address?: string; city?: string; zipcode?: string }
    return obj.address || obj.city || obj.zipcode || fallback
  }
  return fallback
}

const toLocationString = (value: unknown): string => {
  if (value && typeof value === 'object') {
    const loc = value as {
      address?: string
      city?: string
      zipcode?: string
      postal_code?: string
      zipCode?: string
    }
    const city = loc.city
    const zip = loc.zipcode ?? loc.postal_code ?? loc.zipCode
    if (city && zip) {
      return `${city} (${zip})`
    }
    if (loc.address) {
      return loc.address
    }
    if (city) {
      return city
    }
    if (zip) {
      return zip
    }
  }
  return toStringValue(value, '')
}

const toArrayValue = (value: unknown): string | string[] => {
  if (Array.isArray(value)) {
    return value.map(entry => String(entry)).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
  }
  return ''
}

const cloneDetails = (details: Record<string, unknown>): Record<string, unknown> => {
  return Object.entries(details).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined) {
      return acc
    }
    if (Array.isArray(value)) {
      acc[key] = value.map(entry => entry)
      return acc
    }
    if (value && typeof value === 'object') {
      acc[key] = { ...(value as Record<string, unknown>) }
      return acc
    }
    acc[key] = value
    return acc
  }, {})
}

const mapListingToForm = (
  listing: Listing
): {
  formValues: EditListingFormValues
  sanitizedDetails: Record<string, unknown>
  rawDetails: Record<string, unknown>
} => {
  const detailsSource =
    (listing as any).details ??
    (listing as any).attributes ??
    (listing as any).formData ??
    (listing as any).form_data ??
    {}

  const rawDetails = cloneDetails(detailsSource)

  if (rawDetails.subject === undefined && listing.title) {
    rawDetails.subject = listing.title
  }
  if (rawDetails.body === undefined && listing.description) {
    rawDetails.body = listing.description
  }
  const rawHandoverModes = rawDetails.handover_modes
  if (Array.isArray(rawHandoverModes)) {
    if (!rawHandoverModes.length) {
      rawDetails.handover_modes = ['pickup']
    }
  } else if (typeof rawHandoverModes === 'string' && rawHandoverModes.trim()) {
    rawDetails.handover_modes = [rawHandoverModes.trim()]
  } else {
    rawDetails.handover_modes = ['pickup']
  }

  const contact =
    (listing as any).contact ||
    (rawDetails._contact as Record<string, unknown> | undefined) ||
    undefined

  if (contact && typeof contact === 'object') {
    const phone = (contact as { phone?: unknown }).phone
    const email = (contact as { email?: unknown }).email
    const phoneHidden = (contact as { phoneHidden?: unknown; phone_hidden?: unknown }).phoneHidden ??
      (contact as { phone_hidden?: unknown }).phone_hidden
    if (rawDetails.phone === undefined && phone !== undefined) {
      rawDetails.phone = phone
    }
    if (rawDetails.email === undefined && email !== undefined) {
      rawDetails.email = email
    }
    if (rawDetails.phone_hidden_information_text === undefined && phoneHidden !== undefined) {
      rawDetails.phone_hidden_information_text = phoneHidden
    }
  }

  const sanitizedDetails = Object.entries(rawDetails).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (ROOT_LISTING_FIELDS.has(key)) {
        return acc
      }
      if (value === undefined) {
        return acc
      }
      if (value && typeof value === 'object') {
        acc[key] = Array.isArray(value)
          ? value.map(entry => entry)
          : { ...(value as Record<string, unknown>) }
        return acc
      }
      acc[key] = value
      return acc
    },
    {}
  )

  const detailsWithRoots: Record<string, unknown> = { ...sanitizedDetails }
  if (rawDetails.subject !== undefined) {
    detailsWithRoots.subject = rawDetails.subject
  }
  if (rawDetails.body !== undefined) {
    detailsWithRoots.body = rawDetails.body
  }

  const dtoLocation =
    listing.location && typeof listing.location === 'object' ? (listing.location as Record<string, unknown>) : {}
  const rawLocationValue =
    rawDetails.location && typeof rawDetails.location === 'object'
      ? { ...(rawDetails.location as Record<string, unknown>) }
      : { ...dtoLocation }
  const rawLocationLabel =
    typeof (rawDetails as Record<string, unknown>).location_label === 'string'
      ? (rawDetails as Record<string, unknown>).location_label
      : undefined

  const locationAddress =
    typeof rawLocationLabel === 'string' && rawLocationLabel.trim()
      ? rawLocationLabel.trim()
      : typeof rawLocationValue.address === 'string' && rawLocationValue.address.trim()
      ? rawLocationValue.address.trim()
      : typeof dtoLocation.address === 'string'
      ? dtoLocation.address
      : ''

  const locationCity =
    typeof rawLocationValue.city === 'string'
      ? rawLocationValue.city
      : typeof dtoLocation.city === 'string'
      ? dtoLocation.city
      : ''

  const locationZip =
    typeof rawLocationValue.zipcode === 'string'
      ? rawLocationValue.zipcode
      : typeof (rawLocationValue as any).zipCode === 'string'
      ? (rawLocationValue as any).zipCode
      : typeof dtoLocation.zipcode === 'string'
      ? dtoLocation.zipcode
      : typeof (dtoLocation as any).zipCode === 'string'
      ? (dtoLocation as any).zipCode
      : ''

  const locationLabel = locationAddress || [locationCity, locationZip].filter(Boolean).join(' ')

  // Seed details so MapPicker sees an address on first render
  if (locationAddress) {
    detailsWithRoots.address = detailsWithRoots.address ?? locationAddress
    const existingLocation =
      detailsWithRoots.location && typeof detailsWithRoots.location === 'object'
        ? (detailsWithRoots.location as Record<string, unknown>)
        : {}
    detailsWithRoots.location = {
      address: locationAddress,
      city: locationCity || existingLocation.city,
      zipcode: locationZip || (existingLocation as any).zipcode || (existingLocation as any).zipCode,
      lat: dtoLocation.lat ?? (existingLocation as any).lat,
      lng: dtoLocation.lng ?? (existingLocation as any).lng
    }
    const latVal = dtoLocation.lat ?? (existingLocation as any).lat
    const lngVal = dtoLocation.lng ?? (existingLocation as any).lng
    if (latVal !== undefined) {
      detailsWithRoots.latitude = detailsWithRoots.latitude ?? latVal
      detailsWithRoots.lat = detailsWithRoots.lat ?? latVal
    }
    if (lngVal !== undefined) {
      detailsWithRoots.longitude = detailsWithRoots.longitude ?? lngVal
      detailsWithRoots.lng = detailsWithRoots.lng ?? lngVal
    }
  }

  const formValues: EditListingFormValues = {
    ...INITIAL_FORM,
    categoryId: listing.category?.id ?? '',
    subCategoryId: listing.category?.id ?? '',
    adType: (listing as any).flow ?? null,
    // Fallbacks for city from nested location
    // (Type narrowing to avoid unknown -> string errors)
  } as any

  const listingLocationCity =
    listing.location &&
    typeof listing.location === 'object' &&
    typeof (listing.location as Record<string, unknown>).city === 'string'
      ? ((listing.location as Record<string, unknown>).city as string)
      : undefined
  const listingLocationAddress =
    listing.location &&
    typeof listing.location === 'object' &&
    typeof (listing.location as Record<string, unknown>).address === 'string'
      ? ((listing.location as Record<string, unknown>).address as string)
      : undefined
  const listingHideExact =
    listing.location &&
    typeof listing.location === 'object' &&
    (listing.location as Record<string, unknown>).hideExact !== undefined
      ? Boolean((listing.location as Record<string, unknown>).hideExact)
      : false

  const resolvedLocationInput = locationLabel || toLocationString(rawLocationValue ?? listing.location ?? undefined) || ''

  const formValuesWithFields: EditListingFormValues = {
    ...formValues,
    title: toStringValue(rawDetails.title, listing.title),
    description: toStringValue(rawDetails.description, listing.description),
    price: toStringValue(rawDetails.price, listing.price),
    currency: toStringValue(rawDetails.currency, listing.currency || 'EUR') || 'EUR',
    city: toStringValue(
      rawDetails.city,
      listingLocationCity ?? listing.city ?? locationCity ?? undefined
    ),
    location: toStringValue(resolvedLocationInput, resolvedLocationInput),
    locationHideExact:
      typeof rawLocationValue.hideExact === 'boolean'
        ? rawLocationValue.hideExact
        : listingHideExact,
    subject: toStringValue(rawDetails.subject, listing.title),
    body: toStringValue(rawDetails.body, listing.description),
    details: detailsWithRoots,
    email: toStringValue(rawDetails.email, ''),
    phone: toStringValue(rawDetails.phone, ''),
    phone_hidden_information_text: toBoolean(rawDetails.phone_hidden_information_text),
    status: listing.status ?? 'draft'
  }

  return { formValues: formValuesWithFields, sanitizedDetails, rawDetails }
}

export default function EditListing() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const methods = useForm<EditListingFormValues>({
    defaultValues: INITIAL_FORM,
    mode: 'onChange'
  })

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    getValues,
    reset,
    trigger,
    formState: { isSubmitting: hookIsSubmitting, errors, dirtyFields }
  } = methods

  const [isLoadingListing, setIsLoadingListing] = useState(true)
  const {
    categories,
    rootCategories,
    categoriesLoading,
    categoriesError,
    childrenByParent,
    childrenLoading,
    loadChildren,
    ensureCategoryLoaded
  } = useCategoryHierarchy({ activeOnly: true })
  const categoryErrorRef = useRef<string | null>(null)
  const [images, setImages] = useState<ListingImageFormItem[]>([])
  const [pageError, setPageError] = useState<string | null>(null)
  const [schemaCategoryId, setSchemaCategoryId] = useState<string | null>(null)
  const [selectedRootCategoryId, setSelectedRootCategoryId] = useState('')
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [initialDetails, setInitialDetails] = useState<Record<string, unknown>>({})
  const [rawDetails, setRawDetails] = useState<Record<string, unknown>>({})
  const [listingFlow, setListingFlow] = useState<string | null>(null)
  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map(option => ({
        value: option.value,
        label: t(option.labelKey)
      })),
    [t]
  )
  const defaultMediaStepInfo = useMemo(
    () => [t('listings.edit.media.info.cover'), t('listings.edit.media.info.reorder')],
    [t]
  )

  const selectedCategoryId = watch('categoryId')
  const watchedCity = watch('city')
  const handoverModes = watch('details.handover_modes') as string[] | undefined
  const handoverError = (errors as any)?.details?.handover_modes?.message as string | undefined

  useEffect(() => {
    ensureCategoryLoaded(selectedCategoryId).catch(() => {
      /* handled */
    })
  }, [ensureCategoryLoaded, selectedCategoryId])

  useEffect(() => {
    if (!selectedCategoryId) {
      return
    }
    const currentCategory = categories.find(category => category.id === selectedCategoryId)
    if (!currentCategory) {
      return
    }
    if (currentCategory.parentId) {
      setSelectedRootCategoryId(currentCategory.parentId)
    } else {
      setSelectedRootCategoryId(currentCategory.id)
    }
  }, [categories, selectedCategoryId])

  useEffect(() => {
    if (!selectedRootCategoryId) {
      return
    }
    loadChildren(selectedRootCategoryId).catch(() => {
      /* handled */
    })
  }, [selectedRootCategoryId, loadChildren])

  useEffect(() => {
    if (categoriesError) {
      categoryErrorRef.current = categoriesError
      setPageError(prev => prev ?? categoriesError)
      return
    }
    if (categoryErrorRef.current && categories.length) {
      if (pageError === categoryErrorRef.current) {
        setPageError(null)
      }
      categoryErrorRef.current = null
    }
  }, [categoriesError, categories.length, pageError])

  useEffect(() => {
    if (
      selectedRootCategoryId &&
      !rootCategories.some(category => category.id === selectedRootCategoryId)
    ) {
      setSelectedRootCategoryId('')
    }
  }, [rootCategories, selectedRootCategoryId])

  const { schema, isLoading: isSchemaLoading, error: schemaError } = useListingFormSchema(
    schemaCategoryId
  )

  const { data: priceSuggestion, loading: priceSuggestionLoading } = usePriceSuggestion({
    categoryId: selectedRootCategoryId || selectedCategoryId || null,
    subCategoryId: selectedCategoryId || null,
    city: watchedCity || null,
    sampleSize: 200
  })

  const subCategories = useMemo(() => {
    if (!selectedRootCategoryId) {
      return []
    }
    return childrenByParent[selectedRootCategoryId] ?? []
  }, [childrenByParent, selectedRootCategoryId])

  const schemaSteps = useMemo<SchemaStep[]>(() => (schema?.steps as SchemaStep[]) ?? [], [schema?.steps])

  const normalizedFlow = listingFlow ? listingFlow.toLowerCase() : null

  const hasSelectedCategory = Boolean(selectedCategoryId)

  const availableHandoverModes = useMemo(() => {
    const source = (rawDetails as Record<string, unknown>).handover_modes
    if (Array.isArray(source)) {
      const normalized = source.map(mode => String(mode)).filter(Boolean)
      return normalized.length ? Array.from(new Set(normalized)) : ['pickup']
    }
    if (typeof source === 'string' && source.trim()) {
      return [source.trim()]
    }
    return ['pickup']
  }, [rawDetails])

  const shouldShowHandoverModes = hasSelectedCategory

  const wizardSteps = useMemo<WizardStep[]>(() => {
    const steps: WizardStep[] = []
    let hasCoordinateStep = false

    const filtered = schemaSteps.filter(step => {
      const stepFlow =
        typeof (step as any).flow === 'string'
          ? (step as any).flow.trim().toLowerCase()
          : null
      if (!stepFlow || !normalizedFlow) {
        return true
      }
      return stepFlow === normalizedFlow
    })

    filtered.forEach(step => {
      const coordinateLike = isCoordinateStep(step)
      const mapStep = coordinateLike && !hasCoordinateStep
      if (mapStep) {
        hasCoordinateStep = true
      }

      steps.push({
        id: step.id ?? step.name ?? `step-${steps.length}`,
        label: step.label ?? step.name ?? t('listings.edit.step.fallback'),
        info: Array.isArray(step.info)
          ? step.info.map(entry => String(entry))
          : step.info
          ? [String(step.info)]
          : [],
        kind: 'dynamic',
        formStep: step,
        isMapStep: mapStep
      })
    })

    if (selectedCategoryId) {
      steps.push({
        id: 'media',
        label: t('listings.edit.media.title'),
        info: defaultMediaStepInfo,
        kind: 'media'
      })
    }

    return steps
  }, [schemaSteps, selectedCategoryId, normalizedFlow, t, defaultMediaStepInfo])

  const currentStep = wizardSteps[activeStepIndex] ?? null

  const handleApplyPriceSuggestion = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return
      setValue('price', String(Math.round(value)), { shouldDirty: true, shouldValidate: true })
      if (priceSuggestion?.currency) {
        setValue('currency', priceSuggestion.currency, { shouldDirty: true, shouldValidate: false })
      }
    },
    [priceSuggestion?.currency, setValue]
  )

  const hasSteps = wizardSteps.length > 0

  const handleRootSelect = useCallback(
    (category: Category) => {
      setSelectedRootCategoryId(category.id)
      setValue('categoryId', '', { shouldDirty: true, shouldValidate: false })
      loadChildren(category.id)
        .then(children => {
          if (children.length === 0) {
            setValue('categoryId', category.id, { shouldDirty: true, shouldValidate: true })
          }
        })
        .catch(() => {
          setValue('categoryId', category.id, { shouldDirty: true, shouldValidate: true })
        })
    },
    [loadChildren, setValue]
  )

  const handleSubCategorySelect = useCallback(
    (category: Category) => {
      setValue('categoryId', category.id, { shouldDirty: true, shouldValidate: true })
    },
    [setValue]
  )

  const handleStepperChange = useCallback(
    (index: number) => {
      if (index < 0 || index >= wizardSteps.length) {
        return
      }
      setActiveStepIndex(index)
    },
    [wizardSteps.length]
  )

  const handlePreviousStep = useCallback(() => {
    setActiveStepIndex(prev => Math.max(prev - 1, 0))
  }, [])

  const handleNextStep = useCallback(async () => {
    const isValid = await trigger()
    if (!isValid) {
      return
    }
    setActiveStepIndex(prev => (prev + 1 < wizardSteps.length ? prev + 1 : prev))
  }, [trigger, wizardSteps.length])

  const resolveFirstErrorStep = useCallback(
    (formErrors: FieldErrors<EditListingFormValues>) => {
      const detailsErrors = formErrors.details as Record<string, unknown> | undefined
      return wizardSteps.findIndex(step => {
        if (step.kind !== 'dynamic') {
          return false
        }
        const fields = step.formStep.fields ?? []
        return fields.some(field => {
          const fieldName = field.name
          if (!fieldName) {
            return false
          }
          if (ROOT_LISTING_FIELDS.has(fieldName)) {
            return Boolean((formErrors as Record<string, unknown>)[fieldName])
          }
          return Boolean(detailsErrors && detailsErrors[fieldName])
        })
      })
    },
    [wizardSteps]
  )

  const handleInvalidSubmit = useCallback(
    (formErrors: FieldErrors<EditListingFormValues>) => {
      const stepIndex = resolveFirstErrorStep(formErrors)
      if (stepIndex >= 0) {
        setActiveStepIndex(stepIndex)
      }
      const message = formErrors.categoryId
        ? t('listings.edit.category.required')
        : t('listings.edit.validationError')
      setPageError(message)
      addToast({
        variant: 'error',
        title: t('listings.edit.validationErrorTitle'),
        message
      })
    },
    [addToast, resolveFirstErrorStep, t]
  )

  useEffect(() => {
    const categoryId = selectedCategoryId?.trim()
    setSchemaCategoryId(categoryId && categoryId.length ? categoryId : null)
  }, [selectedCategoryId])

useEffect(() => {
    if (!selectedRootCategoryId) {
      return
    }
    const childList = childrenByParent[selectedRootCategoryId] ?? []
    const currentCategoryId = getValues('categoryId')
    const isLoadingChildren = Boolean(childrenLoading[selectedRootCategoryId])

    if (!childList.length) {
      if (isLoadingChildren) {
        return
      }
      if (currentCategoryId !== selectedRootCategoryId) {
        setValue('categoryId', selectedRootCategoryId, { shouldDirty: false, shouldValidate: true })
      }
      return
    }

    if (!currentCategoryId || !childList.some(category => category.id === currentCategoryId)) {
      setValue('categoryId', '', { shouldDirty: false, shouldValidate: false })
    }
  }, [childrenByParent, childrenLoading, selectedRootCategoryId, getValues, setValue])

  useEffect(() => {
    if (!schemaSteps.length || !Object.keys(rawDetails).length) {
      return
    }

    schemaSteps.forEach(step => {
      step.fields.forEach(field => {
        const fieldName = field.name
        if (!fieldName) {
          return
        }

        let value = (rawDetails as Record<string, unknown>)[fieldName]
        if (value === undefined && rawDetails.location && typeof rawDetails.location === 'object') {
          const locationDetails = rawDetails.location as Record<string, unknown>
          if (fieldName in locationDetails) {
            value = locationDetails[fieldName]
          }
        }
        if (value !== undefined) {
          const path = ROOT_LISTING_FIELDS.has(fieldName)
            ? (fieldName as keyof EditListingFormValues)
            : (`details.${fieldName}` as const)
          setValue(path as never, value as never, {
            shouldDirty: false,
            shouldValidate: false
          })
        }
      })
    })
  }, [schemaSteps, rawDetails, setValue])

  useEffect(() => {
    if (!id) {
      setPageError(t('listings.edit.missingId'))
      setIsLoadingListing(false)
      return
    }

    let isMounted = true
    const controller = new AbortController()

    setIsLoadingListing(true)
    setPageError(null)

    apiGet<Listing>(`/listings/${id}`, { signal: controller.signal })
      .then(data => {
        if (!isMounted) return

        const { formValues, sanitizedDetails, rawDetails: details } = mapListingToForm(data)
        reset(formValues)
        setInitialDetails(sanitizedDetails)
        setRawDetails(details)
        setListingFlow((data as any).flow ?? null)
        setSchemaCategoryId(formValues.categoryId || null)
        console.log(data)
        setImages(
          (data.images ?? []).slice(0, 8).map((image, index) => ({
            id: image.id ?? `${image.url}-${index}`,
            url: image.url ? resolveMediaUrl(image.url) : null,
            isCover: image.isCover ?? index === 0,
            status: 'uploaded',
            name: getDisplayName(image.url) ?? image.url
          }))
        )
      })
      .catch(err => {
        if (!isMounted) return
        console.error('Unable to load listing', err)
        setPageError(
          err instanceof Error
            ? err.message
            : t('listings.edit.loadError')
        )
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoadingListing(false)
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [id, reset, t])

  useEffect(() => {
    setActiveStepIndex(0)
  }, [selectedCategoryId, wizardSteps.length])

  const onSubmit = useCallback(
    async (values: EditListingFormValues) => {
      if (!id) return
      if (isSubmitting || hookIsSubmitting) {
        return
      }

      setIsSubmitting(true)
      setPageError(null)

      const detailsInput = values.details ? { ...values.details } : {}
      const {
        latitude,
        longitude,
        address,
        location: legacyLocation,
        ...restDetails
      } = detailsInput as {
        latitude?: unknown
        longitude?: unknown
        address?: unknown
        location?: unknown
        [key: string]: unknown
      }

      const detailsTitleInput = toTrimmedString(
        (restDetails as any).title ?? (restDetails as any).subject
      )
      const detailsDescriptionInput = toTrimmedString(
        (restDetails as any).description ?? (restDetails as any).body
      )

      const mergedDetails: Record<string, unknown> = {
        ...initialDetails,
        ...restDetails
      }

      ROOT_LISTING_FIELDS.forEach(key => {
        delete mergedDetails[key]
      })

      const originalLocation =
        typeof rawDetails.location === 'object' && rawDetails.location !== null
          ? (rawDetails.location as { latitude?: unknown; longitude?: unknown; address?: unknown })
          : undefined

      const latitudeCandidate = (() => {
        if (typeof latitude === 'number') return latitude
        if (typeof latitude === 'string' && latitude.trim()) {
          const parsed = Number(latitude)
          if (Number.isFinite(parsed)) return parsed
        }
        if (legacyLocation && typeof legacyLocation === 'object') {
          const candidate = (legacyLocation as { latitude?: unknown }).latitude
          if (typeof candidate === 'number') return candidate
          if (typeof candidate === 'string' && candidate.trim()) {
            const parsed = Number(candidate)
            if (Number.isFinite(parsed)) return parsed
          }
        }
        if (originalLocation?.latitude !== undefined) {
          const candidate = originalLocation.latitude
          if (typeof candidate === 'number') return candidate
          if (typeof candidate === 'string' && candidate.trim()) {
            const parsed = Number(candidate)
            if (Number.isFinite(parsed)) return parsed
          }
        }
        return undefined
      })()

      const longitudeCandidate = (() => {
        if (typeof longitude === 'number') return longitude
        if (typeof longitude === 'string' && longitude.trim()) {
          const parsed = Number(longitude)
          if (Number.isFinite(parsed)) return parsed
        }
        if (legacyLocation && typeof legacyLocation === 'object') {
          const candidate = (legacyLocation as { longitude?: unknown }).longitude
          if (typeof candidate === 'number') return candidate
          if (typeof candidate === 'string' && candidate.trim()) {
            const parsed = Number(candidate)
            if (Number.isFinite(parsed)) return parsed
          }
        }
        if (originalLocation?.longitude !== undefined) {
          const candidate = originalLocation.longitude
          if (typeof candidate === 'number') return candidate
          if (typeof candidate === 'string' && candidate.trim()) {
            const parsed = Number(candidate)
            if (Number.isFinite(parsed)) return parsed
          }
        }
        return undefined
      })()

      const resolvedAddress = (() => {
        if (typeof address === 'string' && address.trim()) {
          return address.trim()
        }
        if (legacyLocation && typeof legacyLocation === 'object') {
          const candidate = (legacyLocation as { address?: unknown }).address
          if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim()
          }
        }
        if (typeof originalLocation?.address === 'string' && originalLocation.address.trim()) {
          return originalLocation.address.trim()
        }
        return toTrimmedString(values.location)
      })()

      const hideExact = toBoolean((values as any).locationHideExact)
      const isLocationDirty = Boolean(
        (dirtyFields as any)?.location ||
          (dirtyFields as any)?.city ||
          (dirtyFields as any)?.locationHideExact ||
          (dirtyFields as any)?.details?.address ||
          (dirtyFields as any)?.details?.latitude ||
          (dirtyFields as any)?.details?.longitude ||
          (dirtyFields as any)?.details?.location ||
          (dirtyFields as any)?.details?.city ||
          (dirtyFields as any)?.details?.zipcode ||
          (dirtyFields as any)?.details?.postal_code ||
          (dirtyFields as any)?.details?.zipCode
      )

      let locationPayload: { latitude: number; longitude: number; address: string; hideExact?: boolean } | null = null
      if (
        latitudeCandidate !== undefined &&
        longitudeCandidate !== undefined &&
        resolvedAddress
      ) {
        locationPayload = {
          latitude: Number(latitudeCandidate),
          longitude: Number(longitudeCandidate),
          address: resolvedAddress,
          hideExact: hideExact || false
        }
      }
      if (isLocationDirty && resolvedAddress && !locationPayload) {
        setIsSubmitting(false)
        setPageError(t('forms.mapPicker.errors.locationRequired'))
        return
      }

      const cityForLocation = toTrimmedString(values.city)
      const zipcode = toTrimmedString(
        (mergedDetails as any).zipcode ??
          (mergedDetails as any).postal_code ??
          (mergedDetails as any).zipCode
      )
      const locationForPayload = (() => {
        if (!isLocationDirty) {
          return undefined
        }
        if (locationPayload) {
          return {
            address: locationPayload.address,
            lat: locationPayload.latitude,
            lng: locationPayload.longitude,
            city: cityForLocation,
            zipcode: zipcode || undefined,
            hideExact: locationPayload.hideExact ?? false
          }
        }
        return { hideExact }
      })()

      const hasSubjectField = schemaSteps.some(step =>
        step.fields.some(field => field.name === 'subject')
      )
      const hasBodyField = schemaSteps.some(step =>
        step.fields.some(field => field.name === 'body')
      )
      const hasDescriptionField = schemaSteps.some(step =>
        step.fields.some(field => field.name === 'description')
      )

      const rootTitle = hasSubjectField
        ? toTrimmedString(values.subject || values.title)
        : toTrimmedString(values.title || values.subject)
      const detailsTitle = detailsTitleInput
      const rootDescriptionRaw = hasBodyField
        ? toTrimmedString(values.body || values.description)
        : toTrimmedString(values.description || values.body)
      const detailsDescriptionRaw = detailsDescriptionInput

      const isRootTitleDirty = Boolean((dirtyFields as any)?.title || (dirtyFields as any)?.subject)
      const isDetailsTitleDirty = Boolean(
        (dirtyFields as any)?.details?.title || (dirtyFields as any)?.details?.subject
      )
      const isRootDescriptionDirty = Boolean(
        (dirtyFields as any)?.description || (dirtyFields as any)?.body
      )
      const isDetailsDescriptionDirty = Boolean(
        (dirtyFields as any)?.details?.description || (dirtyFields as any)?.details?.body
      )

      const title = isDetailsTitleDirty
        ? detailsTitle || rootTitle
        : isRootTitleDirty
        ? rootTitle || detailsTitle
        : detailsTitle || rootTitle

      const descriptionRaw = isDetailsDescriptionDirty
        ? detailsDescriptionRaw || rootDescriptionRaw
        : isRootDescriptionDirty
        ? rootDescriptionRaw || detailsDescriptionRaw
        : detailsDescriptionRaw || rootDescriptionRaw
      const description = sanitizeRichTextHtml(descriptionRaw)
      const descriptionText = richTextToPlainText(description)
      if (descriptionText.length < 10) {
        const descriptionErrorPath = hasBodyField
          ? ('body' as never)
          : hasDescriptionField
          ? ('description' as never)
          : ('description' as never)

        setError(descriptionErrorPath, {
          type: 'manual',
          message: t('forms.validation.minLength', { min: 10 })
        })
        setIsSubmitting(false)
        return
      }
      const priceInput = toTrimmedString(values.price)
      const priceAmount = Number(priceInput)
      const currency = toTrimmedString(values.currency || '').toUpperCase() || 'EUR'

      const email = toTrimmedString((values as any).email ?? (mergedDetails as any).email)
      const phone = toTrimmedString((values as any).phone ?? (mergedDetails as any).phone)
      const phoneHidden = toBoolean(
        (values as any).phone_hidden_information_text ??
          (mergedDetails as any).phone_hidden_information_text ??
          (mergedDetails as any).phone_hidden
      )
      const noSalesmen = toBoolean((mergedDetails as any).no_salesmen)

      const newItemPriceRaw = toTrimmedString((mergedDetails as any).new_item_price)
      const newItemPrice = newItemPriceRaw ? Number(newItemPriceRaw) : undefined
      const customRef = toTrimmedString((mergedDetails as any).custom_ref)
      const resolvedFlow = (() => {
        const raw = toTrimmedString((listingFlow ?? values.adType) ?? '').toLowerCase()
        if (raw === 'sell' || raw === 'buy') return raw
        return 'sell'
      })()

      const rawHandoverModes = (mergedDetails as any).handover_modes
      const normalizedHandoverModes = Array.isArray(rawHandoverModes)
        ? rawHandoverModes.map(mode => String(mode)).filter(Boolean)
        : typeof rawHandoverModes === 'string' && rawHandoverModes.trim()
        ? [rawHandoverModes.trim()]
        : []

      if (normalizedHandoverModes.length === 0) {
        setError('details.handover_modes' as never, {
          type: 'manual',
          message: t('listings.new.handover.required')
        })
        setIsSubmitting(false)
        setPageError(t('listings.new.handover.required'))
        return
      }

      ;(mergedDetails as any).handover_modes = normalizedHandoverModes

      const sanitizedDetails = sanitizeDetails(mergedDetails)
      ;[
        'email',
        'phone',
        'phone_hidden_information_text',
        'phone_hidden',
        'no_salesmen',
        'new_item_price',
        'custom_ref',
        'address',
        'latitude',
        'longitude',
        'location',
        'city',
        'zipcode',
        'postal_code',
        'zipCode'
      ].forEach(key => delete sanitizedDetails[key])

      const attributes = sanitizedDetails

      const payload: Record<string, unknown> = {
        categoryId: selectedRootCategoryId || values.categoryId,
        subCategoryId: values.categoryId,
        adType: resolvedFlow,
        title,
        description,
        status: values.status,
        price: Number.isFinite(priceAmount)
          ? { amount: Number(priceAmount), currency, newItemPrice }
          : undefined,
        location: locationForPayload,
        contact: {
          email: email || undefined,
          phone: phone || undefined,
          phoneHidden,
          noSalesmen
        },
        attributes,
        meta: customRef ? { customRef } : undefined
      }

      const uploadedImages = images.filter(image => image.status === 'uploaded' && image.url)
      if (uploadedImages.length) {
        const hasCover = uploadedImages.some(image => image.isCover)
        payload.images = uploadedImages.slice(0, 8).map((image, index) => ({
          url: image.url,
          position: index,
          isCover: hasCover ? image.isCover : index === 0
        }))
      }

      console.log(payload)

      try {
        await apiPatch<Listing>(`/listings/${id}`, payload)
        setInitialDetails(sanitizedDetails)
        addToast({
          variant: 'success',
          title: t('listings.edit.toast.updatedTitle'),
          message: t('listings.edit.toast.updatedMessage')
        })
      } catch (err) {
        console.error('Unable to update listing', err)
        const message =
          err instanceof Error
            ? err.message
            : t('listings.edit.toast.updateErrorMessage')
        setPageError(message)
        addToast({
          variant: 'error',
          title: t('listings.edit.toast.updateErrorTitle'),
          message
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [addToast, dirtyFields, hookIsSubmitting, id, images, initialDetails, rawDetails, isSubmitting, schemaSteps, t]
  )

  const handleDelete = useCallback(async () => {
    if (!id || isDeleting) {
      return
    }
    setIsDeleting(true)
    try {
      await apiDelete(`/listings/${id}`)
      addToast({
        variant: 'info',
        title: t('listings.edit.toast.deletedTitle'),
        message: t('listings.edit.toast.deletedMessage')
      })
      navigate('/dashboard/listings', { replace: true })
    } catch (err) {
      console.error('Unable to delete listing', err)
      addToast({
        variant: 'error',
        title: t('listings.edit.toast.deleteErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('listings.edit.toast.deleteErrorMessage')
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }, [addToast, id, isDeleting, navigate, t])

  const renderCategorySelection = () => {
    const currentCategoryId = getValues('categoryId')
    const categoryError =
      !currentCategoryId &&
      !categoriesLoading &&
      !isLoadingListing &&
      !(selectedRootCategoryId && childrenLoading[selectedRootCategoryId])

    return (
      <section className="dashboard-section">
        <div className="dashboard-section__head">
          <div>
            <h2>{t('listings.edit.category.title')}</h2>
            <p style={{ margin: 0, color: '#6b7280' }}>
              {t('listings.edit.category.subtitle')}
            </p>
          </div>
          <span className="lbc-link">
            {categoriesLoading ? t('loading.inline') : t('listings.edit.step.single', { step: 1 })}
          </span>
        </div>

        <div style={CATEGORY_GRID_STYLE}>
          {rootCategories.map(category => {
            const childList = childrenByParent[category.id] ?? []
            const childSummary = childList.slice(0, 4).map(child => child.name).join(', ')
            const isSelected =
              category.id === selectedRootCategoryId || (!selectedRootCategoryId && currentCategoryId === category.id)
            return (
              <button
                key={category.id}
                type="button"
                className="card category-choice-card"
                style={getCategoryCardStyle(isSelected)}
                onClick={() => handleRootSelect(category)}
              >
                <span style={CATEGORY_CARD_ICON_STYLE}>{category.icon ?? '🗂️'}</span>
                <span style={CATEGORY_CARD_NAME_STYLE}>{category.name}</span>
                {childSummary ? (
                  <span style={CATEGORY_CARD_DESC_STYLE}>{childSummary}</span>
                ) : category.description ? (
                  <span style={CATEGORY_CARD_DESC_STYLE}>{category.description}</span>
                ) : null}
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('listings.edit.category.chooseAction')}</span>
              </button>
            )
          })}
        </div>

        {selectedRootCategoryId ? (
          <div style={FORM_SECTIONS_WRAPPER_STYLE}>
            <div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '4px' }}>{t('listings.edit.category.subcategoryTitle')}</h3>
              <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: 0 }}>
                {t('listings.edit.category.subcategorySubtitle')}
              </p>
            </div>
            {childrenLoading[selectedRootCategoryId] ? (
              <p style={{ color: '#6b7280' }}>{t('listings.edit.category.loadingSubcategories')}</p>
            ) : subCategories.length > 0 ? (
              <div style={CATEGORY_GRID_STYLE}>
                {subCategories.map(child => {
                  const grandChildren = childrenByParent[child.id] ?? []
                  const grandSummary = grandChildren.slice(0, 4).map(item => item.name).join(', ')
                  const isSelected = currentCategoryId === child.id
                  return (
                    <button
                      key={child.id}
                      type="button"
                      className="card category-choice-card"
                      style={getCategoryCardStyle(isSelected)}
                      onClick={() => handleSubCategorySelect(child)}
                    >
                      <span style={CATEGORY_CARD_ICON_STYLE}>{child.icon ?? '📁'}</span>
                      <span style={CATEGORY_CARD_NAME_STYLE}>{child.name}</span>
                      {child.description ? (
                        <span style={CATEGORY_CARD_DESC_STYLE}>{child.description}</span>
                      ) : grandSummary ? (
                        <span style={CATEGORY_CARD_DESC_STYLE}>{grandSummary}</span>
                      ) : null}
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {t('listings.edit.category.continueAction')}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p style={{ color: '#6b7280' }}>
                {t('listings.edit.category.noSubcategory')}
              </p>
            )}
          </div>
        ) : null}

        {categoryError ? (
          <p className="form-field__error" role="alert" style={{ marginTop: '14px' }}>
            {t('listings.edit.category.required')}
          </p>
        ) : null}
      </section>
    )
  }

  const renderCurrentStep = () => {
    if (!currentStep) {
      return null
    }

    if (currentStep.kind === 'media') {
      return (
        <section className="dashboard-section" id="listing-step-media">
          <div className="dashboard-section__head">
            <div>
              <span className="form-stepper__badge">
                {t('listings.edit.step.progress', { current: activeStepIndex + 1, total: wizardSteps.length })}
              </span>
              <h2>{t('listings.edit.media.title')}</h2>
            </div>
          </div>
          <div style={MEDIA_STEP_CARD_STYLE}>
            <ImagesManager value={images} onChange={setImages} disabled={isSubmitting || hookIsSubmitting} />
            <div style={STEP_ACTIONS_STYLE}>
              {activeStepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviousStep}
                  disabled={isSubmitting || hookIsSubmitting}
                >
                  {t('actions.previousStep')}
                </Button>
              ) : null}
              <Button type="submit" disabled={isSubmitting || hookIsSubmitting}>
                {isSubmitting || hookIsSubmitting ? t('actions.saving') : t('actions.save')}
              </Button>
            </div>
          </div>
        </section>
      )
    }

  return (
    <DynamicFormStep
      key={currentStep.id}
      step={currentStep.formStep}
      basePath="details"
      stepIndex={activeStepIndex}
      totalSteps={wizardSteps.length}
      isMapStep={currentStep.isMapStep}
      priceSuggestion={priceSuggestion}
      priceSuggestionLoading={priceSuggestionLoading}
      onApplyPriceSuggestion={handleApplyPriceSuggestion}
      actions={
        <div style={STEP_ACTIONS_STYLE}>
            {activeStepIndex > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviousStep}
                disabled={isSubmitting || hookIsSubmitting}
              >
                {t('actions.previousStep')}
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={handleNextStep}
              disabled={isSubmitting || hookIsSubmitting}
            >
              {t('actions.nextStep')}
            </Button>
          </div>
        }
      />
    )
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('listings.edit.title')}</h1>
            <p>{t('listings.edit.subtitle')}</p>
          </div>
          {id ? (
            <Link to={`/listing/${id}`} className="btn btn--outline">
              {t('listings.edit.preview')}
            </Link>
          ) : null}
        </header>

        {isLoadingListing ? (
          <p style={{ color: '#6c757d', padding: '1.5rem 0' }}>{t('listings.edit.loading')}</p>
        ) : null}

        {pageError ? (
          <p className="auth-form__error" role="alert">
            {pageError}
          </p>
        ) : null}

        {schemaError ? (
          <p className="auth-form__error" role="alert">
            {schemaError}
          </p>
        ) : null}

        {isSchemaLoading && selectedCategoryId ? (
          <p style={{ color: '#6c757d', marginBottom: '12px' }}>{t('listings.edit.schemaLoading')}</p>
        ) : null}

        <FormProvider {...methods}>
          <form className="listing-form" onSubmit={handleSubmit(onSubmit, handleInvalidSubmit)}>
            <input
              type="hidden"
              {...register('categoryId', {
                required: t('listings.edit.category.required')
              })}
            />

            {renderCategorySelection()}

            {hasSelectedCategory && hasSteps ? (
              <section className="dashboard-section">
                <div className="dashboard-section__head">
                  <div>
                    <h2>{t('listings.edit.dynamicFields.title')}</h2>
                  </div>
                </div>
                <FormStepper
                  steps={wizardSteps.map(step => ({
                    id: step.id,
                    label: step.label
                  }))}
                  currentStep={activeStepIndex}
                  onStepChange={handleStepperChange}
                />
              </section>
            ) : null}

            {hasSelectedCategory ? renderCurrentStep() : null}

            {hasSelectedCategory && shouldShowHandoverModes ? (
              <section className="dashboard-section">
                <div className="dashboard-section__head">
                  <h2>{t('listings.new.handover.title')}</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    {
                      value: 'pickup',
                      label: t('listings.new.handover.pickup'),
                      description: t('listings.new.handover.pickupHelp')
                    },
                    {
                      value: 'delivery',
                      label: t('listings.new.handover.delivery'),
                      description: t('listings.new.handover.deliveryHelp')
                    }
                  ].map(option => {
                    const checked = (handoverModes ?? []).includes(option.value)
                    return (
                      <label
                        key={option.value}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '12px 14px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          background: checked ? 'rgba(15,96,196,0.06)' : '#fff'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => {
                            const current = handoverModes ?? []
                            const next = event.target.checked
                              ? Array.from(new Set([...current, option.value]))
                              : current.filter(mode => mode !== option.value)
                            const currentDetails = (getValues('details') ?? {}) as Record<string, unknown>
                            setValue('details', { ...currentDetails, handover_modes: next }, {
                              shouldDirty: true,
                              shouldValidate: true
                            })
                          }}
                          style={{ marginTop: '4px' }}
                        />
                        <span>
                          <div style={{ fontWeight: 600 }}>{option.label}</div>
                          <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{option.description}</div>
                        </span>
                      </label>
                    )
                  })}
                  {handoverError ? (
                    <p className="form-field__error" role="alert" style={{ marginTop: '4px' }}>
                      {handoverError}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="dashboard-section">
              <div className="dashboard-section__head">
                <div>
                  <h2>{t('listings.edit.status.title')}</h2>
                  <p style={{ margin: 0, color: '#6b7280' }}>
                    {t('listings.edit.status.subtitle')}
                  </p>
                </div>
              </div>
              <div className="card" style={{ maxWidth: '380px' }}>
                <div className="card__body">
                  <FormField label={t('listings.edit.status.label')} htmlFor="edit-status" required>
                    <Controller
                      name="status"
                      control={control}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <Select
                          id="edit-status"
                          value={field.value}
                          onChange={field.onChange}
                          options={statusOptions}
                        />
                      )}
                    />
                  </FormField>
                </div>
              </div>
            </section>

            <div
              className="auth-form__actions"
              style={{ justifyContent: 'space-between', marginTop: '24px' }}
            >
              <Button
                type="button"
                variant="danger"
                onClick={() => setShowDeleteModal(true)}
                disabled={isDeleting}
              >
                {isDeleting ? t('actions.deleting') : t('listings.edit.deleteAction')}
              </Button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/dashboard/listings')}
                  disabled={isSubmitting || hookIsSubmitting}
                >
                  {t('actions.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting || hookIsSubmitting}>
                  {isSubmitting || hookIsSubmitting ? t('actions.saving') : t('listings.edit.saveChanges')}
                </Button>
              </div>
            </div>
          </form>
        </FormProvider>
      </div>

      <Modal
        open={showDeleteModal}
        title={t('listings.edit.deleteModal.title')}
        description={t('listings.edit.deleteModal.description')}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteModal(false)
          }
        }}
        footer={
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              {t('actions.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t('actions.deleting') : t('actions.delete')}
            </Button>
          </div>
        }
      >
        <p>
          {t('listings.edit.deleteModal.notice', {
            draft: t('dashboard.listings.status.draft'),
            archived: t('dashboard.listings.status.archived')
          })}
        </p>
      </Modal>
    </DashboardLayout>
  )
}

function getCategoryCardStyle(isSelected: boolean): CSSProperties {
  return {
    border: isSelected ? '2px solid var(--color-primary, #ff6e14)' : '1px solid #e5e7eb',
    background: '#ffffff',
    borderRadius: '16px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    cursor: 'pointer',
    boxShadow: isSelected
      ? '0 12px 24px rgba(15, 23, 42, 0.16)'
      : '0 6px 16px rgba(15, 23, 42, 0.08)',
    transform: isSelected ? 'translateY(-2px)' : 'none',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border 0.18s ease',
    outline: 'none',
    width: '100%',
    textAlign: 'left',
    color: '#0f172a',
    fontFamily: 'inherit'
  }
}
