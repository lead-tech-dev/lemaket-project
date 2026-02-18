export type ListingFormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'chips'
  | 'checkbox'
  | 'switch'
  | 'radio'
  | 'map';

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
  info?: string[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
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
  uiRole?: string;
};

export type ListingFormStep = {
  id: string;
  title: string;
  description?: string;
  badge?: string;
  fields: ListingFormField[];
};

export type ListingFormSchema = {
  categoryId: string;
  categorySlug: string;
  version: number;
  steps: ListingFormStep[];
  updatedAt: string;
};
