export type ListingFormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'chips'
  | 'checkbox'
  | 'switch'
  | 'radio';

export type ListingFormFieldVisibilityCondition = {
  field: string;
  equals?: string | number | boolean;
  notEquals?: string | number | boolean;
  in?: Array<string | number | boolean>;
  notIn?: Array<string | number | boolean>;
};

export type ListingFormFieldOption = {
  label: string;
  value: string;
  description?: string;
};

export type ListingFormField = {
  name: string;
  type: ListingFormFieldType;
  label: string;
  description?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  stepId?: string;
  defaultValue?: string | number | boolean | string[];
  options?: ListingFormFieldOption[];
  visibility?: ListingFormFieldVisibilityCondition[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  multiSelect?: boolean;
  withCustomValue?: boolean;
};

export type ListingFormStep = {
  id: string;
  name?: string;
  label?: string;
  title: string;
  description?: string;
  badge?: string;
  info?: unknown;
  flow?: string | null;
  order?: number;
  fields: ListingFormField[];
};

export type ListingFormSchema = {
  categoryId: string;
  categorySlug: string;
  version: number;
  steps: ListingFormStep[];
  updatedAt: string;
};
