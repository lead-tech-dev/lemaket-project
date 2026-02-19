import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react';
import Sidebar from './Sidebar';
import { renderWithProviders } from '../test/test-utils'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}));

vi.mock('../contexts/FeatureFlagContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../contexts/FeatureFlagContext')>()
  return {
    ...actual,
    useFeatureFlagsContext: vi.fn(),
  }
});

import * as AuthMod from '../hooks/useAuth'
import * as FFMod from '../contexts/FeatureFlagContext'

describe('Sidebar', () => {
  beforeEach(() => {
    vi.mocked(AuthMod.useAuth).mockReturnValue({ user: { firstName: 'John', lastName: 'Doe' }, isPro: false } as any)
    vi.mocked(FFMod.useFeatureFlagsContext).mockReturnValue({ isEnabled: () => true } as any)
  })
  it('renders the sidebar with user information', () => {
    renderWithProviders(<Sidebar />, { useRouter: true });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Bienvenue sur votre espace')).toBeInTheDocument();
  });

  it('renders primary navigation links', () => {
    renderWithProviders(<Sidebar />, { useRouter: true });

    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
    expect(screen.getByText('Mes annonces')).toBeInTheDocument();
    expect(screen.getByText('Mes commandes')).toBeInTheDocument();
    expect(screen.getByText('Favoris')).toBeInTheDocument();
  });

  it('renders account navigation links', () => {
    renderWithProviders(<Sidebar />, { useRouter: true });

    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
  });

  it('does not render pro links for regular users', () => {
    renderWithProviders(<Sidebar />, { useRouter: true });

    expect(screen.queryByText('Vue PRO vs Particulier')).not.toBeInTheDocument();
    expect(screen.queryByText('Paiements')).not.toBeInTheDocument();
    expect(screen.queryByText('Compte PRO')).not.toBeInTheDocument();
  });

  it('renders pro links for pro users', () => {
    vi.mocked(AuthMod.useAuth).mockReturnValue({ user: { firstName: 'Jane', lastName: 'Doe' }, isPro: true } as any);

    renderWithProviders(<Sidebar />, { useRouter: true });

    expect(screen.getByText('Vue PRO vs Particulier')).toBeInTheDocument();
    expect(screen.getByText('Paiements')).toBeInTheDocument();
    expect(screen.getByText('Compte PRO')).toBeInTheDocument();
  });
});
