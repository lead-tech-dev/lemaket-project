import { render, screen } from '@testing-library/react';
import { FormField } from './FormField';

describe('FormField', () => {
  it('renders the label and children', () => {
    render(
      <FormField label="Test Label">
        <input type="text" />
      </FormField>
    );
    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays a required indicator', () => {
    render(<FormField label="Test Label" required><input type="text" /></FormField>);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays a hint message', () => {
    render(<FormField label="Test Label" hint="Hint message"><input type="text" /></FormField>);
    expect(screen.getByText('Hint message')).toBeInTheDocument();
  });

  it('displays an error message', () => {
    render(<FormField label="Test Label" error="Error message"><input type="text" /></FormField>);
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('does not display hint when there is an error', () => {
    render(<FormField label="Test Label" hint="Hint message" error="Error message"><input type="text" /></FormField>);
    expect(screen.queryByText('Hint message')).not.toBeInTheDocument();
  });

  it('renders an action', () => {
    render(<FormField label="Test Label" action={<button>Action</button>}><input type="text" /></FormField>);
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });
});
