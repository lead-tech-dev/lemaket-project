import type { ListingFormFieldType } from './listing-form'
import type { ListingFormFieldOption, ListingFormFieldVisibilityCondition } from './listing-form'

export type CategoryExtraField = 'surface' | 'rooms' | 'year' | 'mileage'

export type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  gradient: string | null
  isActive: boolean
  position: number
  parentId?: string | null
  /**
   * Historically an array of extra field keys; can now also carry arbitrary JSON
   * from the API (for example ad_types definitions). Consumers should gate on
   * the shape they expect.
   */
  extraFields?: CategoryExtraField[] | Record<string, unknown> | null
  /**
   * Raw JSON payload returned by the API for extraFields when it is not an array.
   * Kept to avoid breaking the legacy array contract.
   */
  extraFieldsRaw?: Record<string, unknown> | null
  children?: Category[]
  steps?: FormStep[]
  created_at?: string
  updatedAt?: string
} 

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: ListingFormFieldType | string;
  description?: string | null;
  unit: string | null;
  info: any | null;
  values: FormFieldOption[] | null;
  rules: any | null;
  modalForInfo: any | null;
  modalsForInfo: any | null;
  default_checked: boolean;
  disabled: boolean;
  placeholder?: string | null;
  hint?: string | null;
  required?: boolean;
  rows?: number | null;
  multiSelect?: boolean;
  withCustomValue?: boolean;
  defaultValue?: string | number | boolean | string[] | null;
  min?: number | null;
  max?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  visibility?: ListingFormFieldVisibilityCondition[];
  options?: ListingFormFieldOption[];
  created_at: string;
  updatedAt: string;
  uiRole?: string | null;
}

export interface FormFieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface FormStep {
  id: string;
  name: string;
  label: string;
  title?: string | null;
  description?: string | null;
  badge?: string | null;
  variant?: string | null;
  order: number;
  info: any | null;
  flow?: string | null;
  created_at: string;
  updatedAt: string;
  fields: FormField[];
} 

export type CategoryPayload = {
  name: string
  slug: string
  description?: string | null
  icon?: string | null
  color?: string | null
  gradient?: string | null
  isActive?: boolean
  parentId?: string | null
  extraFields?: CategoryExtraField[]
}
