import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';
import { renderWithProviders } from '../../test/test-utils';

describe('Modal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockReset()
  })

  it('does not render when open is false', () => {
    renderWithProviders(<Modal open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when open is true', () => {
    renderWithProviders(<Modal open={true} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the title and description', () => {
    renderWithProviders(<Modal open={true} title="Test Modal" description="This is a test" />);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('This is a test')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    renderWithProviders(<Modal open={true} onClose={mockOnClose} />);
    const backdrop = screen.getByRole('dialog').querySelector('.modal__backdrop') as HTMLElement;
    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', () => {
    renderWithProviders(<Modal open={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la fenêtre' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders children and a footer', () => {
    renderWithProviders(
      <Modal open={true} footer={<button>Footer button</button>}>
        <div>Modal content</div>
      </Modal>
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Footer button' })).toBeInTheDocument();
  });
});
