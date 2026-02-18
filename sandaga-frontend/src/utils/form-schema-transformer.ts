import { Category, FormStep as BackendFormStep, FormField as BackendFormField } from '../types/category';
import { ListingFormSchema, ListingFormStep, ListingFormField, ListingFormFieldOption, ListingFormFieldVisibilityCondition } from '../types/listing-form';

export function transformBackendCategoryToFrontendSchema(category: Category): ListingFormSchema {
  const frontendSteps: ListingFormStep[] = category.steps?.map(backendStep => {
    const frontendFields: ListingFormField[] = backendStep.fields.map(backendField => {
      // Extract properties from backendField.info (jsonb)
      const info = backendField.info || {};
      const description = info.description;
      const placeholder = info.placeholder;
      const hint = info.hint;
      const rows = info.rows;
      const multiSelect = info.multiSelect;
      const withCustomValue = info.withCustomValue;
      const visibility = info.visibility as ListingFormFieldVisibilityCondition[] | undefined;

      // Extract properties from backendField.values (jsonb)
      const options = (backendField.values || []) as ListingFormFieldOption[];

      // Extract properties from backendField.rules (jsonb)
      const rules = backendField.rules || {};
      const required = rules.required || false;
      const min = rules.min;
      const max = rules.max;
      const minLength = rules.minLength;
      const maxLength = rules.maxLength;

      return {
        name: backendField.name,
        type: backendField.type as ListingFormField['type'], // Cast to frontend type
        label: backendField.label,
        description,
        placeholder,
        hint,
        required,
        defaultValue: undefined, // Not directly available in backend FormField
        options,
        visibility,
        min,
        max,
        minLength,
        maxLength,
        rows,
        multiSelect,
        withCustomValue,
      };
    });

    return {
      id: backendStep.id,
      title: backendStep.label, // Map backend label to frontend title
      description: backendStep.info?.description || undefined, // Use info for description
      badge: undefined, // Not directly available in backend FormStep
      fields: frontendFields,
    };
  }) || [];

  return {
    categoryId: category.id,
    categorySlug: category.slug,
    version: 1, // Assuming a default version for now
    steps: frontendSteps,
    updatedAt: category.updatedAt ?? new Date().toISOString(),
  };
}
