import { screen } from '@testing-library/react';
import { AdminSidebar } from './AdminSidebar';
import { renderWithProviders } from '../test/test-utils'
import { useAuth } from '../hooks/useAuth';
import { useFeatureFlagsContext } from '../contexts/FeatureFlagContext';
import { vi } from 'vitest';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { firstName: 'John', lastName: 'Doe' } }),
  invalidateAuthCache: vi.fn(),
}));

vi.mock('../contexts/FeatureFlagContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../contexts/FeatureFlagContext')>()
  return {
    ...actual,
    useFeatureFlagsContext: () => ({ isEnabled: () => true }),
  }
});

describe('AdminSidebar', () => {
  it('renders the admin sidebar with user information', () => {
    renderWithProviders(<AdminSidebar />, { useRouter: true });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
  });

  it('renders all navigation links', () => {
    renderWithProviders(<AdminSidebar />, { useRouter: true });

    expect(screen.getByText('Vue d’ensemble')).toBeInTheDocument();
    expect(screen.getByText('Modération annonces')).toBeInTheDocument();
    expect(screen.getByText('Signalements')).toBeInTheDocument();
    expect(screen.getByText('Utilisateurs')).toBeInTheDocument();
    expect(screen.getByText('Catégories')).toBeInTheDocument();
    expect(screen.getByText('Promotions')).toBeInTheDocument();
    expect(screen.getByText('Journaux d’activité')).toBeInTheDocument();
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
    expect(screen.getByText('Conditions générales')).toBeInTheDocument();
    expect(screen.getByText('Confidentialité')).toBeInTheDocument();
  });
});
