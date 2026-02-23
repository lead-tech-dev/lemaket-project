import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormProvider, useForm } from 'react-hook-form'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { ImagesManager, type ListingImageFormItem } from '../../components/listings/ImagesManager'

import type { Category, CategoryExtraField, FormField, FormStep } from '../../types/category'
import type { Listing } from '../../types/listing'
import { apiPost } from '../../utils/api'
import { useToast } from '../../components/ui/Toast'
import { DynamicFormStep, isCoordinateStep } from '../../components/forms/DynamicFormStep'
import { useListingFormSchema, type FormSchemaDTO } from '../../hooks/useListingFormSchema'
import { useCategoryHierarchy } from '../../hooks/useCategoryHierarchy'
import { usePriceSuggestion } from '../../hooks/usePriceSuggestion'
import { CATEGORY_EXTRA_FIELD_KEYS } from '../../constants/categoryExtraFields'
import { ROOT_LISTING_FIELDS } from '../../constants/listingForm'
import { clearAuthToken } from '../../utils/auth'
import { useI18n } from '../../contexts/I18nContext'
import { useAuth } from '../../hooks/useAuth'
import { richTextToPlainText, sanitizeRichTextHtml } from '../../utils/richText'

type SchemaStep = FormSchemaDTO['steps'][number] & Partial<FormStep>
type SchemaField = FormSchemaDTO['steps'][number]['fields'][number] & Partial<FormField>

type NewListingFormValues = {
  categoryId: string
  adType: string
  title: string
  description: string
  price: string
  currency: string
  city: string
  location: string
  tag: string
  surface: string
  rooms: string | number
  year: string
  mileage: string
  highlights: string | string[]
  equipments: string | string[]
  subject: string
  body: string
  price_cents: string
  price_reco: string
  donation: boolean | string
  phone: string
  phone_hidden_information_text: boolean | string
  locationHideExact: boolean | string
  details: Record<string, unknown>
}

type VisibilityCondition = {
  field: string
  equals?: unknown
  notEquals?: unknown
  in?: unknown[]
  notIn?: unknown[]
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

const INITIAL_FORM: NewListingFormValues = {
  categoryId: '',
  adType: '',
  title: '',
  description: '',
  price: '',
  currency: 'EUR',
  city: '',
  location: '',
  tag: '',
  surface: '',
  rooms: '',
  year: '',
  mileage: '',
  highlights: '',
  equipments: '',
  subject: '',
  body: '',
  price_cents: '',
  price_reco: '',
  donation: false,
  phone: '',
  phone_hidden_information_text: false,
  locationHideExact: false,
  details: { handover_modes: ['pickup'] }
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

const CATEGORY_ICON_IMG_STYLE: CSSProperties = {
  width: '32px',
  height: '32px',
  objectFit: 'contain',
  display: 'block'
}

const FORM_SECTIONS_LIST_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
  listStyle: 'none',
  padding: 0,
  margin: 0
}

const FORM_SECTION_BUTTON_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '6px',
  background: '#ffffff',
  borderRadius: '14px',
  border: '1px solid #e5e7eb',
  padding: '14px 16px',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'box-shadow 0.18s ease, transform 0.18s ease',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)'
}

const FORM_SECTION_TITLE_STYLE: CSSProperties = {
  fontWeight: 600,
  fontSize: '0.95rem',
  color: '#0f172a'
}

const FORM_SECTION_BADGE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 10px',
  borderRadius: '999px',
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
  fontSize: '0.72rem',
  color: '#2563eb',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.02em'
}

const isLikelyUrl = (value: string) => /^https?:\/\//i.test(value) || value.startsWith('/')

const parseJsonIfNeeded = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const extractCategoryRights = (
  category: Category | null
): { private: Record<string, boolean>; pro: Record<string, boolean> } | null => {
  if (!category) return null

  const fromContainer = (container: unknown) => {
    const parsed = parseJsonIfNeeded(container)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    const rights = (parsed as { rights?: unknown }).rights
    if (!rights || typeof rights !== 'object' || Array.isArray(rights)) {
      return null
    }
    return rights as { private?: Record<string, boolean>; pro?: Record<string, boolean> }
  }

  const directRights = parseJsonIfNeeded((category as unknown as { rights?: unknown }).rights)
  if (directRights && typeof directRights === 'object' && !Array.isArray(directRights)) {
    const casted = directRights as { private?: Record<string, boolean>; pro?: Record<string, boolean> }
    return {
      private: casted.private ?? {},
      pro: casted.pro ?? {}
    }
  }

  const fromRaw =
    fromContainer((category as unknown as { extraFieldsRaw?: unknown }).extraFieldsRaw) ??
    fromContainer(
      !Array.isArray((category as unknown as { extraFields?: unknown }).extraFields)
        ? (category as unknown as { extraFields?: unknown }).extraFields
        : null
    ) ??
    fromContainer((category as unknown as { extra_fields?: unknown }).extra_fields)

  if (fromRaw) {
    return {
      private: fromRaw.private ?? {},
      pro: fromRaw.pro ?? {}
    }
  }

  if (Array.isArray((category as unknown as { extraFields?: unknown }).extraFields)) {
    for (const entry of (category as unknown as { extraFields?: unknown[] }).extraFields ?? []) {
      const parsed = parseJsonIfNeeded(entry)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
      if ('rights' in parsed) {
        const rights = (parsed as { rights?: unknown }).rights
        if (rights && typeof rights === 'object' && !Array.isArray(rights)) {
          const casted = rights as { private?: Record<string, boolean>; pro?: Record<string, boolean> }
          return {
            private: casted.private ?? {},
            pro: casted.pro ?? {}
          }
        }
      }
    }
  }

  return null
}

const subCategoryVisibleForUser = (category: Category, isPro: boolean): boolean => {
  const rights = extractCategoryRights(category)
  if (!rights) {
    return true
  }
  const roleRights = isPro ? rights.pro : rights.private
  return Object.values(roleRights).some(value => value === true)
}

const renderCategoryIcon = (icon: string | null | undefined, fallback: string, alt: string) => {
  const trimmed = typeof icon === 'string' ? icon.trim() : ''
  const content = trimmed
    ? isLikelyUrl(trimmed)
      ? <img src={trimmed} alt={alt} style={CATEGORY_ICON_IMG_STYLE} />
      : trimmed
    : fallback

  return <span style={CATEGORY_CARD_ICON_STYLE}>{content}</span>
}

const getCategoryCardStyle = (isSelected: boolean): CSSProperties => ({
  border: isSelected
    ? '2px solid var(--color-primary, #ff6e14)'
    : '1px solid #e5e7eb',
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
})

const STEP_HEADER_WRAPPER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
}

const STEP_BADGE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 12px',
  borderRadius: '999px',
  background: '#eef2ff',
  color: '#3730a3',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.02em'
}

const STEP_CARD_STYLE: CSSProperties = {
  background: '#ffffff',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 18px 36px rgba(15, 23, 42, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '18px'
}

const stripDiacritics = (input: string): string =>
  input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const toNormalizedString = (value: string | null | undefined): string => {
  if (!value) {
    return ''
  }
  return stripDiacritics(value).toLowerCase()
}

const containsIsolatedToken = (source: string, token: string) => {
  if (!source || !token) {
    return false
  }
  const pattern = new RegExp(`(^|[\\s._-])${token}($|[\\s._-])`)
  return pattern.test(source)
}

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    return ['true', '1', 'yes', 'on'].includes(normalized)
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0
  }
  return Boolean(value)
}

const isMapControlField = (field: SchemaField): boolean => {
  const normalizedName = toNormalizedString(field.name)
  const normalizedType = toNormalizedString(field.type as string | undefined)
  const normalizedRole = toNormalizedString(
    (field as unknown as { uiRole?: string | null }).uiRole
  )

  if (normalizedRole && ['map', 'map_control'].includes(normalizedRole)) {
    return true
  }

  if (normalizedType === 'map') {
    return true
  }

  if (
    normalizedName.includes('map') ||
    normalizedName.includes('carte') ||
    containsIsolatedToken(normalizedName, 'map')
  ) {
    return true
  }

  return false
}

const STEP_ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  marginTop: '12px'
}

const isValueEmpty = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  if (typeof value === 'number') {
    return !Number.isFinite(value)
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length === 0
  }

  return false
}

const isFieldMandatory = (field: SchemaField): boolean => {
  const rules = field.rules as { mandatory?: boolean } | null | undefined
  return Boolean(rules?.mandatory)
}

const isUnauthorizedError = (error: unknown): error is Error =>
  error instanceof Error &&
  (error.message === 'Unauthorized' ||
    error.message.toLowerCase().includes('unauthorized') ||
    error.message.includes('401'))

function toTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function parseMultiline(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) {
    const entries = value.map(entry => entry.trim()).filter(Boolean)
    return entries.length ? entries : undefined
  }

  const entries = value
    .split('\n')
    .map(entry => entry.trim())
    .filter(Boolean)
  return entries.length ? entries : undefined
}

const toInfoEntries = (info: unknown): string[] => {
  if (Array.isArray(info)) {
    return info.map(entry => String(entry)).filter(Boolean)
  }
  if (typeof info === 'string') {
    return info
      .split(/\r?\n/)
      .map(entry => entry.trim())
      .filter(Boolean)
  }
  return []
}

function sanitizeDetails(details: Record<string, unknown> | undefined) {
  if (!details) {
    return undefined
  }

  const cleanedEntries = Object.entries(details).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc
    }

    if (typeof value === 'string' && value.trim() === '') {
      return acc
    }

    if (Array.isArray(value)) {
      const normalized = value.filter(entry => {
        if (typeof entry === 'string') {
          return entry.trim().length > 0
        }
        return entry !== undefined && entry !== null
      })
      if (normalized.length === 0) {
        return acc
      }
      acc[key] = normalized
      return acc
    }

    acc[key] = value
    return acc
  }, {})

  return Object.keys(cleanedEntries).length ? cleanedEntries : undefined
}

export default function NewListing() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isPro } = useAuth()

  const methods = useForm<NewListingFormValues>({
    defaultValues: INITIAL_FORM,
    mode: 'onChange'
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    setError,
    clearErrors,
    trigger,
    formState: { errors, dirtyFields }
  } = methods
  const handoverModes = watch('details.handover_modes') as string[] | undefined
  const handoverError = (errors as any)?.details?.handover_modes?.message as string | undefined

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

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [selectedRootCategoryId, setSelectedRootCategoryId] = useState('')
  const [activeDynamicStepIndex, setActiveDynamicStepIndex] = useState(0)
  const [maxUnlockedStepIndex, setMaxUnlockedStepIndex] = useState(0)

  const selectedCategoryId = watch('categoryId')
  const selectedAdType = watch('adType')
  const watchedCity = watch('city')
  const defaultMediaStepInfo = useMemo(
    () => [t('listings.new.media.info.cover')],
    [t]
  )

  useEffect(() => {
    ensureCategoryLoaded(selectedCategoryId).catch(() => {
      /* handled */
    })
  }, [ensureCategoryLoaded, selectedCategoryId])



  useEffect(() => {
    if (!selectedRootCategoryId) {
      return
    }
    loadChildren(selectedRootCategoryId).catch(() => {
      /* handled */
    })
  }, [selectedRootCategoryId, loadChildren])

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

  const subCategories = useMemo(
    () =>
      selectedRootCategoryId ? childrenByParent[selectedRootCategoryId] ?? [] : [],
    [childrenByParent, selectedRootCategoryId]
  )
  const visibleRootCategories = useMemo(
    () =>
      rootCategories.filter(category => {
        const children = childrenByParent[category.id] ?? []
        if (children.length === 0) {
          return true
        }
        return children.some(child => subCategoryVisibleForUser(child, isPro))
      }),
    [childrenByParent, isPro, rootCategories]
  )
  const visibleSubCategories = useMemo(
    () => subCategories.filter(category => subCategoryVisibleForUser(category, isPro)),
    [isPro, subCategories]
  )

  useEffect(() => {
    if (
      selectedRootCategoryId &&
      !visibleRootCategories.some(category => category.id === selectedRootCategoryId)
    ) {
      setSelectedRootCategoryId('')
    }
  }, [selectedRootCategoryId, visibleRootCategories])

  useEffect(() => {
    rootCategories.forEach(category => {
      if (childrenByParent[category.id]) {
        return
      }
      loadChildren(category.id).catch(() => {
        /* handled */
      })
    })
  }, [childrenByParent, loadChildren, rootCategories])

  const selectedCategory = useMemo(
    () => categories.find(category => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  )

  const selectedCategoryExtraFields = useMemo(
    () =>
      Array.isArray(selectedCategory?.extraFields)
        ? (selectedCategory?.extraFields as CategoryExtraField[])
        : [],
    [selectedCategory?.extraFields]
  )
  const { schema, isLoading: isLoadingSchema, error: schemaError } = useListingFormSchema(
    selectedCategoryId || null
  )
  const selectedCategoryAdTypes = useMemo<Array<{ value: string; label: string; description?: string }>>(() => {
    const parseMaybeJson = (value: unknown) => {
      if (typeof value !== 'string') return value
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }

    const toObjectRecord = (value: unknown): Record<string, unknown> | null => {
      const parsed = parseMaybeJson(value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null
      }
      return parsed as Record<string, unknown>
    }

    const extractAdTypesAndRights = (category: Category | null) => {
      if (!category) {
        return {
          adTypes: null as Record<string, { label?: string; description?: string }> | null,
          rights: null as Record<string, Record<string, boolean>> | null
        }
      }
      const directAdTypes =
        (category as unknown as { ad_types?: any })?.ad_types ??
        (category as unknown as { adTypes?: any })?.adTypes ??
        null
      const maybeObj =
        directAdTypes ??
        (category as unknown as { extraFieldsRaw?: any })?.extraFieldsRaw ??
        (!Array.isArray((category as unknown as { extraFields?: any })?.extraFields)
          ? (category as unknown as { extraFields?: any })?.extraFields
          : null) ??
        (category as unknown as { extra_fields?: any })?.extra_fields

      const parsedMaybe = parseMaybeJson(maybeObj)
      let adTypes =
        (parsedMaybe && typeof parsedMaybe === 'object' && !Array.isArray(parsedMaybe)
          ? (parsedMaybe as { ad_types?: any; adTypes?: any }).ad_types ??
            (parsedMaybe as { ad_types?: any; adTypes?: any }).adTypes
          : null) ?? null
      let rights =
        (category as unknown as { rights?: unknown })?.rights ??
        (parsedMaybe && typeof parsedMaybe === 'object' && !Array.isArray(parsedMaybe)
          ? (parsedMaybe as { rights?: unknown }).rights
          : null)

      if (!adTypes && Array.isArray((category as any)?.extraFields)) {
        for (const entry of (category as any).extraFields as any[]) {
          if (!entry) continue
          const parsedEntry = parseMaybeJson(entry)
          if (parsedEntry && typeof parsedEntry === 'object') {
            if (!adTypes && 'ad_types' in parsedEntry) {
              adTypes = (parsedEntry as any).ad_types
            }
            if (!rights && 'rights' in parsedEntry) {
              rights = (parsedEntry as any).rights
            }
            if (adTypes && rights) {
              break
            }
          }
        }
      }

      const parsedAdTypes = parseMaybeJson(adTypes)
      return {
        adTypes:
          parsedAdTypes && typeof parsedAdTypes === 'object' && !Array.isArray(parsedAdTypes)
            ? (parsedAdTypes as Record<string, { label?: string; description?: string }>)
            : null,
        rights: toObjectRecord(rights) as Record<string, Record<string, boolean>> | null
      }
    }

    // Priority: category payload first (usually source of truth), schema as fallback.
    let { adTypes, rights } = extractAdTypesAndRights(selectedCategory)
    if (!adTypes && selectedCategory?.parentId) {
      const parentCategory = categories.find(category => category.id === selectedCategory.parentId) ?? null
      const parentData = extractAdTypesAndRights(parentCategory)
      adTypes = parentData.adTypes
      if (!rights) {
        rights = parentData.rights
      }
    }
    if (!adTypes) {
      adTypes =
        (schema?.adTypes as Record<string, { label?: string; description?: string }> | undefined) ??
        null
    }

    if (!adTypes) {
      return []
    }

    const roleKey = isPro ? 'pro' : 'private'
    const roleRights = rights?.[roleKey]

    return Object.entries(adTypes)
      .filter(([adTypeKey]) => {
        if (!roleRights || Object.keys(roleRights).length === 0) {
          return true
        }
        return roleRights[adTypeKey] === true
      })
      .filter(([, value]) => value && typeof value === 'object')
      .map(([key, value]) => ({
        value: key,
        label:
          typeof (value as any).label === 'string'
            ? (value as any).label
            : key,
        description:
          typeof (value as any).description === 'string' ? (value as any).description : undefined
      }))
  }, [categories, isPro, schema?.adTypes, selectedCategory])
  const selectedExtraFieldSet = useMemo(() => new Set(selectedCategoryExtraFields), [selectedCategoryExtraFields])

  const hasSelectedCategory = Boolean(selectedCategoryId)
  const requiresAdTypeSelection = hasSelectedCategory && selectedCategoryAdTypes.length > 0

  const { data: priceSuggestion, loading: priceSuggestionLoading } = usePriceSuggestion({
    categoryId: selectedRootCategoryId || selectedCategoryId || null,
    subCategoryId: selectedCategoryId || null,
    city: watchedCity || null,
    sampleSize: 200
  })

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



  const wizardSteps = useMemo<WizardStep[]>(() => {
    if (requiresAdTypeSelection && !selectedAdType) {
      return []
    }

    const steps: WizardStep[] = []
    const allSteps: SchemaStep[] = (schema?.steps as SchemaStep[]) ?? []
    const normalizedAdType = selectedAdType ? selectedAdType.toLowerCase() : null

    const matchingSteps = allSteps.filter(step => {
      if (!normalizedAdType) return true
      const rawFlow = (step as any).flow
      const flow = typeof rawFlow === 'string' ? rawFlow.trim().toLowerCase() : undefined
      // If flow not defined, consider the step applicable to all flows.
      if (!flow) return true
      return flow === normalizedAdType
    })



    const dynamicSteps = matchingSteps
    let hasCoordinateStep = false


   

    dynamicSteps.forEach(step => {
      const coordinateLike = isCoordinateStep(step)
      const mapStep = coordinateLike && !hasCoordinateStep
      if (mapStep) {
        hasCoordinateStep = true
      }

      steps.push({
        id: step.id,
        label: step.label ?? step.name ?? t('listings.new.step.fallback'),
        info: toInfoEntries(step.info),
        kind: 'dynamic',
        formStep: step,
        isMapStep: mapStep
      })
    })
    
    if (hasSelectedCategory) {
      steps.push({
        id: 'media',
        label: t('listings.new.media.title'),
        info: defaultMediaStepInfo,
        kind: 'media'
      })
    }

    return steps
  }, [schema?.steps, hasSelectedCategory, requiresAdTypeSelection, selectedAdType, t, defaultMediaStepInfo])


  const wizardSections = useMemo(
    () =>
      wizardSteps.map((step, index) => ({
        id: step.id,
        label: step.label,
        info: step.info,
        index
      })),
    [wizardSteps]
  )

  const hasDynamicSteps = Boolean(schema?.steps?.length)

  const currentWizardStep = wizardSteps[activeDynamicStepIndex] ?? null
  const activeDynamicStepId = currentWizardStep?.id ?? null
  const totalWizardSteps = wizardSteps.length
  const isFinalWizardStep = totalWizardSteps > 0 && activeDynamicStepIndex === totalWizardSteps - 1

  const resolveFieldPath = useCallback((fieldName: string) => (
    ROOT_LISTING_FIELDS.has(fieldName) ? fieldName : `details.${fieldName}`
  ), [])

  const matchesVisibilityCondition = useCallback(
    (value: unknown, condition: VisibilityCondition) => {
      if (condition.equals !== undefined) {
        return value === condition.equals
      }
      if (condition.notEquals !== undefined) {
        return value !== condition.notEquals
      }
      if (condition.in) {
        if (Array.isArray(value)) {
          return value.some(entry => condition.in?.includes(entry))
        }
        return condition.in.includes(value)
      }
      if (condition.notIn) {
        if (Array.isArray(value)) {
          return value.every(entry => !condition.notIn?.includes(entry))
        }
        return !condition.notIn.includes(value)
      }
      return Boolean(value)
    },
    []
  )

  const shouldDisplayDynamicField = useCallback(
    (field: SchemaField) => {
      const visibility = (field as unknown as { visibility?: VisibilityCondition[] }).visibility
      if (!visibility || visibility.length === 0) {
        return true
      }

      return visibility.every(condition => {
        const path = resolveFieldPath(condition.field)
        const watchedValue = watch(path as never)
        return matchesVisibilityCondition(watchedValue, condition)
      })
    },
    [matchesVisibilityCondition, resolveFieldPath, watch]
  )

  const getStepValidationFields = useCallback(
    (step: SchemaStep) => {
      const uniquePaths = new Set<string>()
      step.fields.forEach(field => {
        if (!shouldDisplayDynamicField(field)) {
          return
        }
        if (isMapControlField(field)) {
          return
        }
        const path = resolveFieldPath(field.name)
        uniquePaths.add(path)
      })
      return Array.from(uniquePaths)
    },
    [resolveFieldPath, shouldDisplayDynamicField]
  )

  const getErrorForPath = useCallback(
    (path: string): unknown => {
      const segments = path.split('.')
      let cursor: any = errors
      for (const segment of segments) {
        if (!cursor) {
          return undefined
        }
        cursor = cursor[segment as keyof typeof cursor]
      }
      return cursor
    },
    [errors]
  )

  const currentDynamicStepFieldPaths = useMemo(() => {
    if (!currentWizardStep || currentWizardStep.kind !== 'dynamic') {
      return []
    }
    return currentWizardStep.formStep.fields
      .filter(field => shouldDisplayDynamicField(field))
      .filter(field => !isMapControlField(field))
      .map(field => resolveFieldPath(field.name))
  }, [currentWizardStep, resolveFieldPath, shouldDisplayDynamicField])

  const currentDynamicStepRequiredPaths = useMemo(() => {
    if (!currentWizardStep || currentWizardStep.kind !== 'dynamic') {
      return []
    }
    const stepName = toNormalizedString(currentWizardStep.formStep.name)
    const stepLabel = toNormalizedString(currentWizardStep.formStep.label)
    const stepVariant = toNormalizedString(
      (currentWizardStep.formStep as { variant?: string | null }).variant
    )
    const isCoordinateStep =
      stepVariant === 'location' ||
      stepVariant === 'coordinates' ||
      stepVariant === 'map' ||
      stepVariant === 'localisation' ||
      stepVariant === 'adresse' ||
      stepName.includes('coordinate') ||
      stepLabel.includes('coordinate') ||
      stepName.includes('coordonnees') ||
      stepLabel.includes('coordonnees') ||
      stepName.includes('localisation') ||
      stepLabel.includes('localisation') ||
      stepName.includes('adresse') ||
      stepLabel.includes('adresse') ||
      stepName.includes('location') ||
      stepLabel.includes('location')

    return currentWizardStep.formStep.fields
      .filter(field => shouldDisplayDynamicField(field))
      .filter(field => !isMapControlField(field))
      .filter(field => {
        if (isFieldMandatory(field)) {
          return true
        }
        if (!isCoordinateStep) {
          return false
        }
        const normalizedName = toNormalizedString(field.name)
        const normalizedRole = toNormalizedString(
          (field as { uiRole?: string | null }).uiRole
        )
        if (normalizedRole) {
          if (
            normalizedRole === 'latitude' ||
            normalizedRole === 'lat' ||
            normalizedRole === 'coordonnees_latitude'
          ) {
            return true
          }
          if (
            normalizedRole === 'longitude' ||
            normalizedRole === 'lng' ||
            normalizedRole === 'lon' ||
            normalizedRole === 'coordonnees_longitude'
          ) {
            return true
          }
          if (
            normalizedRole === 'address' ||
            normalizedRole === 'adresse' ||
            normalizedRole === 'location' ||
            normalizedRole === 'localisation' ||
            normalizedRole === 'map' ||
            normalizedRole === 'location_label'
          ) {
            return true
          }
        }
        return (
          normalizedName.includes('latitude') ||
          normalizedName.includes('longitude') ||
          containsIsolatedToken(normalizedName, 'lat') ||
          containsIsolatedToken(normalizedName, 'lng') ||
          containsIsolatedToken(normalizedName, 'lon') ||
          normalizedName.includes('address') ||
          normalizedName.includes('location')
        )
      })
      .map(field => resolveFieldPath(field.name))
  }, [currentWizardStep, resolveFieldPath, shouldDisplayDynamicField])

  const currentDynamicStepRequiredValues: unknown[] = watch(
    currentDynamicStepRequiredPaths as any
  ) as unknown[]

  const hasErrorsForCurrentStep = useMemo(() => {
    if (!currentWizardStep || currentWizardStep.kind !== 'dynamic') {
      return false
    }
    return currentDynamicStepFieldPaths.some(path => Boolean(getErrorForPath(path)))
  }, [currentDynamicStepFieldPaths, currentWizardStep, getErrorForPath])

  const hasEmptyMandatoryFields = useMemo(() => {
    if (!currentWizardStep || currentWizardStep.kind !== 'dynamic') {
      return false
    }
    const valuesArray = Array.isArray(currentDynamicStepRequiredValues)
      ? currentDynamicStepRequiredValues
      : []
    return currentDynamicStepRequiredPaths.some((_, index) =>
      isValueEmpty(valuesArray[index])
    )
  }, [
    currentDynamicStepRequiredPaths,
    currentDynamicStepRequiredValues,
    currentWizardStep
  ])

  const isNextActionDisabled =
    currentWizardStep?.kind === 'dynamic' &&
    (isSubmitting || hasErrorsForCurrentStep || hasEmptyMandatoryFields)

  const handleStepSelect = useCallback(
    (stepIndex: number) => {
      if (!wizardSteps.length) {
        return
      }
      if (stepIndex < 0 || stepIndex >= wizardSteps.length) {
        return
      }
      if (stepIndex > maxUnlockedStepIndex) {
        return
      }
      setActiveDynamicStepIndex(stepIndex)
    },
    [maxUnlockedStepIndex, wizardSteps]
  )

  const handleNextStep = useCallback(async () => {
    if (!wizardSteps.length) {
      return
    }
    const currentStep = wizardSteps[activeDynamicStepIndex]
    if (!currentStep) {
      return
    }
    if (currentStep.kind === 'dynamic') {
      const fieldsToValidate = getStepValidationFields(currentStep.formStep)
      if (fieldsToValidate.length > 0) {
        const isValid = await trigger(fieldsToValidate as any, { shouldFocus: true })
        if (!isValid) {
          return
        }
      }
    }

    const nextIndex = activeDynamicStepIndex + 1
    if (nextIndex < wizardSteps.length) {
      setActiveDynamicStepIndex(nextIndex)
      setMaxUnlockedStepIndex(prev => Math.max(prev, nextIndex))
    }
  }, [activeDynamicStepIndex, getStepValidationFields, trigger, wizardSteps])

  const handlePreviousStep = useCallback(() => {
    if (activeDynamicStepIndex === 0) {
      return
    }
    setActiveDynamicStepIndex(prev => Math.max(prev - 1, 0))
  }, [activeDynamicStepIndex])

  useEffect(() => {
    if (categoriesLoading) {
      return
    }

    const currentCategoryId = getValues('categoryId')
    if (!currentCategoryId && !visibleRootCategories.length) {
      setSelectedRootCategoryId('')
      setValue('adType', '', { shouldDirty: false, shouldValidate: false })
    }
  }, [categoriesLoading, getValues, setValue, visibleRootCategories.length])

  useEffect(() => {
    if (!selectedRootCategoryId) {
      setValue('categoryId', '', { shouldDirty: false, shouldValidate: true })
      return
    }

    const childCategories = (childrenByParent[selectedRootCategoryId] ?? []).filter(category =>
      subCategoryVisibleForUser(category, isPro)
    )
    const currentCategoryId = getValues('categoryId')
    const isLoadingChildren = Boolean(childrenLoading[selectedRootCategoryId])

    if (!childCategories.length) {
      if (isLoadingChildren) {
        return
      }
      if (currentCategoryId !== selectedRootCategoryId) {
        setValue('categoryId', selectedRootCategoryId, { shouldDirty: true, shouldValidate: true })
        setValue('adType', '', { shouldDirty: false, shouldValidate: false })
      }
      return
    }

    if (!currentCategoryId || !childCategories.some(category => category.id === currentCategoryId)) {
      setValue('categoryId', '', { shouldDirty: false, shouldValidate: false })
      setValue('adType', '', { shouldDirty: false, shouldValidate: false })
    }
  }, [childrenByParent, childrenLoading, getValues, isPro, selectedRootCategoryId, setValue])

  useEffect(() => {
    CATEGORY_EXTRA_FIELD_KEYS.forEach(field => {
      if (!selectedExtraFieldSet.has(field)) {
        setValue(field, '', { shouldDirty: false, shouldValidate: false })
      }
    })
  }, [selectedExtraFieldSet, setValue])

  useEffect(() => {
    // Reset dynamic details when switching categories to avoid leaking values.
    setValue('details', { handover_modes: ['pickup'] }, { shouldValidate: false })
    setValue('subject', '', { shouldValidate: false, shouldDirty: false })
    setValue('body', '', { shouldValidate: false, shouldDirty: false })
    setValue('price_cents', '', { shouldValidate: false, shouldDirty: false })
    setValue('price_reco', '', { shouldValidate: false, shouldDirty: false })
    setValue('donation', false, { shouldValidate: false, shouldDirty: false })
    setValue('phone', '', { shouldValidate: false, shouldDirty: false })
    setValue('phone_hidden_information_text', false, {
      shouldValidate: false,
      shouldDirty: false
    })
    setValue('locationHideExact', false, { shouldValidate: false, shouldDirty: false })
  }, [selectedCategoryId, setValue])

  useEffect(() => {
    setActiveDynamicStepIndex(0)
    setMaxUnlockedStepIndex(0)
  }, [selectedCategoryId, totalWizardSteps])

  useEffect(() => {
    const totalSteps = totalWizardSteps
    if (totalSteps === 0) {
      setActiveDynamicStepIndex(0)
      setMaxUnlockedStepIndex(0)
      return
    }
    setActiveDynamicStepIndex(prev => (prev >= totalSteps ? totalSteps - 1 : prev))
    setMaxUnlockedStepIndex(prev => {
      if (prev >= totalSteps) {
        return totalSteps - 1
      }
      return Math.max(prev, 0)
    })
  }, [totalWizardSteps])

  useEffect(() => {
    if (!hasSelectedCategory || !activeDynamicStepId) {
      return
    }
    if (typeof window === 'undefined') {
      return
    }
    const element = document.getElementById(`listing-step-${activeDynamicStepId}`)
    if (!element) {
      return
    }
    const offset = 96
    const y = element.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top: y, behavior: 'smooth' })
  }, [activeDynamicStepId, hasSelectedCategory])

  useEffect(() => {
    if (!schema) return

    schema.steps?.forEach(step => {
      step.fields.forEach(field => {
        if (isMapControlField(field)) {
          return
        }
        const path = resolveFieldPath(field.name)
        const currentValue = getValues(path as any)

        if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
          return
        }

        if (field.defaultValue !== undefined) {
          setValue(path as any, field.defaultValue, { shouldDirty: false, shouldValidate: false })
          return
        }

        if (field.type === 'chips' || field.type === 'multiselect') {
          setValue(path as any, [], { shouldDirty: false, shouldValidate: false })
          return
        }

        if (field.type === 'switch' || field.type === 'checkbox') {
          setValue(path as any, false, { shouldDirty: false, shouldValidate: false })
        }
      })
    })
  }, [schema, setValue, getValues, resolveFieldPath])

  const getFieldError = (name: keyof NewListingFormValues) => {
    const fieldError = errors[name]
    if (!fieldError) return undefined
    if (Array.isArray(fieldError)) {
      return fieldError.map(entry => ('message' in entry ? entry.message : '')).join(', ')
    }
    if (typeof fieldError === 'object' && fieldError !== null && 'message' in fieldError) {
      return String(fieldError.message)
    }
    return undefined
  }

  const handleRootSelect = (category: Category) => {
    setSelectedRootCategoryId(category.id)
    setValue('categoryId', '', { shouldDirty: true, shouldValidate: false })
    setValue('adType', '', { shouldDirty: false, shouldValidate: false })
    loadChildren(category.id)
      .then(children => {
        const visibleChildren = children.filter(child => subCategoryVisibleForUser(child, isPro))
        if (visibleChildren.length === 0) {
          setValue('categoryId', category.id, { shouldDirty: true, shouldValidate: true })
          setValue('adType', '', { shouldDirty: false, shouldValidate: false })
        }
      })
      .catch(() => {
        setValue('categoryId', category.id, { shouldDirty: true, shouldValidate: true })
        setValue('adType', '', { shouldDirty: false, shouldValidate: false })
      })
  }

  const handleSubCategorySelect = (category: Category) => {
    setValue('categoryId', category.id, { shouldDirty: true, shouldValidate: true })
    setValue('adType', '', { shouldDirty: false, shouldValidate: false })
  }

  const handleReset = () => {
    reset({ ...INITIAL_FORM, categoryId: '', details: { handover_modes: ['pickup'] } })
    setImages([])
    setSelectedRootCategoryId('')
  }

  const onSubmit = async (values: NewListingFormValues) => {
    if (isSubmitting) return

    setIsSubmitting(true)
    setPageError(null)

    const details = values.details ? { ...values.details } : {}
    const {
      latitude,
      longitude,
      address,
      location: legacyLocation,
      ...restDetails
    } = details as {
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

    const newDetails: Record<string, unknown> = restDetails

    for (const key of Object.keys(newDetails)) {
      if (ROOT_LISTING_FIELDS.has(key)) {
        delete newDetails[key]
      }
    }

    const rawHandoverModes = (newDetails as any).handover_modes
    const normalizedHandoverModes = Array.isArray(rawHandoverModes)
      ? rawHandoverModes
          .map(mode => String(mode).toLowerCase())
          .filter(mode => mode === 'pickup' || mode === 'delivery')
      : []

    if (!normalizedHandoverModes.length) {
      setIsSubmitting(false)
      setError('details.handover_modes' as never, {
        type: 'manual',
        message: t('listings.new.handover.required')
      })
      return
    }

    ;(newDetails as any).handover_modes = normalizedHandoverModes

    const latNumber =
      typeof latitude === 'number'
        ? latitude
        : typeof latitude === 'string'
        ? Number(latitude)
        : undefined
    const lngNumber =
      typeof longitude === 'number'
        ? longitude
        : typeof longitude === 'string'
        ? Number(longitude)
        : undefined
    const legacyLocationLat =
      typeof legacyLocation === 'object' && legacyLocation !== null
        ? Number((legacyLocation as { latitude?: unknown }).latitude)
        : undefined
    const legacyLocationLng =
      typeof legacyLocation === 'object' && legacyLocation !== null
        ? Number((legacyLocation as { longitude?: unknown }).longitude)
        : undefined
    const legacyLocationAddress =
      typeof legacyLocation === 'object' && legacyLocation !== null
        ? toTrimmedString((legacyLocation as { address?: unknown }).address as string | undefined)
        : toTrimmedString(typeof legacyLocation === 'string' ? legacyLocation : '')

    const resolvedAddress = toTrimmedString(
      typeof address === 'string'
        ? address
        : legacyLocationAddress || values.location
    )
    const hideExact = toBoolean((values as any).locationHideExact)

    if (resolvedAddress && (latNumber === undefined || lngNumber === undefined)) {
      setIsSubmitting(false)
      setPageError(t('forms.mapPicker.errors.locationRequired'))
      return
    }

    let locationPayload: { latitude: number; longitude: number; address: string } | null = null
    const latitudeCandidate = Number.isFinite(latNumber)
      ? Number(latNumber)
      : Number.isFinite(legacyLocationLat)
      ? Number(legacyLocationLat)
      : undefined
    const longitudeCandidate = Number.isFinite(lngNumber)
      ? Number(lngNumber)
      : Number.isFinite(legacyLocationLng)
      ? Number(legacyLocationLng)
      : undefined

    if (
      latitudeCandidate !== undefined &&
      longitudeCandidate !== undefined &&
      resolvedAddress
    ) {
      locationPayload = {
        latitude: latitudeCandidate,
        longitude: longitudeCandidate,
        address: resolvedAddress
      }
    }

    const dynamicSteps = wizardSteps
      .filter((step): step is Extract<typeof step, { kind: 'dynamic' }> => step.kind === 'dynamic')
      .map(step => step.formStep)
    const hasSubjectField = dynamicSteps.some(step => step.fields.some(field => field.name === 'subject'))
    const hasBodyField = dynamicSteps.some(step => step.fields.some(field => field.name === 'body'))
    const hasDescriptionField = dynamicSteps.some(step =>
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
      setIsSubmitting(false)
      const message = t('forms.validation.minLength', { min: 10 })
      const descriptionErrorPath = hasBodyField
        ? ('body' as never)
        : hasDescriptionField
        ? ('description' as never)
        : ('description' as never)

      setError(descriptionErrorPath, { type: 'manual', message })
      return
    }
    const priceInput = toTrimmedString(values.price)
    const priceAmount = Number(priceInput)

    const currency = toTrimmedString(values.currency)
    const city = toTrimmedString(values.city)
    const zipcode = toTrimmedString((values as any).zipcode)

    const email = toTrimmedString((values as any).email ?? (newDetails as any).email)
    const phone = toTrimmedString((values as any).phone ?? (newDetails as any).phone)
    const phoneHidden = toBoolean((values as any).phone_hidden_information_text ?? (newDetails as any).phone_hidden)
    const noSalesmen = toBoolean((newDetails as any).no_salesmen)

    const newItemPriceRaw = toTrimmedString((newDetails as any).new_item_price)
    const newItemPrice = newItemPriceRaw ? Number(newItemPriceRaw) : undefined
    const customRef = toTrimmedString((newDetails as any).custom_ref)

    const sanitizedDetails = sanitizeDetails(newDetails)

    // Nettoyer les attributs pour ne garder que les champs dynamiques pertinents
    const attributes: Record<string, unknown> | null = sanitizedDetails
      ? (() => {
          const clone: Record<string, unknown> = { ...sanitizedDetails }
          ;['email', 'phone', 'phone_hidden', 'no_salesmen', 'new_item_price', 'custom_ref'].forEach(key => {
            delete clone[key]
          })
          return clone
        })()
      : null

    const payload: Record<string, unknown> = {
      categoryId: selectedRootCategoryId || values.categoryId,
      subCategoryId: values.categoryId,
      adType: values.adType || null,
      title,
      description,
      ...(Number.isFinite(priceAmount) ? { price: { amount: Number(priceAmount), currency, newItemPrice } } : {}),
      location: {
        city: city || undefined,
        zipcode: zipcode || undefined,
        address: resolvedAddress || undefined,
        lat: locationPayload?.latitude ?? undefined,
        lng: locationPayload?.longitude ?? undefined,
        hideExact: hideExact || false
      },
      contact: {
        email: email || undefined,
        phone: phone || undefined,
        phoneHidden,
        noSalesmen
      },
      attributes: attributes ?? {},
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
      const listing = await apiPost<Listing>('/listings', payload)

      addToast({
        variant: 'success',
        title: t('listings.new.toast.createdTitle'),
        message: t('listings.new.toast.createdMessage')
      })
      setImages([])
      reset({ ...INITIAL_FORM, categoryId: values.categoryId, details: { handover_modes: ['pickup'] } })
      navigate(`/listings/edit/${listing.id}`, { replace: true })
    } catch (err) {
      console.error('Unable to create listing', err)

      if (isUnauthorizedError(err)) {
        const sessionMessage = t('auth.sessionExpired')
        clearAuthToken()
        setPageError(sessionMessage)
        addToast({
          variant: 'error',
          title: t('auth.requiredTitle'),
          message: sessionMessage
        })
        navigate('/login', {
          replace: true,
          state: { from: '/listings/new' }
        })
      } else {
        const message =
          err instanceof Error
            ? err.message
            : t('listings.new.toast.errorMessage')
        setPageError(message)
        addToast({
          variant: 'error',
          title: t('listings.new.toast.errorTitle'),
          message
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderBaseStep = () => {
    const categoryError = getFieldError('categoryId')
    return (
      <>
        <section className="dashboard-section">
          <div className="dashboard-section__head">
            <h2>{t('listings.new.category.title')}</h2>
            <span className="lbc-link">
              {categoriesLoading ? t('loading.inline') : t('listings.new.step.single', { step: 1 })}
            </span>
          </div>

          <p style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '18px' }}>
            {t('listings.new.category.subtitle')}
          </p>

          <div style={CATEGORY_GRID_STYLE}>
            {visibleRootCategories.map(category => {
              const childList = childrenByParent[category.id] ?? []
              const childSummary = childList.slice(0, 4).map(child => child.name).join(', ')
              const isRootSelected =
                category.id === selectedRootCategoryId ||
                (!selectedRootCategoryId && selectedCategoryId === category.id && childList.length === 0)

              return (
                <button
                  key={category.id}
                  type="button"
                  className="card category-choice-card"
                  style={getCategoryCardStyle(isRootSelected)}
                  onClick={() => handleRootSelect(category)}
                >
                  {renderCategoryIcon(category.icon, '🗂️', category.name)}
                  <span style={CATEGORY_CARD_NAME_STYLE}>{category.name}</span>
                  {childSummary ? (
                    <span style={CATEGORY_CARD_DESC_STYLE}>{childSummary}</span>
                  ) : category.description ? (
                    <span style={CATEGORY_CARD_DESC_STYLE}>{category.description}</span>
                  ) : null}
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('listings.new.category.chooseAction')}</span>
                </button>
              )
            })}
          </div>

          {selectedRootCategoryId ? (
            <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{t('listings.new.category.subcategoryTitle')}</h3>
                <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                  {t('listings.new.category.subcategorySubtitle')}
                </p>
              </div>
              {childrenLoading[selectedRootCategoryId] ? (
                <p style={{ color: '#6b7280' }}>{t('listings.new.category.loadingSubcategories')}</p>
              ) : visibleSubCategories.length > 0 ? (
                <div style={CATEGORY_GRID_STYLE}>
                  {visibleSubCategories
                    .filter(child => child.parentId === selectedRootCategoryId)
                    .map(child => {
                    const isSelected = selectedCategoryId === child.id
                    return (
                      <button
                        key={child.id}
                        type="button"
                        className="card category-choice-card"
                        style={getCategoryCardStyle(isSelected)}
                        onClick={() => handleSubCategorySelect(child)}
                      >
                        {renderCategoryIcon(child.icon, '📂', child.name)}
                        <span style={CATEGORY_CARD_NAME_STYLE}>{child.name}</span>
                        {child.description ? (
                          <span style={CATEGORY_CARD_DESC_STYLE}>{child.description}</span>
                        ) : null}
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('listings.new.category.continueAction')}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p style={{ color: '#6b7280' }}>
                  {t('listings.new.category.noSubcategory')}
                </p>
              )}
              <div style={{ marginTop: '8px' }}>
                <Button variant="outline" onClick={() => setSelectedRootCategoryId('')}>
                  {t('listings.new.category.chooseAnother')}
                </Button>
              </div>
            </div>
          ) : null}

          {categoryError ? (
            <p className="form-field__error" role="alert" style={{ marginTop: '20px' }}>
              {categoryError}
            </p>
          ) : null}
        </section>

        {hasSelectedCategory && (wizardSections.length > 0 || isLoadingSchema) ? (
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '-4px', marginBottom: '12px' }}>
            {t('listings.new.sections.intro')}
          </p>
        ) : null}

        {hasSelectedCategory && selectedCategoryAdTypes.length > 0 ? (
          <section className="dashboard-section">
            <div className="dashboard-section__head">
              <h2>{t('listings.new.adType.title')}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedCategoryAdTypes.map(option => {
                const checked = selectedAdType === option.value
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
                      background: checked ? 'rgba(255,110,20,0.06)' : '#fff'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={event => {
                        const next = event.target.checked ? option.value : ''
                        setValue('adType', next, { shouldDirty: true, shouldValidate: true })
                        setActiveDynamicStepIndex(0)
                        setMaxUnlockedStepIndex(0)
                      }}
                      style={{ marginTop: '4px' }}
                    />
                    <span>
                      <div style={{ fontWeight: 600 }}>{option.label}</div>
                      {option.description ? (
                        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{option.description}</div>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        ) : null}

        {hasSelectedCategory ? (
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

        {hasSelectedCategory && !isLoadingSchema && !hasDynamicSteps && !schemaError ? (
          <section className="dashboard-section">
            <div className="dashboard-section__head">
              <h2>{t('listings.new.dynamicFields.title')}</h2>
            </div>
            <p style={{ color: '#6b7280' }}>
              {t('listings.new.dynamicFields.empty')}
            </p>
          </section>
        ) : null}
      </>
    )
  }

  const renderFormSectionsOverview = () => {
    if (!selectedCategoryId) {
      return null
    }

    if (isLoadingSchema) {
      return (
        <section className="dashboard-section">
          <div className="dashboard-section__head">
            <h2>{t('listings.new.formSections.title')}</h2>
          </div>
          <p style={{ color: '#6b7280' }}>{t('listings.new.formSections.loading')}</p>
        </section>
      )
    }

    if (requiresAdTypeSelection && !selectedAdType) {
      return (
        <section className="dashboard-section">
          <div className="dashboard-section__head">
            <h2>{t('listings.new.formSections.title')}</h2>
          </div>
          <p style={{ color: '#6b7280' }}>
            {t('listings.new.formSections.requireAdType')}
          </p>
        </section>
      )
    }

    if (!wizardSections.length) {
      return null
    }

    return (
      <section className="dashboard-section">
        <div className="dashboard-section__head">
          <h2>{t('listings.new.formSections.title')}</h2>
          <span>{t('listings.new.formSections.subtitle')}</span>
        </div>
        <ol style={FORM_SECTIONS_LIST_STYLE}>
          {wizardSections.map(section => (
            <li key={section.id}>
              <button
                type="button"
                style={{
                  ...FORM_SECTION_BUTTON_STYLE,
                  border: section.index === activeDynamicStepIndex
                    ? '2px solid var(--color-primary, #ff6e14)'
                    : FORM_SECTION_BUTTON_STYLE.border,
                  boxShadow: section.index === activeDynamicStepIndex
                    ? '0 14px 32px rgba(255, 110, 20, 0.16)'
                    : FORM_SECTION_BUTTON_STYLE.boxShadow,
                  cursor: section.index <= maxUnlockedStepIndex ? 'pointer' : 'not-allowed',
                  opacity: section.index <= maxUnlockedStepIndex ? 1 : 0.55
                }}
                onClick={() => handleStepSelect(section.index)}
                aria-label={t('listings.new.formSections.stepAria', { step: section.index + 1, label: section.label })}
                disabled={section.index > maxUnlockedStepIndex}
              >
                <span style={FORM_SECTION_BADGE_STYLE}>{t('listings.new.step.single', { step: section.index + 1 })}</span>
                <span style={FORM_SECTION_TITLE_STYLE}>{section.label}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color:
                      section.index < activeDynamicStepIndex
                        ? '#16a34a'
                        : section.index === activeDynamicStepIndex
                        ? '#2563eb'
                        : '#94a3b8',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}
                >
                  {section.index < activeDynamicStepIndex
                    ? t('listings.new.formSections.status.completed')
                    : section.index === activeDynamicStepIndex
                    ? t('listings.new.formSections.status.current')
                    : section.index <= maxUnlockedStepIndex
                    ? t('listings.new.formSections.status.available')
                    : t('listings.new.formSections.status.locked')}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    )
  }

  const renderMediaStep = (
    stepIndex: number,
    totalSteps: number,
    info: string[],
    actions: ReactNode
  ) => (
    <section className="dashboard-section" id="listing-step-media">
      <div className="dashboard-section__head">
        <div style={STEP_HEADER_WRAPPER_STYLE}>
          {totalSteps > 0 ? (
            <span style={STEP_BADGE_STYLE}>
              {t('listings.new.step.progress', { current: stepIndex + 1, total: totalSteps })}
            </span>
          ) : null}
          <h2>{t('listings.new.media.title')}</h2>
        </div>
      </div>
      <div style={STEP_CARD_STYLE}>
        <ImagesManager value={images} onChange={setImages} disabled={isSubmitting} />
        {actions ? <div style={STEP_ACTIONS_STYLE}>{actions}</div> : null}
      </div>
    </section>
  )

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('listings.new.title')}</h1>
            <p>
              {t('listings.new.subtitle')}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard/listings')}>
            {t('listings.new.viewListings')}
          </Button>
        </header>

        <FormProvider {...methods}>
          <form className="listing-form listing-form--single-column" onSubmit={handleSubmit(onSubmit)}>
            <input
              type="hidden"
              {...register('categoryId', {
                required: t('listings.new.category.required')
              })}
            />
            {renderBaseStep()}
            {renderFormSectionsOverview()}
            {currentWizardStep ? (
              currentWizardStep.kind === 'dynamic' ? (
                <DynamicFormStep
                  key={currentWizardStep.id}
                  step={currentWizardStep.formStep}
                  basePath="details"
                  stepIndex={activeDynamicStepIndex}
                  totalSteps={totalWizardSteps}
                  isMapStep={currentWizardStep.isMapStep}
                  priceSuggestion={priceSuggestion}
                  priceSuggestionLoading={priceSuggestionLoading}
                  onApplyPriceSuggestion={handleApplyPriceSuggestion}
                  actions={
                    <>
                      {activeDynamicStepIndex > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handlePreviousStep}
                          disabled={isSubmitting}
                        >
                          {t('actions.previousStep')}
                        </Button>
                      ) : null}
                      {activeDynamicStepIndex < totalWizardSteps - 1 ? (
                        <Button
                          type="button"
                          onClick={handleNextStep}
                          disabled={Boolean(isNextActionDisabled)}
                        >
                          {t('actions.nextStep')}
                        </Button>
                      ) : null}
                    </>
                  }
                />
              ) : (
                renderMediaStep(
                  activeDynamicStepIndex,
                  totalWizardSteps,
                  currentWizardStep.info,
                  activeDynamicStepIndex > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePreviousStep}
                      disabled={isSubmitting}
                    >
                      {t('actions.previousStep')}
                    </Button>
                  ) : null
                )
              )
            ) : null}

            {schemaError ? (
              <p className="auth-form__error" role="alert">
                {schemaError}
              </p>
            ) : null}

            {pageError ? (
              <p className="auth-form__error" role="alert">
                {pageError}
              </p>
            ) : null}

            {isFinalWizardStep && currentWizardStep?.kind === 'media' ? (
              <div
                className="auth-form__actions"
                style={{ justifyContent: 'space-between', gap: '12px', marginTop: '24px' }}
              >
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleReset}
                    disabled={isSubmitting}
                  >
                    {t('actions.reset')}
                  </Button>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button type="submit" disabled={isSubmitting || isLoadingSchema}>
                    {isSubmitting ? t('listings.new.publishing') : t('listings.new.publish')}
                  </Button>
                </div>
              </div>
            ) : null}
          </form>
        </FormProvider>
      </div>
    </DashboardLayout>
  )
}
