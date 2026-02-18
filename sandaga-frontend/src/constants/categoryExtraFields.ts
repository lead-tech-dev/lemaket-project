import type { CategoryExtraField } from '../types/category'

type Translate = (key: string, values?: Record<string, string | number>) => string

export const CATEGORY_EXTRA_FIELD_OPTIONS: Array<{ value: CategoryExtraField }> = [
  { value: 'surface' },
  { value: 'rooms' },
  { value: 'year' },
  { value: 'mileage' }
]

export const CATEGORY_EXTRA_FIELD_KEYS: CategoryExtraField[] = ['surface', 'rooms', 'year', 'mileage']

type CategoryExtraFieldConfig = {
  label: string
  placeholder?: string
  hint?: string
  inputType: 'text' | 'number'
  min?: number
  max?: number
}

type CategoryExtraFieldConfigBase = Omit<CategoryExtraFieldConfig, 'label' | 'placeholder' | 'hint'> & {
  labelKey: string
  placeholderKey?: string
  hintKey?: string
}

const CATEGORY_EXTRA_FIELD_CONFIG_BASE: Record<CategoryExtraField, CategoryExtraFieldConfigBase> = {
  surface: {
    labelKey: 'categoryExtraFields.surface.label',
    placeholderKey: 'categoryExtraFields.surface.placeholder',
    hintKey: 'categoryExtraFields.surface.hint',
    inputType: 'text'
  },
  rooms: {
    labelKey: 'categoryExtraFields.rooms.label',
    hintKey: 'categoryExtraFields.rooms.hint',
    inputType: 'number',
    min: 0,
    max: 99
  },
  year: {
    labelKey: 'categoryExtraFields.year.label',
    placeholderKey: 'categoryExtraFields.year.placeholder',
    inputType: 'number',
    min: 1900,
    max: new Date().getFullYear()
  },
  mileage: {
    labelKey: 'categoryExtraFields.mileage.label',
    placeholderKey: 'categoryExtraFields.mileage.placeholder',
    hintKey: 'categoryExtraFields.mileage.hint',
    inputType: 'number',
    min: 0
  }
}

export const buildCategoryExtraFieldOptions = (t: Translate) =>
  CATEGORY_EXTRA_FIELD_OPTIONS.map(option => ({
    ...option,
    label: t(`admin.addCategory.extraFields.${option.value}.label`),
    hint: t(`admin.addCategory.extraFields.${option.value}.hint`)
  }))

export const buildCategoryExtraFieldConfig = (t: Translate): Record<CategoryExtraField, CategoryExtraFieldConfig> =>
  Object.fromEntries(
    Object.entries(CATEGORY_EXTRA_FIELD_CONFIG_BASE).map(([key, value]) => [
      key,
      {
        label: t(value.labelKey),
        placeholder: value.placeholderKey ? t(value.placeholderKey) : undefined,
        hint: value.hintKey ? t(value.hintKey) : undefined,
        inputType: value.inputType,
        min: value.min,
        max: value.max
      }
    ])
  ) as Record<CategoryExtraField, CategoryExtraFieldConfig>
