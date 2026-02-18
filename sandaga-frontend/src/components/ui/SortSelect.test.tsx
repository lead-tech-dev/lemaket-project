import { screen, fireEvent } from '@testing-library/react';
import { SortSelect } from './SortSelect';
import { renderWithProviders } from '../../test/test-utils'

const mockOnChange = vi.fn();

describe('SortSelect', () => {
  it('renders the select with the correct options', () => {
    renderWithProviders(<SortSelect value="recent" onChange={mockOnChange} />);
    const trigger = screen.getByRole('button', { name: 'Plus récentes' });
    fireEvent.click(trigger);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByText('Plus récentes')).toBeInTheDocument();
    expect(screen.getByText('Prix croissant')).toBeInTheDocument();
    expect(screen.getByText('Prix décroissant')).toBeInTheDocument();
  });

  it('calls onChange when a new option is selected', () => {
    renderWithProviders(<SortSelect value="recent" onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plus récentes' }));
    fireEvent.click(screen.getByRole('option', { name: 'Prix croissant' }));
    expect(mockOnChange).toHaveBeenCalledWith('priceAsc');
  });
});
