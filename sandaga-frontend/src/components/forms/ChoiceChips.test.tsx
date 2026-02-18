import { screen, fireEvent } from '@testing-library/react';
import { ChoiceChips } from './ChoiceChips';
import { renderWithProviders } from '../../test/test-utils'

const options = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3' },
];

const mockOnChange = vi.fn();

describe('ChoiceChips', () => {
  it('renders the options and handles single selection', () => {
    renderWithProviders(<ChoiceChips options={options} value="1" onChange={mockOnChange} />);

    fireEvent.click(screen.getByText('Option 2'));
    expect(mockOnChange).toHaveBeenCalledWith('2');

    fireEvent.click(screen.getByText('Option 1'));
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it('handles multiple selections', () => {
    renderWithProviders(<ChoiceChips options={options} value={['1']} onChange={mockOnChange} allowMultiple />);

    fireEvent.click(screen.getByText('Option 2'));
    expect(mockOnChange).toHaveBeenCalledWith(['1', '2']);

    fireEvent.click(screen.getByText('Option 1'));
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('allows adding a custom value', () => {
    renderWithProviders(<ChoiceChips options={options} value={[]} onChange={mockOnChange} allowCustomValue allowMultiple />);

    const input = screen.getByPlaceholderText('Ajouter une valeur personnalisée');
    const addButton = screen.getByRole('button', { name: 'Ajouter' });

    fireEvent.change(input, { target: { value: 'Custom value' } });
    fireEvent.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith(['Custom value']);
  });
});
