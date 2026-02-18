import { screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import type { FormField as CategoryFormField, FormStep } from '../../types/category';
import { DynamicFormStep } from './DynamicFormStep';
import { renderWithProviders } from '../../test/test-utils'

const baseField: CategoryFormField = {
  id: 'field',
  name: 'field',
  label: 'Field',
  type: 'text',
  unit: null,
  info: null,
  values: [],
  rules: {},
  modalForInfo: null,
  modalsForInfo: null,
  default_checked: false,
  disabled: false,
  created_at: '',
  updatedAt: ''
};

const makeField = (overrides: Partial<CategoryFormField>): CategoryFormField => ({
  ...baseField,
  ...overrides
});

const makeStep = (overrides: Partial<FormStep>): FormStep => ({
  id: 'step',
  name: 'step',
  label: overrides.label ?? overrides.name ?? 'Step',
  order: 0,
  info: [],
  created_at: '',
  updatedAt: '',
  fields: [],
  ...overrides
});

const TestHarness = ({ children }: { children: ReactNode }) => {
  const methods = useForm();
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('DynamicFormStep', () => {
  it('renders the step title and description', () => {
    const step = makeStep({
      label: 'Test Step',
      name: 'test-step',
      title: 'Test Step',
      description: 'Step description',
      fields: []
    });
    renderWithProviders(
      <TestHarness>
        <DynamicFormStep step={step} basePath="test" />
      </TestHarness>
    );
    expect(screen.getByText('Test Step')).toBeInTheDocument();
    expect(screen.getByText('Step description')).toBeInTheDocument();
  });

  it('renders the fields in the step', () => {
    const step = makeStep({
      title: 'Test Step',
      name: 'fields-step',
      fields: [
        makeField({ id: 'field1', name: 'field1', label: 'Field 1', type: 'text' }),
        makeField({ id: 'field2', name: 'field2', label: 'Field 2', type: 'text' }),
      ],
    });
    renderWithProviders(
      <TestHarness>
        <DynamicFormStep step={step} basePath="test" />
      </TestHarness>
    );
    expect(screen.getByLabelText('Field 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Field 2')).toBeInTheDocument();
  });

  it('conditionally renders fields based on visibility rules', () => {
    const step = makeStep({
      title: 'Test Step',
      name: 'conditional-step',
      fields: [
        makeField({ id: 'field1', name: 'field1', label: 'Field 1', type: 'text' }),
        makeField({
          id: 'field2',
          name: 'field2',
          label: 'Field 2',
          type: 'text',
          visibility: [{ field: 'field1', equals: 'show' }],
        }),
      ],
    });

    const { rerender } = renderWithProviders(
      <TestHarness>
        <DynamicFormStep step={step} basePath="test" />
      </TestHarness>
    );

    expect(screen.queryByLabelText('Field 2')).not.toBeInTheDocument();

    // You would need to update the form state to test the visibility change
    // This is a simplified example
  });
});
