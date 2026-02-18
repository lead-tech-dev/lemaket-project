import { screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';
import { renderWithProviders } from '../../test/test-utils'

const options = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3' },
];

const mockOnChange = vi.fn();

describe('Select', () => {
  it('renders the select with the correct options', () => {
    renderWithProviders(<Select options={options} value="1" onChange={mockOnChange} />);
    const trigger = screen.getByRole('button', { name: 'Option 1' });
    fireEvent.click(trigger);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('calls onChange when a new option is selected', () => {
    renderWithProviders(<Select options={options} value="1" onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Option 1' }));
    fireEvent.click(screen.getByRole('option', { name: 'Option 2' }));
    expect(mockOnChange).toHaveBeenCalledWith('2');
  });

  it('renders a label', () => {
    renderWithProviders(<Select options={options} value="1" onChange={mockOnChange} label="Test Select" />);
    expect(screen.getByText('Test Select')).toBeInTheDocument();
  });

  it('is disabled when the disabled prop is true', () => {
    renderWithProviders(<Select options={options} value="1" onChange={mockOnChange} disabled />);
    expect(screen.getByRole('button', { name: 'Option 1' })).toBeDisabled();
  });
});
