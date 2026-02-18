import { render, screen, fireEvent } from '@testing-library/react';
import { RetryBanner } from './RetryBanner';
import { useI18n } from '../../contexts/I18nContext';

const mockOnRetry = vi.fn();

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('RetryBanner', () => {
  it('renders the message and retry button', () => {
    render(<RetryBanner message="Something went wrong" onRetry={mockOnRetry} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'actions.retry' })).toBeInTheDocument();
  });

  it('calls onRetry when the retry button is clicked', () => {
    render(<RetryBanner message="Something went wrong" onRetry={mockOnRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'actions.retry' }));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('renders a title and custom action label', () => {
    render(
      <RetryBanner
        title="Error"
        message="Something went wrong"
        actionLabel="Try again"
        onRetry={mockOnRetry}
      />
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders an accessory', () => {
    render(
      <RetryBanner
        message="Something went wrong"
        onRetry={mockOnRetry}
        accessory={<span>Icon</span>}
      />
    );
    expect(screen.getByText('Icon')).toBeInTheDocument();
  });
});
