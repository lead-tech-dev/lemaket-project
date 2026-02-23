import { Controller, type RegisterOptions, useFormContext } from 'react-hook-form'
import { useEffect, useId } from 'react'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { ChoiceChips } from './ChoiceChips'
import { RichTextarea } from '../ui/RichTextarea'
import type { FormSchemaDTO } from '../../hooks/useListingFormSchema'
import type { PriceSuggestion } from '../../hooks/usePriceSuggestion'
import { ROOT_LISTING_FIELDS } from '../../constants/listingForm'
import { useI18n } from '../../contexts/I18nContext'

type DynamicFormFieldProps = {
  field: FormSchemaDTO['steps'][number]['fields'][number]
  path: string
  priceSuggestion?: PriceSuggestion | null
  priceSuggestionLoading?: boolean
  onApplyPriceSuggestion?: (value: number) => void
}

const toNumberOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const normalizeRegexpPattern = (raw: string): { pattern: string; flags?: string } => {
  let value = raw.trim()

  // Common bad payloads: "(^...$)," or "(^...$)".
  if (value.endsWith(',')) {
    value = value.slice(0, -1).trim()
  }
  if (value.startsWith('(') && value.endsWith(')')) {
    value = value.slice(1, -1).trim()
  }

  // Support /pattern/flags syntax if provided.
  const slashPattern = value.match(/^\/(.+)\/([a-z]*)$/i)
  if (slashPattern) {
    const normalizedPattern = slashPattern[1].replace(/\\\\/g, '\\')
    return { pattern: normalizedPattern, flags: slashPattern[2] || undefined }
  }

  return { pattern: value.replace(/\\\\/g, '\\') }
}

function resolveErrorMessage(errors: unknown): string | undefined {
  if (!errors) return undefined
  if (typeof errors === 'string') return errors
  if (Array.isArray(errors)) {
    return errors.map(resolveErrorMessage).filter(Boolean).join(', ')
  }
  if (typeof errors === 'object' && 'message' in (errors as Record<string, unknown>)) {
    const message = (errors as Record<string, unknown>).message
    return typeof message === 'string' ? message : undefined
  }
  return undefined
}

export function DynamicFormField({
  field,
  path,
  priceSuggestion,
  priceSuggestionLoading,
  onApplyPriceSuggestion
}: DynamicFormFieldProps) {
  const { t, locale } = useI18n()
  const id = useId()
  const formContext = useFormContext()
  const {
    control,
    register,
    formState: { errors },
    watch
  } = formContext

  const resolveFieldPath = (basePath: string, fieldName: string): string =>
    ROOT_LISTING_FIELDS.has(fieldName) ? fieldName : `${basePath}.${fieldName}`



  const infoEntries = Array.isArray(field.info)
    ? field.info.map((entry: unknown) => String(entry)).filter(Boolean)
    : field.info
    ? [String(field.info)]
    : []

  const hint = typeof field.hint === 'string' && field.hint.trim().length > 0
    ? field.hint
    : infoEntries.length
    ? infoEntries.join(' · ')
    : undefined

  const rulesConfig = (field.rules ?? {}) as Record<string, unknown>
  const isRequired = typeof rulesConfig.mandatory === 'boolean' ? rulesConfig.mandatory : Boolean(field.required)
  const errRequired =
    typeof rulesConfig.err_mandatory === 'string'
      ? rulesConfig.err_mandatory
      : t('forms.validation.required')

  const resolvedMinLength = toNumberOrUndefined(
    typeof rulesConfig.min_length === 'number' ? rulesConfig.min_length : field.minLength
  )
  const resolvedMaxLength = toNumberOrUndefined(
    typeof rulesConfig.max_length === 'number' ? rulesConfig.max_length : field.maxLength
  )
  const resolvedMin = toNumberOrUndefined(
    typeof rulesConfig.min === 'number' ? rulesConfig.min : field.min
  )
  const resolvedMax = toNumberOrUndefined(
    typeof rulesConfig.max === 'number' ? rulesConfig.max : field.max
  )

  const errMinLength = typeof rulesConfig.err_min_length === 'string'
    ? rulesConfig.err_min_length
    : resolvedMinLength
    ? t('forms.validation.minLength', { min: resolvedMinLength })
    : undefined

  const errMaxLength = typeof rulesConfig.err_max_length === 'string'
    ? rulesConfig.err_max_length
    : resolvedMaxLength
    ? t('forms.validation.maxLength', { max: resolvedMaxLength })
    : undefined

  const patternRule = (() => {
    if (typeof rulesConfig.regexp !== 'string') {
      return undefined
    }
    try {
      const normalized = normalizeRegexpPattern(rulesConfig.regexp)
      const regex = new RegExp(normalized.pattern, normalized.flags)
      return {
        value: regex,
        message:
          typeof rulesConfig.err_regexp === 'string'
            ? rulesConfig.err_regexp
            : t('forms.validation.pattern')
      }
    } catch {
      return undefined
    }
  })()

  const rulesPlaceholder = typeof rulesConfig.placeholder === 'string' ? rulesConfig.placeholder : undefined
  const placeholder = rulesPlaceholder ?? (typeof field.ui?.placeholder === 'string' ? field.ui.placeholder : undefined)

  const normalizedOptions = field.options ?? []

  const allowMultipleChips = typeof rulesConfig.multi_select === 'boolean'
    ? rulesConfig.multi_select
    : field.type === 'chips' || field.type === 'multiselect'

  const fieldErrors = path.split('.').reduce<unknown>((acc, part) => {
    if (acc === undefined || acc === null) return undefined
    if (typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[part]
  }, errors as unknown)

  const errorMessage = resolveErrorMessage(fieldErrors)

  const baseRules = {
    required: isRequired ? errRequired : false,
    minLength: resolvedMinLength
      ? {
          value: resolvedMinLength,
          message: errMinLength ?? t('forms.validation.minLength', { min: resolvedMinLength })
        }
      : undefined,
    maxLength: resolvedMaxLength
      ? {
          value: resolvedMaxLength,
          message: errMaxLength ?? t('forms.validation.maxLength', { max: resolvedMaxLength })
        }
      : undefined,
    min: typeof resolvedMin === 'number' ? { value: resolvedMin, message: t('forms.validation.min', { min: resolvedMin }) } : undefined,
    max: typeof resolvedMax === 'number' ? { value: resolvedMax, message: t('forms.validation.max', { max: resolvedMax }) } : undefined,
    pattern: patternRule
  } satisfies RegisterOptions

  const normalizedFieldName = String(field.name || '').toLowerCase()
  const isPriceField = normalizedFieldName === 'price'

  const formatAmount = (amount: number | null | undefined, currency: string | undefined) => {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return null
    try {
      const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
      return new Intl.NumberFormat(numberLocale, {
        style: 'currency',
        currency: currency || 'XAF',
        maximumFractionDigits: 0
      }).format(amount)
    } catch {
      return `${amount} ${currency ?? ''}`.trim()
    }
  }

  if (field.type === 'text' || field.type === 'number' || field.type === 'email') {
    const inputType =
      field.type === 'number'
        ? 'number'
        : field.type === 'email'
        ? 'email'
        : 'text'
    const registerRules = {
      ...baseRules,
      pattern: field.type === 'number' ? undefined : baseRules.pattern,
      valueAsNumber: field.type === 'number' ? true : undefined,
      validate:
        field.type === 'number' && patternRule
          ? (value: unknown) => {
              if (
                value === undefined ||
                value === null ||
                value === '' ||
                (typeof value === 'number' && Number.isNaN(value))
              ) {
                return true
              }
              return patternRule.value.test(String(value)) || patternRule.message
            }
          : undefined
    } as RegisterOptions
    return (
      <FormField
        label={field.label}
        htmlFor={id}
        hint={hint}
        required={isRequired}
        error={errorMessage}
      >
        <Input
          id={id}
          type={inputType}
          placeholder={placeholder}
          {...register(path, registerRules)}
        />
        {isPriceField ? (
          <div style={{ marginTop: '8px', padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            {priceSuggestionLoading ? (
              <span style={{ color: '#475569', fontSize: '0.9rem' }}>{t('listings.priceSuggestion.loading')}</span>
            ) : priceSuggestion && priceSuggestion.suggested !== null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {t('listings.priceSuggestion.label')}&nbsp;: {formatAmount(priceSuggestion.suggested, priceSuggestion.currency)}
                </div>
                <div style={{ color: '#475569', fontSize: '0.9rem' }}>
                  {t('listings.priceSuggestion.range', {
                    min: formatAmount(priceSuggestion.min, priceSuggestion.currency) ?? '',
                    max: formatAmount(priceSuggestion.max, priceSuggestion.currency) ?? ''
                  })}
                  {priceSuggestion.sampleSize
                    ? ` · ${t('listings.priceSuggestion.sample', { count: priceSuggestion.sampleSize })}`
                    : ''}
                </div>
                {priceSuggestion.suggested !== null && onApplyPriceSuggestion ? (
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => onApplyPriceSuggestion(priceSuggestion.suggested!)}
                  >
                    {t('listings.priceSuggestion.apply')}
                  </button>
                ) : null}
              </div>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                {t('listings.priceSuggestion.empty')}
              </span>
            )}
          </div>
        ) : null}
      </FormField>
    )
  }

  if (field.type === 'textarea') {
    const normalizedPath = path.toLowerCase()
    const shouldUseRichTextarea =
      normalizedPath.endsWith('body') ||
      normalizedPath.endsWith('description')
    if (shouldUseRichTextarea) {
      return (
        <Controller
          control={control}
          name={path}
          rules={baseRules}
          render={({ field: controllerField }) => (
            <FormField
              label={field.label}
              htmlFor={id}
              hint={hint}
              required={isRequired}
              error={errorMessage}
            >
              <RichTextarea
                id={id}
                rows={typeof field.rows === 'number' ? field.rows : 6}
                placeholder={placeholder}
                name={controllerField.name}
                value={typeof controllerField.value === 'string' ? controllerField.value : ''}
                onChange={controllerField.onChange}
                onBlur={controllerField.onBlur}
              />
            </FormField>
          )}
        />
      )
    }

    return (
      <FormField
        label={field.label}
        htmlFor={id}
        hint={hint}
        required={isRequired}
        error={errorMessage}
      >
        <textarea
          id={id}
          className="input"
          rows={typeof field.rows === 'number' ? field.rows : 4}
          placeholder={placeholder}
          {...register(path, baseRules)}
        />
      </FormField>
    )
  }

  if (field.type === 'select') {
    const dependsOn = field.dependsOn
    const conditionalOptions = field.conditionalOptions
    const watchedDependency = dependsOn
      ? watch(resolveFieldPath('details', dependsOn)) ?? watch(dependsOn)
      : undefined

    const dependencyKey = (() => {
      const val = watchedDependency as unknown
      if (Array.isArray(val)) {
        return val[0]
      }
      if (val && typeof val === 'object') {
        if ('value' in (val as any)) return (val as any).value
        if ('id' in (val as any)) return (val as any).id
        if ('key' in (val as any)) return (val as any).key
      }
      return val
    })()

    const baseOptions = conditionalOptions && dependsOn
      ? (() => {
          const raw = dependencyKey
          const candidates = [
            raw,
            typeof raw === 'string' ? raw.trim() : undefined,
            typeof raw === 'string' ? raw.trim().toUpperCase() : undefined,
            typeof raw === 'string' ? raw.trim().toLowerCase() : undefined
          ].filter(Boolean) as Array<string | number>

          for (const candidate of candidates) {
            const hit = conditionalOptions[String(candidate)]
            if (hit && hit.length) {
              return hit
            }
          }
          // Aucun match : on retombe sur les options simples si elles existent (permet un fallback)
          return normalizedOptions
        })()
      : normalizedOptions

    const groupedOptions =
      !conditionalOptions || !dependsOn
        ? (field.optionGroups ?? []).map(group => ({
            label: (group as any).label,
            values: (group as any).values ?? (group as any).options ?? []
          }))
        : []

    const dependencyMissing =
      Boolean(dependsOn) &&
      (watchedDependency === undefined || watchedDependency === null || watchedDependency === '')

    // Si la valeur dépendante change et ne correspond plus, on reset le champ enfant
    useEffect(() => {
      if (!dependsOn || !conditionalOptions) return
      const allowed = conditionalOptions[String(dependencyKey ?? '')] ?? []
      const current = formContext.getValues(path)
      const isAllowed = allowed.some(opt => String(opt.value) === String(current))
      if (!isAllowed && current !== '' && current !== undefined && current !== null) {
        formContext.setValue(path, '', { shouldDirty: false, shouldValidate: false })
      }
    }, [conditionalOptions, dependencyKey, dependsOn, formContext, path])

    return (
      <Controller
        control={control}
        name={path}
        rules={baseRules}
        render={({ field: controllerField }) => {
          return (
            <FormField
              label={field.label}
              htmlFor={id}
              required={isRequired}
              error={errorMessage}
              hint={hint}
            >
              <Select
                id={id}
                value={(controllerField.value as string | number | undefined) ?? ''}
                onChange={value => controllerField.onChange(value)}
                options={groupedOptions.length ? [] : baseOptions}
                optionGroups={groupedOptions}
                placeholder={placeholder}
                disabled={dependencyMissing}
              />
            </FormField>
          )
        }}
      />
    )
  }

  if (field.type === 'multiselect' || field.type === 'chips') {
    return (
      <Controller
        control={control}
        name={path}
        rules={baseRules}
        render={({ field: controllerField }) => (
          <FormField label={field.label} required={isRequired} error={errorMessage} hint={hint}>
            <ChoiceChips
              options={normalizedOptions ?? []}
              allowMultiple={allowMultipleChips}
              allowCustomValue={
                typeof rulesConfig.with_custom_value === 'boolean'
                  ? rulesConfig.with_custom_value
                  : Boolean(field.withCustomValue)
              }
              value={controllerField.value ?? (allowMultipleChips ? [] : null)}
              onChange={value => controllerField.onChange(value)}
            />
          </FormField>
        )}
      />
    )
  }

  if (field.type === 'switch' || field.type === 'checkbox') {
    return (
      <Controller
        control={control}
        name={path}
        rules={baseRules}
        render={({ field: controllerField }) => (
          <FormField label={field.label} required={isRequired} error={errorMessage} hint={hint}>
            <label className="form-switch">
              <input
                type="checkbox"
                checked={Boolean(controllerField.value)}
                onChange={event => controllerField.onChange(event.target.checked)}
                aria-label={field.label}
              />
              <span className="form-switch__label">{field.description ?? 'Oui'}</span>
            </label>
          </FormField>
        )}
      />
    )
  }

  if (field.type === 'radio') {
    return (
      <Controller
        control={control}
        name={path}
        rules={baseRules}
        render={({ field: controllerField }) => (
          <FormField label={field.label} required={isRequired} error={errorMessage} hint={hint}>
            <div className="form-radio-group">
              {(normalizedOptions ?? []).map((option: { value: string; label: string }) => (
                <label key={option.value} className="form-radio">
                  <input
                    type="radio"
                    value={option.value}
                    checked={controllerField.value === option.value}
                    onChange={() => controllerField.onChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </FormField>
        )}
      />
    )
  }

  return null
}
