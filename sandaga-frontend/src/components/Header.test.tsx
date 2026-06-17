import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom';
import Header from './Header';
import { I18nProvider } from '../contexts/I18nContext';
import { AppThemeProvider } from '../theme/ThemeProvider';

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

vi.mock('../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/api')>()
  return {
    ...actual,
    apiGet: vi.fn()
  }
})

import * as AuthMod from '../hooks/useAuth'
import * as NotifMod from '../hooks/useMessageNotifications'
import * as FFMod from '../contexts/FeatureFlagContext'
import * as CategoriesMod from '../hooks/useCategories'
import * as ApiMod from '../utils/api'

function LocationEcho() {
  const location = useLocation()
  return <div data-testid="location-echo">{`${location.pathname}${location.search}`}</div>
}

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
    vi.mocked(ApiMod.apiGet).mockResolvedValue([] as any)
  });
  it('renders the header with user information', () => {
    render(
      <MemoryRouter>
        <AppThemeProvider>
        <I18nProvider>
          <Header />
        </I18nProvider>
        </AppThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(
      <MemoryRouter>
        <AppThemeProvider>
        <I18nProvider>
          <Header />
        </I18nProvider>
        </AppThemeProvider>
      </MemoryRouter>
    );

    // Les liens de catégories apparaissent dans la barre desktop ET les pills
    // mobiles (responsive) → on accepte plusieurs occurrences.
    expect(screen.getAllByText('Immobilier').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Véhicules').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Emploi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mode').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Maison').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Services').length).toBeGreaterThan(0);
    expect(screen.getByText('Toutes les catégories')).toBeInTheDocument();
  });

  it('shows unread message count', () => {
    vi.mocked(AuthMod.useAuth).mockReturnValue({ user: { firstName: 'John' }, isPro: true, isAdmin: false } as any);
    vi.mocked(NotifMod.useMessageNotifications).mockReturnValue(5 as any);

    render(
      <MemoryRouter>
        <AppThemeProvider>
        <I18nProvider>
          <Header />
        </I18nProvider>
        </AppThemeProvider>
      </MemoryRouter>
    );

    const messagesLink = screen.getByRole('link', { name: /Messages/i });
    expect(within(messagesLink).getByText('5')).toBeInTheDocument();
  });

  it('opens and closes the mobile drawer menu', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AppThemeProvider>
        <I18nProvider>
          <Header />
        </I18nProvider>
        </AppThemeProvider>
      </MemoryRouter>
    )

    // Le bouton menu est masqué (display:none) en desktop ; testing-library
    // calcule un nom accessible vide pour les éléments cachés → on cible le testid.
    await user.click(screen.getByTestId('header-menu-toggle'))

    const dialog = screen.getByRole('dialog', { name: /menu/i })
    expect(within(dialog).getByRole('link', { name: /toutes les catégories|all categories/i })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /fermer le menu|close menu/i }))
    expect(screen.queryByRole('dialog', { name: /menu/i })).not.toBeInTheDocument()
  })

  it('shows query suggestions from server when typing in search', async () => {
    const user = userEvent.setup()
    vi.mocked(ApiMod.apiGet).mockImplementation((path: string) => {
      if (path.startsWith('/search/suggestions')) {
        return Promise.resolve([
          {
            id: 's1',
            label: 'Colocation Douala',
            query: 'colocation douala',
            resultCount: 42,
            hits: 12
          }
        ] as any)
      }
      if (path === '/home/trending-searches') {
        return Promise.resolve([] as any)
      }
      return Promise.resolve([] as any)
    })

    render(
      <MemoryRouter>
        <AppThemeProvider>
        <I18nProvider>
          <Header />
        </I18nProvider>
        </AppThemeProvider>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /Rechercher une annonce|Search listings/i }))
    const input = screen.getByPlaceholderText(/Rechercher une annonce|Search listings/i)
    await user.type(input, 'coloc')

    expect(await screen.findByText('Colocation Douala')).toBeInTheDocument()
  })

  it('deduplicates normalized suggestions and hides noisy values', async () => {
    const user = userEvent.setup()
    vi.mocked(ApiMod.apiGet).mockImplementation((path: string) => {
      if (path.startsWith('/search/suggestions')) {
        return Promise.resolve([
          {
            id: 's1',
            label: 'Téléphone Douala',
            query: 'telephone douala',
            resultCount: 20,
            hits: 5
          },
          {
            id: 's2',
            label: 'telephone douala',
            query: 'téléphone douala',
            resultCount: 18,
            hits: 3
          },
          {
            id: 's3',
            label: '12345',
            query: '12345',
            resultCount: 99,
            hits: 99
          }
        ] as any)
      }
      if (path === '/home/trending-searches') {
        return Promise.resolve([] as any)
      }
      return Promise.resolve([] as any)
    })

    render(
      <MemoryRouter>
        <AppThemeProvider>
        <I18nProvider>
          <Header />
        </I18nProvider>
        </AppThemeProvider>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /Rechercher une annonce|Search listings/i }))
    const input = screen.getByPlaceholderText(/Rechercher une annonce|Search listings/i)
    await user.type(input, 'tele')

    expect(await screen.findByText('Téléphone Douala')).toBeInTheDocument()
    expect(screen.queryByText('12345')).not.toBeInTheDocument()
    expect(screen.getAllByText(/téléphone douala/i)).toHaveLength(1)
  })

  it('applies clicked query suggestion and updates route query string', async () => {
    const user = userEvent.setup()
    vi.mocked(ApiMod.apiGet).mockImplementation((path: string) => {
      if (path.startsWith('/search/suggestions')) {
        return Promise.resolve([
          {
            id: 's1',
            label: 'Colocation Douala',
            query: 'colocation douala',
            resultCount: 42,
            hits: 12
          }
        ] as any)
      }
      if (path === '/home/trending-searches') {
        return Promise.resolve([] as any)
      }
      return Promise.resolve([] as any)
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppThemeProvider>
        <I18nProvider>
          <Header />
          <LocationEcho />
        </I18nProvider>
        </AppThemeProvider>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /Rechercher une annonce|Search listings/i }))
    const input = screen.getByPlaceholderText(/Rechercher une annonce|Search listings/i)
    await user.type(input, 'coloc')
    await user.click(await screen.findByRole('button', { name: /Colocation Douala/i }))

    await expect.poll(() => screen.getByTestId('location-echo').textContent).toContain('/search?q=colocation+douala')
  })
});
