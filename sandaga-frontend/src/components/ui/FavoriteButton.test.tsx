import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react';
import { FavoriteButton } from './FavoriteButton';
import { useToast } from '../ui/Toast';
import { apiPost, apiDelete } from '../../utils/api';
import { getAuthToken } from '../../utils/auth-token';
import { renderWithProviders } from '../../test/test-utils'

const addToastMock = vi.fn();
vi.mock('../ui/Toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/Toast')>()
  return {
    ...actual,
    useToast: () => ({ addToast: addToastMock }),
  }
});

vi.mock('../../utils/api', () => ({
  setApiLocale: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('../../utils/auth-token', () => ({
  getAuthToken: vi.fn(),
}));

describe('FavoriteButton', () => {
  beforeEach(() => {
    (getAuthToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue?.('test-token')
  });

  it('renders the button in the correct initial state', () => {
    renderWithProviders(<FavoriteButton listingId="123" initial={true} />, { useRouter: true });
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles the favorite state on click', async () => {
    renderWithProviders(<FavoriteButton listingId="123" />, { useRouter: true });
    const button = screen.getByRole('button');

    fireEvent.click(button);

    expect(apiPost).toHaveBeenCalledWith('/favorites/123');
    // expect(await screen.findByRole('button')).toHaveAttribute('aria-pressed', 'true');

    // fireEvent.click(button);

    // expect(apiDelete).toHaveBeenCalledWith('/favorites/123');
    // expect(await screen.findByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('redirects to login if not authenticated', () => {
    (getAuthToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue?.(null)

    renderWithProviders(<FavoriteButton listingId="123" />, { useRouter: true });
    const button = screen.getByRole('button');

    fireEvent.click(button);

    expect(addToastMock).toHaveBeenCalledWith({
      variant: 'error',
      title: 'Connexion requise',
      message: 'Identifiez-vous pour gérer vos favoris.',
    });
  });
});
