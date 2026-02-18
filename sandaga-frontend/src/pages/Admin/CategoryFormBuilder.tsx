import { useEffect, useMemo, useState, type MouseEventHandler, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../utils/api'
import { Category, FormStep, FormField } from '../../types/category'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useI18n } from '../../contexts/I18nContext'

type FieldOptionDraft = {
  key: string
  value: string
  label: string
  description?: string
}

type FieldDraft = {
  name: string
  label: string
  type: string
  unit: string
  options: FieldOptionDraft[]
  info: string
  rules: string
  disabled: boolean
  uiRole: string
}

type StepDraft = {
  name: string
  label: string
  order: string
  info: string
  variant: string
}

type IconProps = {
  size?: number
}

const getFieldTypeOptions = (
  t: (key: string, values?: Record<string, string | number>) => string
) => [
  { value: 'text', label: t('admin.formBuilder.fieldTypes.text') },
  { value: 'textarea', label: t('admin.formBuilder.fieldTypes.textarea') },
  { value: 'number', label: t('admin.formBuilder.fieldTypes.number') },
  { value: 'select', label: t('admin.formBuilder.fieldTypes.select') },
  { value: 'multiselect', label: t('admin.formBuilder.fieldTypes.multiselect') },
  { value: 'chips', label: t('admin.formBuilder.fieldTypes.chips') },
  { value: 'checkbox', label: t('admin.formBuilder.fieldTypes.checkbox') },
  { value: 'switch', label: t('admin.formBuilder.fieldTypes.switch') },
  { value: 'radio', label: t('admin.formBuilder.fieldTypes.radio') },
  { value: 'map', label: t('admin.formBuilder.fieldTypes.map') }
]

const getStepVariantOptions = (
  t: (key: string, values?: Record<string, string | number>) => string
) => [
  { value: '', label: t('admin.formBuilder.stepVariants.default') },
  { value: 'location', label: t('admin.formBuilder.stepVariants.location') },
  { value: 'localisation', label: t('admin.formBuilder.stepVariants.localisation') },
  { value: 'map', label: t('admin.formBuilder.stepVariants.map') },
  { value: 'coordinates', label: t('admin.formBuilder.stepVariants.coordinates') },
  { value: 'adresse', label: t('admin.formBuilder.stepVariants.address') }
]

const CHOICE_TYPES = ['select', 'chips', 'multiselect']

const getFieldUiRoleOptions = (
  t: (key: string, values?: Record<string, string | number>) => string
) => [
  { value: '', label: t('admin.formBuilder.uiRoles.default') },
  { value: 'location', label: t('admin.formBuilder.uiRoles.location') },
  { value: 'localisation', label: t('admin.formBuilder.uiRoles.localisation') },
  { value: 'address', label: t('admin.formBuilder.uiRoles.address') },
  { value: 'location_label', label: t('admin.formBuilder.uiRoles.locationLabel') },
  { value: 'latitude', label: t('admin.formBuilder.uiRoles.latitude') },
  { value: 'coordonnees_latitude', label: t('admin.formBuilder.uiRoles.latitudeAlias') },
  { value: 'longitude', label: t('admin.formBuilder.uiRoles.longitude') },
  { value: 'coordonnees_longitude', label: t('admin.formBuilder.uiRoles.longitudeAlias') },
  { value: 'map', label: t('admin.formBuilder.uiRoles.map') }
]

const isChoiceType = (type: string) => CHOICE_TYPES.includes(type)

const createOptionDraft = (): FieldOptionDraft => ({
  key: `opt-${Math.random().toString(16).slice(2)}-${Date.now()}`,
  value: '',
  label: ''
})

const EditIcon = ({ size = 18 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 21v-4.5L15.75 4.75a1.5 1.5 0 0 1 2.12 0l1.38 1.38a1.5 1.5 0 0 1 0 2.12L7.5 20.5Z" />
    <path d="M14.5 6.5 18 10" />
  </svg>
)

const DeleteIcon = ({ size = 18 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </svg>
)

const normalizeField = (field: FormField): FormField => ({
  ...field,
  values: field.values ?? [],
  default_checked: field.default_checked ?? false,
  disabled: field.disabled ?? false
})

const extractRuleEntries = (
  rules: unknown,
  fallbackKeyLabel: string
): Array<[string, string]> => {
  if (!rules) {
    return []
  }

  if (typeof rules === 'string') {
    try {
      const parsed = JSON.parse(rules)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return extractRuleEntries(parsed, fallbackKeyLabel)
      }
    } catch {
      // treat as raw string below
    }
    return [[fallbackKeyLabel, rules]]
  }

  if (typeof rules !== 'object') {
    return [[fallbackKeyLabel, String(rules)]]
  }

  return Object.entries(rules as Record<string, unknown>).map(([key, value]) => {
    let stringValue: string
    if (value === null || value === undefined) {
      stringValue = ''
    } else if (typeof value === 'object') {
      try {
        stringValue = JSON.stringify(value, null, 2)
      } catch {
        stringValue = String(value)
      }
    } else {
      stringValue = String(value)
    }
    return [key, stringValue]
  })
}

const toInfoArray = (info: unknown): string[] => {
  if (Array.isArray(info)) {
    return info.map(entry => String(entry)).filter(entry => entry.trim().length > 0)
  }
  if (typeof info === 'string') {
    return info
      .split(/\r?\n/)
      .map(entry => entry.trim())
      .filter(Boolean)
  }
  return []
}

const renderRulePreview = (rules: unknown, fallbackKeyLabel: string): string | null => {
  const entries = extractRuleEntries(rules, fallbackKeyLabel)
  if (!entries.length) {
    return null
  }

  return entries.map(([key, value]) => `${key} (${value})`).join(', ')
}

const normalizeStep = (step: FormStep): FormStep => ({
  ...step,
  order: step.order ?? 0,
  fields: (step.fields ?? []).map(normalizeField)
})

const normalizeCategoryData = (category: Category): Category => ({
  ...category,
  steps: (category.steps ?? []).map(normalizeStep).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})

const parseJsonIfNeeded = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const extractCategoryRights = (category: Category | null): { private: Set<string>; pro: Set<string> } => {
  if (!category) {
    return { private: new Set<string>(), pro: new Set<string>() }
  }

  const toRightsMap = (value: unknown): Record<string, Record<string, boolean>> | null => {
    const parsed = parseJsonIfNeeded(value)
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        const fromEntry = toRightsMap(entry)
        if (fromEntry) {
          return fromEntry
        }
      }
      return null
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    const rights = (parsed as Record<string, unknown>).rights
    if (!rights || typeof rights !== 'object' || Array.isArray(rights)) {
      return null
    }
    return rights as Record<string, Record<string, boolean>>
  }

  const direct = parseJsonIfNeeded((category as unknown as { rights?: unknown }).rights)
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    const directRights = direct as Record<string, Record<string, boolean>>
    return {
      private: new Set(
        Object.entries(directRights.private ?? {})
          .filter(([, enabled]) => enabled === true)
          .map(([flow]) => flow)
      ),
      pro: new Set(
        Object.entries(directRights.pro ?? {})
          .filter(([, enabled]) => enabled === true)
          .map(([flow]) => flow)
      )
    }
  }

  const fromRaw =
    toRightsMap((category as unknown as { extraFieldsRaw?: unknown }).extraFieldsRaw) ??
    toRightsMap((category as unknown as { extraFields?: unknown }).extraFields)

  if (fromRaw) {
    return {
      private: new Set(
        Object.entries(fromRaw.private ?? {})
          .filter(([, enabled]) => enabled === true)
          .map(([flow]) => flow)
      ),
      pro: new Set(
        Object.entries(fromRaw.pro ?? {})
          .filter(([, enabled]) => enabled === true)
          .map(([flow]) => flow)
      )
    }
  }

  return { private: new Set<string>(), pro: new Set<string>() }
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  subtitle: {
    marginTop: '6px',
    fontSize: '0.95rem',
    color: '#6b7280'
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    gap: '24px',
    alignItems: 'flex-start'
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '18px',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    background: '#f8fafc'
  },
  main: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  stepListEntry: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  stepListItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '6px',
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid transparent',
    background: '#ffffff',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    color: '#0f172a'
  },
  stepListItemActive: {
    borderColor: 'var(--color-primary, #ff6e14)',
    boxShadow: '0 12px 28px rgba(255, 110, 20, 0.18)',
    transform: 'translateY(-1px)'
  },
  stepListItemActions: {
    display: 'flex',
    justifyContent: 'flex-start',
    gap: '8px',
    paddingLeft: '6px'
  },
  stepListLabel: {
    fontWeight: 600,
    fontSize: '0.95rem'
  },
  stepListMeta: {
    fontSize: '0.8rem',
    color: '#94a3b8'
  },
  stepFlow: {
    fontSize: '0.8rem',
    color: '#2563eb',
    fontWeight: 600
  },
  stepAudienceRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  stepAudienceBadgePrivate: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 8px',
    borderRadius: '999px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  },
  stepAudienceBadgePro: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 8px',
    borderRadius: '999px',
    background: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fdba74',
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  },
  stepVariantBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 8px',
    borderRadius: '999px',
    background: '#e0f2fe',
    color: '#0369a1',
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.02em'
  },
  emptyStateCard: {
    borderRadius: '16px',
    border: '1px dashed #cbd5f5',
    background: '#f8fafc',
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'flex-start'
  },
  fieldComposer: {
    position: 'relative',
    borderRadius: '20px',
    border: '1px solid #e5e7eb',
    background: '#ffffff',
    padding: '24px',
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
    minHeight: '420px'
  },
  fieldComposerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px'
  },
  fieldComposerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  fieldComposerSubtitle: {
    fontSize: '0.9rem',
    color: '#94a3b8',
    marginTop: '4px'
  },
  fieldGrid: {
    marginTop: '24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px'
  },
  fieldCard: {
    padding: '18px',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  fieldCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  fieldCardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '12px',
    gap: '8px'
  },
  fieldCardName: {
    fontWeight: 600,
    color: '#0f172a'
  },
  fieldChip: {
    fontSize: '0.75rem',
    borderRadius: '999px',
    background: '#fff0e6',
    color: '#ff6e14',
    padding: '4px 10px',
    fontWeight: 600,
    textTransform: 'uppercase'
  },
  fieldMeta: {
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  fieldMetaRow: {
    display: 'flex',
    gap: '8px',
    fontSize: '0.85rem',
    color: '#475569'
  },
  fieldInfoList: {
    margin: 0,
    paddingLeft: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  fieldInfoItem: {
    fontSize: '0.82rem',
    color: '#1f2937'
  },
  fieldModalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.48)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 50
  },
  fieldModalCard: {
    width: 'min(720px, 100%)',
    maxHeight: '90vh',
    background: '#ffffff',
    borderRadius: '18px',
    boxShadow: '0 18px 36px rgba(15, 23, 42, 0.18)',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  fieldModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '24px'
  },
  fieldModalTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#0f172a'
  },
  fieldModalSubtitle: {
    marginTop: '6px',
    color: '#64748b',
    fontSize: '0.95rem'
  },
  fieldModalBody: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  fieldModalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px'
  },
  fieldModalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px'
  },
  fieldModalHint: {
    marginTop: '4px',
    fontSize: '0.8rem',
    color: '#94a3b8'
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    borderRadius: '12px',
    background: '#fee2e2',
    color: '#b91c1c',
    marginBottom: '12px'
  },
  optionSection: {
    borderTop: '1px solid #e2e8f0',
    paddingTop: '12px',
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  optionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  optionRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px'
  },
  optionInputs: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '8px'
  },
  optionRemoveButton: {
    alignSelf: 'center'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginTop: '14px'
  },
  fieldToggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '8px'
  },
  fieldToggleHelp: {
    fontSize: '0.8rem',
    color: '#94a3b8'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.48)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 1000
  },
  modalCard: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '28px',
    width: 'min(560px, 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    boxShadow: '0 18px 36px rgba(15, 23, 42, 0.16)'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#475569',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  iconButtonDanger: {
    color: '#dc2626',
    borderColor: '#fecaca',
    background: '#fff7f7'
  }
} as const

type IconButtonVariant = 'default' | 'danger'

type IconButtonProps = {
  label: string
  onClick: MouseEventHandler<HTMLButtonElement>
  variant?: IconButtonVariant
  children: ReactNode
}

const IconButton = ({ label, onClick, variant = 'default', children }: IconButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    style={{
      ...styles.iconButton,
      ...(variant === 'danger' ? styles.iconButtonDanger : {})
    }}
  >
    {children}
  </button>
)

export default function CategoryFormBuilder() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const fieldTypeOptions = useMemo(() => getFieldTypeOptions(t), [t])
  const stepVariantOptions = useMemo(() => getStepVariantOptions(t), [t])
  const fieldUiRoleOptions = useMemo(() => getFieldUiRoleOptions(t), [t])
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stepModal, setStepModal] = useState<{ mode: 'create' | 'edit'; step?: FormStep } | null>(null)
  const [stepDraft, setStepDraft] = useState<StepDraft>({
    name: '',
    label: '',
    order: '',
    info: '',
    variant: ''
  })

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [fieldDraft, setFieldDraft] = useState<FieldDraft>({
    name: '',
    label: '',
    type: 'text',
    unit: '',
    options: [],
    info: '',
    rules: '',
    disabled: false,
    uiRole: ''
  })
  const [fieldModal, setFieldModal] = useState<{ mode: 'create' | 'edit'; field?: FormField } | null>(null)

  const openCreateStepModal = () => {
    setError(null)
    const nextOrder = (category?.steps?.length ?? 0) + 1
    setStepDraft({ name: '', label: '', order: String(nextOrder), info: '', variant: '' })
    setStepModal({ mode: 'create' })
  }

  const openEditStepModal = (step: FormStep) => {
    setError(null)
    setStepDraft({
      name: step.name,
      label: step.label,
      order: step.order !== undefined && step.order !== null ? String(step.order) : '',
      info: toInfoArray(step.info).join('\n'),
      variant: step.variant ?? ''
    })
    setStepModal({ mode: 'edit', step })
  }

  const closeStepModal = () => {
    setStepModal(null)
    setStepDraft({ name: '', label: '', order: '', info: '', variant: '' })
  }

  const openFieldModal = (mode: 'create' | 'edit', field?: FormField) => {
    setError(null)
    if (mode === 'create') {
      setFieldDraft({
        name: '',
        label: '',
        type: 'text',
        unit: '',
        options: [],
        info: '',
        rules: '',
        disabled: false,
        uiRole: ''
      })
      setFieldModal({ mode: 'create' })
      return
    }

    if (field) {
      const options = (field.values ?? []).map(opt => ({
        key: `opt-${opt.value}-${Math.random().toString(16).slice(2)}`,
        value: opt.value ?? '',
        label: opt.label ?? '',
        description: opt.description ?? ''
      }))

      setFieldDraft({
        name: field.name,
        label: field.label,
        type: field.type ?? 'text',
        unit: field.unit ?? '',
        options: isChoiceType(field.type ?? '') ? (options.length ? options : [createOptionDraft()]) : [],
        info: toInfoArray(field.info).join('\n'),
        rules:
          field.rules && Object.keys(field.rules).length
            ? JSON.stringify(field.rules, null, 2)
            : '',
        disabled: field.disabled ?? false,
        uiRole: field.uiRole ?? ''
      })
      setFieldModal({ mode: 'edit', field })
    }
  }

  const closeFieldModal = () => {
    setFieldModal(null)
    setFieldDraft({
      name: '',
      label: '',
      type: 'text',
      unit: '',
      options: [],
      info: '',
      rules: '',
      disabled: false,
      uiRole: ''
    })
  }

  const handleFieldTypeChange = (nextType: string) => {
    setFieldDraft(prev => ({
      ...prev,
      type: nextType,
      options: isChoiceType(nextType)
        ? (prev.options.length ? prev.options : [createOptionDraft()])
        : []
    }))
  }

  const handleOptionChange = (key: string, property: 'value' | 'label' | 'description', value: string) => {
    setFieldDraft(prev => ({
      ...prev,
      options: prev.options.map(option =>
        option.key === key ? { ...option, [property]: value } : option
      )
    }))
  }

  const handleAddOption = () => {
    setFieldDraft(prev => ({
      ...prev,
      options: [...prev.options, createOptionDraft()]
    }))
  }

  const handleRemoveOption = (key: string) => {
    setFieldDraft(prev => ({
      ...prev,
      options: prev.options.filter(option => option.key !== key)
    }))
  }

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiGet<Category>(`/categories/${id}/form`),
      apiGet<Category>(`/categories/${id}`).catch(() => null)
    ])
      .then(([formData, fullCategory]) => {
        const normalized = normalizeCategoryData(formData)
        const mergedCategory = fullCategory
          ? {
              ...normalized,
              extraFields: fullCategory.extraFields ?? normalized.extraFields,
              extraFieldsRaw:
                (fullCategory as unknown as { extraFieldsRaw?: Record<string, unknown> | null })
                  .extraFieldsRaw ??
                normalized.extraFieldsRaw ??
                null
            }
          : normalized
        setCategory(mergedCategory)
        if (mergedCategory.steps?.length) {
          setSelectedStepId(mergedCategory.steps[0].id)
        }
      })
      .catch(err => {
        setError(err.message || t('admin.formBuilder.loadError'))
      })
      .finally(() => setLoading(false))
  }, [id, t])

  const selectedStep = useMemo<FormStep | null>(() => {
    if (!category?.steps || !selectedStepId) return null
    return category.steps.find(step => step.id === selectedStepId) ?? null
  }, [category?.steps, selectedStepId])

  const categoryRights = useMemo(() => extractCategoryRights(category), [category])

  const handleStepSubmit = async () => {
    if (!id || !stepModal) return
    if (!stepDraft.name.trim() || !stepDraft.label.trim()) {
      setError(t('admin.formBuilder.step.requiredError'))
      return
    }

    const trimmedOrder = stepDraft.order.trim()
    const parsedOrder = trimmedOrder ? Number.parseInt(trimmedOrder, 10) : undefined
    const infoItems = toInfoArray(stepDraft.info)
    const trimmedVariant = stepDraft.variant.trim()
    const payload: Partial<FormStep> & { name: string; label: string } = {
      name: stepDraft.name.trim(),
      label: stepDraft.label.trim(),
      ...(parsedOrder !== undefined && !Number.isNaN(parsedOrder)
        ? { order: parsedOrder }
        : {}),
      ...(infoItems.length ? { info: infoItems } : { info: null }),
      ...(trimmedVariant ? { variant: trimmedVariant } : { variant: null })
    }

    try {
      if (stepModal.mode === 'create') {
        const created = await apiPost<FormStep>(`/admin/forms/steps/category/${id}`, payload)
        const normalized = normalizeStep(created)
        setCategory(prev =>
          prev
            ? {
                ...prev,
                steps: [...(prev.steps ?? []), normalized].sort(
                  (a, b) => (a.order ?? 0) - (b.order ?? 0)
                )
              }
            : null
        )
        setSelectedStepId(normalized.id)
      } else if (stepModal.mode === 'edit' && stepModal.step) {
        const updated = await apiPatch<FormStep>(
          `/admin/forms/steps/${stepModal.step.id}`,
          payload
        )
        const normalized = normalizeStep(updated)
        setCategory(prev => {
          if (!prev?.steps) {
            return prev
          }
          const steps = prev.steps
            .map(step => (step.id === normalized.id ? { ...normalized } : step))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          return { ...prev, steps }
        })
      }
      setError(null)
      setStepDraft({ name: '', label: '', order: '', info: '', variant: '' })
      closeStepModal()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('admin.formBuilder.step.saveError')
      setError(message)
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!category?.steps?.length) return
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(t('admin.formBuilder.step.deleteConfirm'))
      if (!confirmed) {
        return
      }
    }

    try {
      await apiDelete(`/admin/forms/steps/${stepId}`)
      let nextSelectedId: string | null = null
      setCategory(prev => {
        if (!prev?.steps) {
          return prev
        }
        const remainingSteps = prev.steps.filter(step => step.id !== stepId)
        nextSelectedId = remainingSteps.length ? remainingSteps[0].id : null
        return { ...prev, steps: remainingSteps }
      })

      setSelectedStepId(prevSelected => {
        if (prevSelected !== stepId) {
          return prevSelected
        }
        return nextSelectedId
      })

      if (fieldModal) {
        closeFieldModal()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('admin.formBuilder.step.deleteError')
      setError(message)
    }
  }

  const handleFieldSubmit = async () => {
    if (!selectedStepId || !fieldModal) return
    if (!fieldDraft.name.trim() || !fieldDraft.label.trim()) {
      setError(t('admin.formBuilder.field.requiredError'))
      return
    }

    const isChoice = isChoiceType(fieldDraft.type)
    const normalizedOptions = isChoice
      ? fieldDraft.options
          .map(option => ({
            value: option.value.trim(),
            label: option.label.trim(),
            description: option.description?.trim()
          }))
          .filter(option => option.value && option.label)
      : undefined

    if (isChoice && (!normalizedOptions || normalizedOptions.length === 0)) {
      setError(t('admin.formBuilder.field.optionsRequired'))
      return
    }

    let parsedRules: Record<string, unknown> | null = null
    const rulesText = fieldDraft.rules.trim()
    if (rulesText) {
      try {
        const candidate = JSON.parse(rulesText)
        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
          parsedRules = candidate as Record<string, unknown>
        } else {
          setError(t('admin.formBuilder.field.rulesObjectError'))
          return
        }
      } catch (parseError) {
        setError(t('admin.formBuilder.field.rulesParseError'))
        return
      }
    }

    const infoItems = toInfoArray(fieldDraft.info)
    const trimmedUiRole = fieldDraft.uiRole.trim()

    const payload = {
      name: fieldDraft.name.trim(),
      label: fieldDraft.label.trim(),
      type: fieldDraft.type,
      unit: fieldDraft.unit.trim() ? fieldDraft.unit.trim() : null,
      values: isChoice ? normalizedOptions : [],
      info: infoItems.length ? infoItems : null,
      rules: parsedRules,
      disabled: fieldDraft.disabled,
      uiRole: trimmedUiRole ? trimmedUiRole : null
    }

    try {
      if (fieldModal.mode === 'create') {
        const created = await apiPost<FormField>(
          `/admin/forms/fields/step/${selectedStepId}`,
          payload
        )
        const normalizedField = normalizeField(created)

        setCategory(prev => {
          if (!prev?.steps) return prev
          const steps = prev.steps.map(step =>
            step.id === selectedStepId
              ? { ...step, fields: [...(step.fields ?? []), normalizedField] }
              : step
          )
          return { ...prev, steps }
        })
      } else if (fieldModal.mode === 'edit' && fieldModal.field) {
        const updated = await apiPatch<FormField>(
          `/admin/forms/fields/${fieldModal.field.id}`,
          payload
        )
        const normalizedField = normalizeField(updated)

        setCategory(prev => {
          if (!prev?.steps) return prev
          const steps = prev.steps.map(step =>
            step.id === selectedStepId
              ? {
                  ...step,
                  fields: step.fields.map(field =>
                    field.id === normalizedField.id ? normalizedField : field
                  )
                }
              : step
          )
          return { ...prev, steps }
        })
      }

      setError(null)
      setFieldDraft({
        name: '',
        label: '',
        type: 'text',
        unit: '',
        options: [],
        info: '',
        rules: '',
        disabled: false,
        uiRole: ''
      })
      closeFieldModal()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('admin.formBuilder.field.saveError')
      setError(message)
    }
  }

  const handleDeleteField = async (fieldId: string) => {
    if (!selectedStepId) return
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(t('admin.formBuilder.field.deleteConfirm'))
      if (!confirmed) {
        return
      }
    }

    try {
      await apiDelete(`/admin/forms/fields/${fieldId}`)

      setCategory(prev => {
        if (!prev?.steps) return prev
        const steps = prev.steps.map(step =>
          step.id === selectedStepId
            ? { ...step, fields: step.fields.filter(field => field.id !== fieldId) }
            : step
        )
        return { ...prev, steps }
      })

      if (fieldModal?.field?.id === fieldId) {
        closeFieldModal()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('admin.formBuilder.field.deleteError')
      setError(message)
    }
  }

  const renderStepList = () => {
    if (!category?.steps || category.steps.length === 0) {
      return (
        <div style={styles.emptyStateCard}>
          <h3>{t('admin.formBuilder.step.emptyTitle')}</h3>
          <p>{t('admin.formBuilder.step.emptyDescription')}</p>
          <Button type="button" onClick={openCreateStepModal}>
            {t('admin.formBuilder.step.create')}
          </Button>
        </div>
      )
    }

    return (
      <div style={styles.stepList}>
        {category.steps.map(step => {
          const isActive = step.id === selectedStepId
          const fieldCount = step.fields?.length ?? 0
          const normalizedFlow = step.flow?.trim().toLowerCase()
          const privateEnabled = normalizedFlow
            ? categoryRights.private.has(normalizedFlow)
            : categoryRights.private.size > 0
          const proEnabled = normalizedFlow
            ? categoryRights.pro.has(normalizedFlow)
            : categoryRights.pro.size > 0
          return (
            <div
              key={step.id}
              role="button"
              tabIndex={0}
              style={{
                ...styles.stepListItem,
                ...(isActive ? styles.stepListItemActive : {})
              }}
              onClick={() => setSelectedStepId(step.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedStepId(step.id)
                }
              }}
            >
              <span style={styles.stepListLabel}>{step.label}</span>
              {(step.flow || privateEnabled || proEnabled) ? (
                <span style={styles.stepAudienceRow}>
                  {step.flow ? <span style={styles.stepFlow}>{step.flow}</span> : null}
                  {privateEnabled ? <span style={styles.stepAudienceBadgePrivate}>Prive</span> : null}
                  {proEnabled ? <span style={styles.stepAudienceBadgePro}>Pro</span> : null}
                </span>
              ) : null}
              {step.variant ? (
                <span style={styles.stepVariantBadge}>
                  {stepVariantOptions.find(option => option.value === step.variant)?.label ??
                    step.variant}
                </span>
              ) : null}
              <span style={styles.stepListMeta}>
                {fieldCount === 1
                  ? t('admin.formBuilder.step.fieldCountSingle', { count: fieldCount })
                  : t('admin.formBuilder.step.fieldCountMultiple', { count: fieldCount })}
              </span>
              <div style={styles.stepListItemActions}>
                <IconButton
                  label={t('admin.formBuilder.step.edit')}
                  onClick={event => {
                    event.stopPropagation()
                    openEditStepModal(step)
                  }}
                >
                  <EditIcon size={16} />
                </IconButton>
                <IconButton
                  label={t('admin.formBuilder.step.delete')}
                  variant="danger"
                  onClick={event => {
                    event.stopPropagation()
                    handleDeleteStep(step.id)
                  }}
                >
                  <DeleteIcon size={16} />
                </IconButton>
              </div>
            </div>
          )
        })}
        <Button
          type="button"
          variant="outline"
          onClick={openCreateStepModal}
        >
          {t('admin.formBuilder.step.add')}
        </Button>
      </div>
    )
  }

  const renderStepModal = () => {
    if (!stepModal) return null
    const isEdit = stepModal.mode === 'edit'
    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalCard}>
          <h3>{isEdit ? t('admin.formBuilder.step.modalEditTitle') : t('admin.formBuilder.step.modalCreateTitle')}</h3>
          <p>{t('admin.formBuilder.step.modalDescription')}</p>
          <div style={styles.formGrid}>
            <div>
              <label>{t('admin.formBuilder.step.fields.name')}</label>
              <Input
                value={stepDraft.name}
                onChange={event => setStepDraft(prev => ({ ...prev, name: event.target.value }))}
                placeholder={t('admin.formBuilder.step.fields.namePlaceholder')}
              />
            </div>
            <div>
              <label>{t('admin.formBuilder.step.fields.label')}</label>
              <Input
                value={stepDraft.label}
                onChange={event => setStepDraft(prev => ({ ...prev, label: event.target.value }))}
                placeholder={t('admin.formBuilder.step.fields.labelPlaceholder')}
              />
            </div>
            <div>
              <label>{t('admin.formBuilder.step.fields.order')}</label>
              <Input
                type="number"
                min={0}
                value={stepDraft.order}
                onChange={event =>
                  setStepDraft(prev => ({ ...prev, order: event.target.value }))
                }
                placeholder={t('admin.formBuilder.step.fields.orderPlaceholder')}
              />
            </div>
            <div>
              <label>{t('admin.formBuilder.step.fields.variant')}</label>
              <Input
                value={stepDraft.variant}
                onChange={event =>
                  setStepDraft(prev => ({ ...prev, variant: event.target.value }))
                }
                placeholder={t('admin.formBuilder.step.fields.variantPlaceholder')}
                list="step-variant-suggestions"
              />
              <datalist id="step-variant-suggestions">
                {stepVariantOptions.filter(option => option.value).map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </datalist>
              <p style={styles.fieldModalHint}>
                {t('admin.formBuilder.step.fields.variantHint')}
              </p>
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label>{t('admin.formBuilder.step.fields.info')}</label>
            <textarea
              className="input"
              value={stepDraft.info}
              onChange={event =>
                setStepDraft(prev => ({ ...prev, info: event.target.value }))
              }
              rows={4}
              placeholder={t('admin.formBuilder.step.fields.infoPlaceholder')}
              style={{ resize: 'vertical' }}
            />
            <p style={styles.fieldModalHint}>
              {t('admin.formBuilder.step.fields.infoHint')}
            </p>
          </div>
          <div style={styles.modalActions}>
            <Button type="button" variant="ghost" onClick={closeStepModal}>
              {t('actions.cancel')}
            </Button>
            <Button type="button" onClick={handleStepSubmit}>
              {isEdit ? t('actions.save') : t('admin.formBuilder.step.create')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const renderFieldComposer = () => {
    if (!selectedStep) {
      return (
        <div style={styles.emptyStateCard}>
          <h3>{t('admin.formBuilder.step.selectTitle')}</h3>
          <p>{t('admin.formBuilder.step.selectDescription')}</p>
        </div>
      )
    }

    const infoEntries = toInfoArray(selectedStep.info)
    const fieldCount = selectedStep.fields?.length ?? 0
    const fieldCountLabel =
      fieldCount === 1
        ? t('admin.formBuilder.step.fieldCountSingle', { count: fieldCount })
        : t('admin.formBuilder.step.fieldCountMultiple', { count: fieldCount })
    const variantLabel = selectedStep.variant
      ? stepVariantOptions.find(option => option.value === selectedStep.variant)?.label ?? selectedStep.variant
      : null

    return (
      <div style={styles.fieldComposer}>
        <div style={styles.fieldComposerHeader}>
          <div>
            <h2>{selectedStep.label}</h2>
            <p style={styles.fieldComposerSubtitle}>
              {[selectedStep.name, variantLabel, fieldCountLabel]
                .filter(Boolean)
                .join(' • ')}
            </p>
            {infoEntries.length ? (
              <ul style={styles.fieldInfoList}>
                {infoEntries.map((entry, index) => (
                  <li key={`step-info-${index}`} style={styles.fieldInfoItem}>
                    {entry}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button type="button" onClick={() => openFieldModal('create')}>
            {t('admin.formBuilder.field.add')}
          </Button>
        </div>

        {selectedStep.fields?.length ? (
          <div style={styles.fieldGrid}>
            {selectedStep.fields.map(field => {
              const rulePreview = renderRulePreview(field.rules, t('admin.formBuilder.rules.valueKey'))
              const infoEntries = toInfoArray(field.info)
              const uiRoleLabel = field.uiRole
                ? fieldUiRoleOptions.find(option => option.value === field.uiRole)?.label ?? field.uiRole
                : null
              return (
              <div key={field.id} style={styles.fieldCard}>
                <div style={styles.fieldCardHeader}>
                  <span style={styles.fieldCardName}>{field.label}</span>
                  <span style={styles.fieldChip}>{field.type}</span>
                </div>
                <dl style={styles.fieldMeta}>
                  <div style={styles.fieldMetaRow}>
                    <dt>{t('admin.formBuilder.field.meta.identifier')}</dt>
                    <dd>{field.name}</dd>
                  </div>
                  {infoEntries.length ? (
                    <div style={styles.fieldMetaRow}>
                      <dt>{t('admin.formBuilder.field.meta.info')}</dt>
                      <dd>
                        <ul style={styles.fieldInfoList}>
                          {infoEntries.map((entry, index) => (
                            <li key={`${field.id}-info-${index}`} style={styles.fieldInfoItem}>
                              {entry}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ) : null}
                  {field.unit ? (
                    <div style={styles.fieldMetaRow}>
                      <dt>{t('admin.formBuilder.field.meta.unit')}</dt>
                      <dd>{field.unit}</dd>
                    </div>
                  ) : null}
                  {uiRoleLabel ? (
                    <div style={styles.fieldMetaRow}>
                      <dt>{t('admin.formBuilder.field.meta.uiRole')}</dt>
                      <dd>{uiRoleLabel}</dd>
                    </div>
                  ) : null}
                  <div style={styles.fieldMetaRow}>
                    <dt>{t('admin.formBuilder.field.meta.status')}</dt>
                    <dd>
                      {field.disabled
                        ? t('admin.formBuilder.field.status.disabled')
                        : t('admin.formBuilder.field.status.active')}
                    </dd>
                  </div>
                  {field.values?.length ? (
                    <div style={styles.fieldMetaRow}>
                      <dt>{t('admin.formBuilder.field.meta.options')}</dt>
                      <dd>
                        {field.values
                          .map(option =>
                            option.label
                              ? `${option.label} (${option.value})`
                              : option.value
                          )
                          .join(', ')}
                      </dd>
                    </div>
                  ) : null}
                  {rulePreview ? (
                    <div style={styles.fieldMetaRow}>
                      <dt>{t('admin.formBuilder.field.meta.rules')}</dt>
                      <dd>{rulePreview}</dd>
                    </div>
                  ) : null}
                </dl>
                <div style={styles.fieldCardActions}>
                  <IconButton
                    label={t('admin.formBuilder.field.edit')}
                    onClick={() => openFieldModal('edit', field)}
                  >
                    <EditIcon size={16} />
                  </IconButton>
                  <IconButton
                    label={t('admin.formBuilder.field.delete')}
                    variant="danger"
                    onClick={() => handleDeleteField(field.id)}
                  >
                    <DeleteIcon size={16} />
                  </IconButton>
                </div>
              </div>
              )
            })}
          </div>
        ) : (
          <div style={styles.emptyStateCard}>
            <p>{t('admin.formBuilder.field.empty')}</p>
            <Button type="button" variant="outline" onClick={() => openFieldModal('create')}>
              {t('admin.formBuilder.field.emptyAction')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  const renderFieldModal = () => {
    if (!fieldModal) return null
    const isEdit = fieldModal.mode === 'edit'

    return (
      <div style={styles.fieldModalOverlay}>
        <div style={styles.fieldModalCard}>
          <div style={styles.fieldModalHeader}>
            <div>
              <h3 style={styles.fieldModalTitle}>
                {isEdit
                  ? t('admin.formBuilder.field.modalEditTitle')
                  : t('admin.formBuilder.field.modalCreateTitle')}
              </h3>
              <p style={styles.fieldModalSubtitle}>
                {selectedStep
                  ? t('admin.formBuilder.field.modalSubtitleWithStep', { step: selectedStep.label })
                  : t('admin.formBuilder.field.modalSubtitle')}
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={closeFieldModal}>
              {t('admin.formBuilder.field.modalClose')}
            </Button>
          </div>

          <div style={styles.fieldModalBody}>
            <div style={styles.fieldModalGrid}>
              <div>
                <label>{t('admin.formBuilder.field.fields.name')}</label>
                <Input
                  value={fieldDraft.name}
                  onChange={event =>
                    setFieldDraft(prev => ({ ...prev, name: event.target.value }))
                  }
                  placeholder={t('admin.formBuilder.field.fields.namePlaceholder')}
                />
              </div>

              <div>
                <label>{t('admin.formBuilder.field.fields.label')}</label>
                <Input
                  value={fieldDraft.label}
                  onChange={event =>
                    setFieldDraft(prev => ({ ...prev, label: event.target.value }))
                  }
                  placeholder={t('admin.formBuilder.field.fields.labelPlaceholder')}
                />
              </div>

              <div>
                <Select
                  label={t('admin.formBuilder.field.fields.type')}
                  options={fieldTypeOptions}
                  value={fieldDraft.type}
                  onChange={value => handleFieldTypeChange(String(value))}
                />
              </div>

              <div>
                <label>{t('admin.formBuilder.field.fields.unit')}</label>
                <Input
                  value={fieldDraft.unit}
                  onChange={event =>
                    setFieldDraft(prev => ({ ...prev, unit: event.target.value }))
                  }
                  placeholder={t('admin.formBuilder.field.fields.unitPlaceholder')}
                />
              </div>
              <div>
                <label>{t('admin.formBuilder.field.fields.uiRole')}</label>
                <Input
                  value={fieldDraft.uiRole}
                  onChange={event =>
                    setFieldDraft(prev => ({ ...prev, uiRole: event.target.value }))
                  }
                  placeholder={t('admin.formBuilder.field.fields.uiRolePlaceholder')}
                  list="field-ui-role-suggestions"
                />
                <datalist id="field-ui-role-suggestions">
                  {fieldUiRoleOptions.filter(option => option.value).map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </datalist>
                <p style={styles.fieldModalHint}>
                  {t('admin.formBuilder.field.fields.uiRoleHint')}
                </p>
              </div>
            </div>

            <div style={styles.fieldToggleRow}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={!fieldDraft.disabled}
                  onChange={event =>
                    setFieldDraft(prev => ({ ...prev, disabled: !event.target.checked }))
                  }
                />
                <span>{t('admin.formBuilder.field.fields.active')}</span>
              </label>
              <span style={styles.fieldToggleHelp}>
                {t('admin.formBuilder.field.fields.activeHint')}
              </span>
            </div>

            <div>
              <label>{t('admin.formBuilder.field.fields.info')}</label>
              <textarea
                className="input"
                value={fieldDraft.info}
                onChange={event =>
                  setFieldDraft(prev => ({ ...prev, info: event.target.value }))
                }
                rows={4}
                placeholder={t('admin.formBuilder.field.fields.infoPlaceholder')}
                style={{ resize: 'vertical' }}
              />
              <p style={styles.fieldModalHint}>
                {t('admin.formBuilder.field.fields.infoHint')}
              </p>
            </div>

            <div>
              <label>{t('admin.formBuilder.field.fields.rules')}</label>
              <textarea
                className="input"
                value={fieldDraft.rules}
                onChange={event =>
                  setFieldDraft(prev => ({ ...prev, rules: event.target.value }))
                }
                rows={6}
                placeholder={t('admin.formBuilder.field.fields.rulesPlaceholder')}
                style={{ resize: 'vertical' }}
              />
              <p style={styles.fieldModalHint}>
                {t('admin.formBuilder.field.fields.rulesHint')}
              </p>
            </div>

            {isChoiceType(fieldDraft.type) ? (
              <div style={styles.optionSection}>
                <strong>{t('admin.formBuilder.field.options.title')}</strong>
                <div style={styles.optionList}>
                  {fieldDraft.options.map(option => (
                    <div key={option.key} style={styles.optionRow}>
                      <div style={styles.optionInputs}>
                        <Input
                          value={option.value}
                          onChange={event =>
                            handleOptionChange(option.key, 'value', event.target.value)
                          }
                          placeholder={t('admin.formBuilder.field.options.valuePlaceholder')}
                        />
                        <Input
                          value={option.label}
                          onChange={event =>
                            handleOptionChange(option.key, 'label', event.target.value)
                          }
                          placeholder={t('admin.formBuilder.field.options.labelPlaceholder')}
                        />
                        <Input
                          value={option.description ?? ''}
                          onChange={event =>
                            handleOptionChange(option.key, 'description', event.target.value)
                          }
                          placeholder={t('admin.formBuilder.field.options.descriptionPlaceholder')}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        style={styles.optionRemoveButton}
                        onClick={() => handleRemoveOption(option.key)}
                        disabled={fieldDraft.options.length <= 1}
                      >
                        {t('admin.formBuilder.field.options.remove')}
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={handleAddOption}>
                  {t('admin.formBuilder.field.options.add')}
                </Button>
              </div>
            ) : null}
          </div>

          <div style={styles.fieldModalFooter}>
            <Button type="button" variant="ghost" onClick={closeFieldModal}>
              {t('actions.cancel')}
            </Button>
            <Button type="button" onClick={handleFieldSubmit}>
              {isEdit ? t('actions.save') : t('admin.formBuilder.field.create')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div style={styles.page}>
        <header className="dashboard-header">
          <div>
            <h1>{t('admin.formBuilder.title')}</h1>
            <p style={styles.subtitle}>
              {t('admin.formBuilder.subtitle')}{' '}
              <strong>{category?.name ?? t('admin.formBuilder.categoryFallback')}</strong>.
            </p>
          </div>
        </header>

        {loading ? <p>{t('admin.formBuilder.loading')}</p> : null}
        {error ? (
          <div style={styles.errorBanner}>
            <strong>{t('admin.formBuilder.errorTitle')}</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {!loading && category ? (
          <div style={styles.layout}>
            <aside style={styles.sidebar}>{renderStepList()}</aside>
            <main style={styles.main}>{renderFieldComposer()}</main>
          </div>
        ) : null}
      </div>
      {renderStepModal()}
      {renderFieldModal()}
    </DashboardLayout>
  )
}
