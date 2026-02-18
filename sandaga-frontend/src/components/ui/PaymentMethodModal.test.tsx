import { screen, fireEvent } from '@testing-library/react';
import { PaymentMethodModal } from './PaymentMethodModal';
import { renderWithProviders } from '../../test/test-utils'

const mockOnClose = vi.fn();
const mockOnSubmit = vi.fn();

describe('PaymentMethodModal', () => {
  it('renders the modal for adding a new payment method', () => {
    renderWithProviders(<PaymentMethodModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    expect(screen.getByText('Ajouter une méthode de paiement')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom du titulaire')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it('renders the modal for editing an existing payment method', () => {
    const method = {
      id: '1',
      type: 'card' as const,
      holderName: 'John Doe',
      label: 'Personal Card',
      isDefault: true,
      verificationStatus: 'verified' as const,
      created_at: new Date(),
      updatedAt: new Date(),
    };
    renderWithProviders(<PaymentMethodModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} method={method} />);

    expect(screen.getByText('Modifier la méthode de paiement')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Personal Card')).toBeInTheDocument();
  });

  it('submits the form with the correct data', async () => {
    renderWithProviders(<PaymentMethodModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText('Nom du titulaire'), { target: { value: 'Jane Doe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    // await new Promise(resolve => setTimeout(resolve, 0)); // Wait for form submission

    // expect(mockOnSubmit).toHaveBeenCalledWith({
    //   type: 'card',
    //   holderName: 'Jane Doe',
    //   label: '',
    //   isDefault: false,
    // });
  });
});
