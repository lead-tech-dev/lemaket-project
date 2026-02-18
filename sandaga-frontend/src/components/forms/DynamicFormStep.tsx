import { Controller, useFormContext } from 'react-hook-form'
import type { CSSProperties, ReactNode } from 'react'
import type { FormField, FormStep } from '../../types/category'
import type { FormSchemaDTO } from '../../hooks/useListingFormSchema'
import type { PriceSuggestion } from '../../hooks/usePriceSuggestion'
import type { ListingFormFieldVisibilityCondition } from '../../types/listing-form'
import { DynamicFormField } from './DynamicFormField'
import { ROOT_LISTING_FIELDS } from '../../constants/listingForm'
import { MapPicker } from './MapPicker'
import { FormField as FormFieldComponent } from '../ui/FormField'
import { useI18n } from '../../contexts/I18nContext'

const STEP_CARD_STYLE: CSSProperties = {
  background: '#ffffff',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 18px 36px rgba(15, 23, 42, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '18px'
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

const STEP_ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  marginTop: '12px'
}

type DynamicFormStepProps = {
  step: CompatibleFormStep
  basePath: string
  stepIndex?: number
  totalSteps?: number
  actions?: ReactNode
  isMapStep?: boolean
  priceSuggestion?: PriceSuggestion | null
  priceSuggestionLoading?: boolean
  onApplyPriceSuggestion?: (value: number) => void
}

type CompatibleFormField = FormSchemaDTO['steps'][number]['fields'][number] & Partial<FormField>
type CompatibleFormStep = FormSchemaDTO['steps'][number] & Partial<FormStep>

const resolveFieldPath = (basePath: string, fieldName: string): string =>
  ROOT_LISTING_FIELDS.has(fieldName) ? fieldName : `${basePath}.${fieldName}`

function matchesCondition(value: unknown, condition: ListingFormFieldVisibilityCondition): boolean {
  if (condition.equals !== undefined) {
    return value === condition.equals
  }

  if (condition.notEquals !== undefined) {
    return value !== condition.notEquals
  }

  if (condition.in) {
    if (Array.isArray(value)) {
      return value.some(entry => condition.in?.includes(entry as never))
    }
    return condition.in.includes(value as never)
  }

  if (condition.notIn) {
    if (Array.isArray(value)) {
      return value.every(entry => !condition.notIn?.includes(entry as never))
    }
    return !condition.notIn.includes(value as never)
  }

  return Boolean(value)
}

function shouldDisplayField(
  watch: ReturnType<typeof useFormContext>['watch'],
  basePath: string,
  field: CompatibleFormField
): boolean {
  if (!('visibility' in field) || !field.visibility || field.visibility.length === 0) {
    return true
  }

  return field.visibility.every(condition => {
    const path = resolveFieldPath(basePath, condition.field)
    const watchedValue = watch(path)
    return matchesCondition(watchedValue, condition)
  })
}

const stripDiacritics = (input: string): string =>
  input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const toNormalized = (value: string | undefined | null) => {
  if (!value) {
    return ''
  }
  const stripped = stripDiacritics(value)
  return stripped.toLowerCase()
}

const containsIsolatedToken = (source: string, token: string) => {
  if (!source || !token) {
    return false
  }
  const pattern = new RegExp(`(^|[\\s._-])${token}($|[\\s._-])`)
  return pattern.test(source)
}

const resolveStepVariant = (step: CompatibleFormStep): string =>
  toNormalized((step as { variant?: string | null }).variant)

const resolveFieldUiRole = (field: CompatibleFormField): string =>
  toNormalized((field as { uiRole?: string | null }).uiRole)

const resolveFieldType = (field: CompatibleFormField): string =>
  toNormalized((field as { type?: string | null }).type)

const resolveFieldName = (field: CompatibleFormField): string => toNormalized(field.name)

const resolveStepName = (step: CompatibleFormStep): string =>
  toNormalized(step.name ?? step.label ?? '')

const isCoordinateField = (field: CompatibleFormField): boolean => {
  const normalizedRole = resolveFieldUiRole(field)
  const normalizedType = resolveFieldType(field)
  const normalizedName = resolveFieldName(field)

  if (
    normalizedRole === 'map' ||
    normalizedRole === 'location' ||
    normalizedRole === 'localisation'
  ) {
    return true
  }

  if (normalizedType === 'map') {
    return true
  }

  if (!normalizedName) {
    return false
  }

  if (
    normalizedName.includes('location') ||
    normalizedName.includes('localisation') ||
    normalizedName.includes('emplacement') ||
    normalizedName.includes('adresse') ||
    normalizedName.includes('address') ||
    normalizedName.includes('coordinate') ||
    normalizedName.includes('coordonnees') ||
    normalizedName.includes('latitude') ||
    normalizedName.includes('longitude') ||
    containsIsolatedToken(normalizedName, 'lat') ||
    containsIsolatedToken(normalizedName, 'lng') ||
    containsIsolatedToken(normalizedName, 'lon') ||
    normalizedName.includes('map')
  ) {
    return true
  }

  return false
}

export function isCoordinateStep(step: CompatibleFormStep): boolean {
  const normalizedStepName = toNormalized(step.name)
  const normalizedStepLabel = toNormalized(step.label)
  const normalizedStepVariant = resolveStepVariant(step)
  const fields: CompatibleFormField[] = (step.fields as CompatibleFormField[]) ?? []

  const hasExplicitCoordinateField = fields.some(field => isCoordinateField(field))

  return (
    normalizedStepVariant === 'location' ||
    normalizedStepVariant === 'map' ||
    normalizedStepVariant === 'coordinates' ||
    normalizedStepVariant === 'localisation' ||
    normalizedStepVariant === 'adresse' ||
    normalizedStepName.includes('coordinate') ||
    normalizedStepName.includes('coordonnees') ||
    normalizedStepName.includes('localisation') ||
    normalizedStepName.includes('location') ||
    normalizedStepName.includes('adresse') ||
    normalizedStepLabel.includes('coordinate') ||
    normalizedStepLabel.includes('coordonnees') ||
    normalizedStepLabel.includes('localisation') ||
    normalizedStepLabel.includes('location') ||
    normalizedStepLabel.includes('adresse') ||
    hasExplicitCoordinateField
  )
}

export function DynamicFormStep({
  step,
  basePath,
  stepIndex,
  totalSteps,
  actions,
  isMapStep,
  priceSuggestion,
  priceSuggestionLoading,
  onApplyPriceSuggestion
}: DynamicFormStepProps) {
  const { t } = useI18n()
  const { control, watch } = useFormContext()
  const stepName = resolveStepName(step)
  const isContactStep =
    stepName.includes('contact') || stepName.includes('coordonne')

  const fields: CompatibleFormField[] = (step.fields as CompatibleFormField[]) ?? []
  const hasPhoneHiddenField = fields.some(field => field.name === 'phone_hidden_information_text')


  const coordinateStep =
    typeof isMapStep === 'boolean' ? isMapStep : isCoordinateStep(step)
  const showHiddenPhoneToggle = coordinateStep && !isMapStep && !hasPhoneHiddenField
  const hiddenPhoneToggleId = `${basePath.replace(/\./g, '-')}-phone-hidden-toggle`

  let locationField: { field: CompatibleFormField; path: string } | undefined
  let latitudeField: { field: CompatibleFormField; path: string } | undefined
  let longitudeField: { field: CompatibleFormField; path: string } | undefined
  let addressField: { field: CompatibleFormField; path: string } | undefined

  const captureCoordinateField = (field: CompatibleFormField): boolean => {
    if (!coordinateStep) {
      return false
    }

    const normalizedRole = resolveFieldUiRole(field)
    const normalizedName = resolveFieldName(field)
    const normalizedType = resolveFieldType(field)

    if (!normalizedName && !normalizedRole && !normalizedType) {
      return false
    }
    const path = resolveFieldPath(basePath, field.name)

    const markLocationField = () => {
      if (!locationField) {
        locationField = { field, path }
        return true
      }
      return false
    }

    const markLatitudeField = () => {
      if (!latitudeField) {
        latitudeField = { field, path }
        return true
      }
      return false
    }

    const markLongitudeField = () => {
      if (!longitudeField) {
        longitudeField = { field, path }
        return true
      }
      return false
    }

    const markAddressField = () => {
      if (!addressField) {
        addressField = { field, path }
        return true
      }
      return false
    }

    if (normalizedRole) {
      if (
        normalizedRole === 'location' ||
        normalizedRole === 'localisation' ||
        normalizedRole === 'map'
      ) {
        if (markLocationField()) {
          return true
        }
      }
      if (
        normalizedRole === 'latitude' ||
        normalizedRole === 'lat' ||
        normalizedRole === 'coordonnees_latitude'
      ) {
        if (markLatitudeField()) {
          return true
        }
      }
      if (
        normalizedRole === 'longitude' ||
        normalizedRole === 'lng' ||
        normalizedRole === 'lon' ||
        normalizedRole === 'coordonnees_longitude'
      ) {
        if (markLongitudeField()) {
          return true
        }
      }
      if (
        normalizedRole === 'address' ||
        normalizedRole === 'adresse' ||
        normalizedRole === 'location_label'
      ) {
        if (markAddressField()) {
          return true
        }
      }
    }

    if (normalizedType === 'map') {
      if (markLocationField()) {
        return true
      }
    }

    const isLocationLike =
      normalizedName.includes('location') ||
      normalizedName.includes('localisation') ||
      normalizedName.includes('emplacement')
    if (isLocationLike && markLocationField()) {
      return true
    }

    const isLatitudeLike =
      normalizedName.includes('latitude') || containsIsolatedToken(normalizedName, 'lat')
    if (isLatitudeLike && markLatitudeField()) {
      return true
    }

    const isLongitudeLike =
      normalizedName.includes('longitude') ||
      containsIsolatedToken(normalizedName, 'lng') ||
      containsIsolatedToken(normalizedName, 'lon')
    if (isLongitudeLike && markLongitudeField()) {
      return true
    }

    const isAddressLike =
      normalizedName.includes('address') ||
      normalizedName.includes('adresse') ||
      normalizedName.includes('coordonnees') ||
      containsIsolatedToken(normalizedName, 'addr')
    if (isAddressLike && markAddressField()) {
      return true
    }

    return false
  }

  const fieldsToRender = fields.flatMap(field => {
    if (!shouldDisplayField(watch, basePath, field)) {
      return []
    }

    if (coordinateStep && captureCoordinateField(field)) {
      return []
    }

    const isTextarea = toNormalized((field as { type?: string | null }).type) === 'textarea'

    return [{ field, path: resolveFieldPath(basePath, field.name), isTextarea }]
  })

  // Textarea en dernier et sur une ligne seule
  const orderedFields = [
    ...fieldsToRender.filter(entry => !entry.isTextarea),
    ...fieldsToRender.filter(entry => entry.isTextarea)
  ]

  const mapShouldRender = Boolean(isMapStep)

  const hasRenderableContent = mapShouldRender || fieldsToRender.length > 0 || showHiddenPhoneToggle
  if (!hasRenderableContent) {
    return (
      <section className="dashboard-section" id={`listing-step-${step.id}`}>
        <div className="dashboard-section__head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {typeof stepIndex === 'number' && typeof totalSteps === 'number' ? (
              <span style={STEP_BADGE_STYLE}>
                {t('forms.step.progress', { current: stepIndex + 1, total: totalSteps })}
              </span>
            ) : null}
            <h2>{step.label}</h2>
          </div>
        </div>
        <div style={STEP_CARD_STYLE}>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            {t('forms.step.empty')}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard-section" id={`listing-step-${step.id}`}>
      <div className="dashboard-section__head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {typeof stepIndex === 'number' && typeof totalSteps === 'number' ? (
            <span style={STEP_BADGE_STYLE}>
              {t('forms.step.progress', { current: stepIndex + 1, total: totalSteps })}
            </span>
          ) : null}
          <h2>{step.label}</h2>
          {/* Info display intentionally removed */}
        </div>
      </div>

      <div style={STEP_CARD_STYLE}>
        {mapShouldRender ? (
          <MapPicker
            basePath={basePath}
            locationField={locationField as any}
            latitude={latitudeField as any}
            longitude={longitudeField as any}
            address={addressField as any}
          />
        ) : null}
        {mapShouldRender ? (
          <Controller
            name="locationHideExact"
            control={control}
            render={({ field }) => (
              <FormFieldComponent
                label={t('forms.mapPicker.hideExact.label')}
                htmlFor={`${basePath.replace(/\./g, '-')}-hide-exact`}
                hint={t('forms.mapPicker.hideExact.hint')}
              >
                <label className="form-switch">
                  <input
                    type="checkbox"
                    id={`${basePath.replace(/\./g, '-')}-hide-exact`}
                    checked={Boolean(field.value)}
                    onChange={event => field.onChange(event.target.checked)}
                  />
                  <span className="form-switch__label">
                    {t('forms.mapPicker.hideExact.toggle')}
                  </span>
                </label>
              </FormFieldComponent>
            )}
          />
        ) : null}
        {fieldsToRender.length > 0 || showHiddenPhoneToggle ? (
          <div className={`listing-form__grid${isContactStep ? ' listing-form__grid--contact' : ''}`}>
            {orderedFields.map(({ field, path, isTextarea }) => (
              <div
                key={field.name}
                style={isTextarea ? { gridColumn: '1 / -1', width: '100%' } : undefined}
              >
                <DynamicFormField
                  field={field}
                  path={path}
                  priceSuggestion={priceSuggestion}
                  priceSuggestionLoading={priceSuggestionLoading}
                  onApplyPriceSuggestion={onApplyPriceSuggestion}
                />
              </div>
            ))}
            {showHiddenPhoneToggle ? (
              <Controller
                name="phone_hidden_information_text"
                control={control}
                render={({ field }) => (
                  <FormFieldComponent
                    label={t('forms.contact.hidePhone.label')}
                    htmlFor={hiddenPhoneToggleId}
                    hint={t('forms.contact.hidePhone.hint')}
                  >
                    <label className="form-switch">
                      <input
                        type="checkbox"
                        id={hiddenPhoneToggleId}
                        checked={Boolean(field.value)}
                        onChange={event => field.onChange(event.target.checked)}
                      />
                      <span className="form-switch__label">
                        {t('forms.contact.hidePhone.toggle')}
                      </span>
                    </label>
                  </FormFieldComponent>
                )}
              />
            ) : null}
          </div>
        ) : !mapShouldRender ? (
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            {t('forms.step.empty')}
          </p>
        ) : null}
        {actions ? <div style={STEP_ACTIONS_STYLE}>{actions}</div> : null}
      </div>
    </section>
  )
}
