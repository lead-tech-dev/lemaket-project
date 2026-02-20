import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import { I18nProvider } from '../contexts/I18nContext';

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}));

vi.mock('../hooks/useMessageNotifications', () => ({
  useMessageNotifications: vi.fn(),
}));

vi.mock('../contexts/FeatureFlagContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../contexts/FeatureFlagContext')>()
  return {
    ...actual,
    useFeatureFlagsContext: vi.fn(),
  }
});

vi.mock('../hooks/useCategories', () => ({
  useCategories: vi.fn(),
}));

import * as AuthMod from '../hooks/useAuth'
import * as NotifMod from '../hooks/useMessageNotifications'
import * as FFMod from '../contexts/FeatureFlagContext'
import * as CategoriesMod from '../hooks/useCategories'

describe('Header', () => {
  beforeEach(() => {
    vi.mocked(AuthMod.useAuth).mockReturnValue({ user: { firstName: 'John' }, isPro: false, isAdmin: false } as any);
    vi.mocked(NotifMod.useMessageNotifications).mockReturnValue(0 as any);
    vi.mocked(FFMod.useFeatureFlagsContext).mockReturnValue({ isEnabled: () => true } as any);
    vi.mocked(CategoriesMod.useCategories).mockReturnValue({
      categories: [
        {
          id: 'cat-1',
          name: 'Immobilier',
          slug: 'immobilier',
          description: null,
          icon: null,
          color: null,
          gradient: null,
          isActive: true,
          position: 1,
          parentId: null,
          extraFields: [],
          children: []
        },
        {
          id: 'cat-2',
          name: 'Véhicules',
          slug: 'vehicules',
          description: null,
          icon: null,
          color: null,
          gradient: null,
          isActive: true,
          position: 2,
          parentId: null,
          extraFields: [],
          children: []
        },
        {
          id: 'cat-3',
          name: 'Emploi',
          slug: 'emploi',
          description: null,
          icon: null,
          color: null,
          gradient: null,
          isActive: true,
          position: 3,
          parentId: null,
          extraFields: [],
          children: []
        },
        {
          id: 'cat-4',
          name: 'Mode',
          slug: 'mode',
          description: null,
          icon: null,
          color: null,
          gradient: null,
          isActive: true,
          position: 4,
          parentId: null,
          extraFields: [],
          children: []
        },
        {
          id: 'cat-5',
          name: 'Maison',
          slug: 'maison',
          description: null,
          icon: null,
          color: null,
          gradient: null,
          isActive: true,
          position: 5,
          parentId: null,
          extraFields: [],
          children: []
        },
        {
          id: 'cat-6',
          name: 'Services',
          slug: 'services',
          description: null,
          icon: null,
          color: null,
          gradient: null,
          isActive: true,
          position: 6,
          parentId: null,
          extraFields: [],
          children: []
        },
      ],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    } as any)
  });
  it('renders the header with user information', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <Header />
        </I18nProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <Header />
        </I18nProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Immobilier')).toBeInTheDocument();
    expect(screen.getByText('Véhicules')).toBeInTheDocument();
    expect(screen.getByText('Emploi')).toBeInTheDocument();
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Maison')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Toutes les catégories')).toBeInTheDocument();
  });

  it('shows unread message count', () => {
    vi.mocked(AuthMod.useAuth).mockReturnValue({ user: { firstName: 'John' }, isPro: true, isAdmin: false } as any);
    vi.mocked(NotifMod.useMessageNotifications).mockReturnValue(5 as any);

    render(
      <MemoryRouter>
        <I18nProvider>
          <Header />
        </I18nProvider>
      </MemoryRouter>
    );

    const messagesLink = screen.getByRole('link', { name: /Messages/i });
    expect(within(messagesLink).getByText('5')).toBeInTheDocument();
  });

  it('opens and closes the mobile drawer menu', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <I18nProvider>
          <Header />
        </I18nProvider>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /ouvrir le menu|open menu/i }))

    const dialog = screen.getByRole('dialog', { name: /menu/i })
    expect(within(dialog).getByRole('link', { name: /toutes les catégories|all categories/i })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /fermer le menu|close menu/i }))
    expect(screen.queryByRole('dialog', { name: /menu/i })).not.toBeInTheDocument()
  })
});
