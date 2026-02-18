import { screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import type { FormField as CategoryFormField } from '../../types/category';
import { DynamicFormField } from './DynamicFormField';
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

const TestHarness = ({ children }: { children: ReactNode }) => {
  const methods = useForm();
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('DynamicFormField', () => {
  it('renders a text input', () => {
    const field = makeField({ id: 'text', name: 'text', type: 'text', label: 'Text Input' });
    renderWithProviders(
      <TestHarness>
        <DynamicFormField field={field} path="test" />
      </TestHarness>
    );
    expect(screen.getByLabelText('Text Input')).toBeInTheDocument();
  });

  it('renders a select input', () => {
    const field = makeField({
      id: 'select',
      name: 'select',
      type: 'select',
      label: 'Select Input',
      options: [{ value: '1', label: 'Option 1' }]
    });
    renderWithProviders(
      <TestHarness>
        <DynamicFormField field={field} path="test" />
      </TestHarness>
    );
    expect(screen.getByLabelText('Select Input')).toBeInTheDocument();
  });

  it('renders a chips input', () => {
    const field = makeField({
      id: 'chips',
      name: 'chips',
      type: 'chips',
      label: 'Chips Input',
      options: [{ value: '1', label: 'Option 1' }]
    });
    renderWithProviders(
      <TestHarness>
        <DynamicFormField field={field} path="test" />
      </TestHarness>
    );
    expect(screen.getByText('Chips Input')).toBeInTheDocument();
  });

  it('renders a checkbox input', () => {
    const field = makeField({ id: 'checkbox', name: 'checkbox', type: 'checkbox', label: 'Checkbox Input' });
    renderWithProviders(
      <TestHarness>
        <DynamicFormField field={field} path="test" />
      </TestHarness>
    );
    expect(screen.getByLabelText('Checkbox Input')).toBeInTheDocument();
  });

  it('renders a radio input', () => {
    const field = makeField({
      id: 'radio',
      name: 'radio',
      type: 'radio',
      label: 'Radio Input',
      options: [{ value: '1', label: 'Option 1' }]
    });
    renderWithProviders(
      <TestHarness>
        <DynamicFormField field={field} path="test" />
      </TestHarness>
    );
    expect(screen.getByText('Radio Input')).toBeInTheDocument();
  });
});
