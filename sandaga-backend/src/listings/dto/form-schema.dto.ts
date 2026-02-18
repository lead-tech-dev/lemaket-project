export type FormSchemaDTO = {
  categoryId: string;
  subCategoryId: string | null;
  flow: 'sell' | 'buy' | 'let' | 'rent' | null;
  adTypes?: Record<string, { label?: string; description?: string }>;
  steps: Array<{
    id: string;
    name: string;
    label: string;
    order: number;
    info?: string[];
    flow?: string | null;
    fields: Array<{
      id: string;
      name: string;
      label: string;
      type: 'text' | 'number' | 'textarea' | 'checkbox' | 'select' | 'date' | 'radio' | 'multiselect' | string;
      unit?: string;
      info?: string[];
      tooltip?: string[];
      rules?: {
        mandatory?: boolean;
        max_length?: number;
        min_length?: number;
        min?: number;
        max?: number;
        regexp?: string;
        err_mandatory?: string;
        err_regexp?: string;
      };
      options?: Array<{ value: string; label: string }>;
      optionGroups?: Array<{ label: string; options: Array<{ value: string; label: string }> }>;
      dependsOn?: string;
      conditionalOptions?: Record<string, Array<{ value: string; label: string }>>;
      ui?: {
        placeholder?: string;
        disabledUntilDependsOnFilled?: boolean;
      };
    }>;
  }>;
};
