import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchResults from './SearchResults'
import { renderWithProviders } from '../../test/test-utils'
import type { Category } from '../../types/category'

vi.mock('../../layouts/MainLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>
}))

vi.mock('../../utils/api', () => ({
  setApiLocale: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('../../hooks/useCategories', () => ({
  useCategories: vi.fn(),
}))

vi.mock('../../hooks/useListingFormSchema', () => ({
  useListingFormSchema: vi.fn(),
}))

vi.mock('../../hooks/useFollowedSellers', () => ({
  useFollowedSellers: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import * as Api from '../../utils/api'
import * as CategoriesMod from '../../hooks/useCategories'
import * as SchemaMod from '../../hooks/useListingFormSchema'
import * as FollowMod from '../../hooks/useFollowedSellers'
import * as AuthMod from '../../hooks/useAuth'

describe('SearchResults', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('VITE_MAPBOX_TOKEN', '')

    vi.mocked(AuthMod.useAuth).mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
      justPromotedPro: false,
      isPro: false,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)

    vi.mocked(FollowMod.useFollowedSellers).mockReturnValue({
      sellerIds: [],
      isFollowing: () => false,
      followSeller: vi.fn(),
      unfollowSeller: vi.fn(),
      setFollowed: vi.fn(),
      loading: false
    } as any)

    vi.mocked(CategoriesMod.useCategories).mockReturnValue({
      categories: [],
      isLoading: false,
      error: null,
      refresh: vi.fn()
    } as any)

    vi.mocked(SchemaMod.useListingFormSchema).mockReturnValue({
      schema: null,
      isLoading: false,
      error: null,
      refresh: vi.fn()
    } as any)

    vi.mocked(Api.apiGet).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20
    } as any)
  })

  it('renders search header, empty state and opens filters drawer', async () => {
    const user = userEvent.setup()

    renderWithProviders(<SearchResults />, {
      useRouter: true,
      router: { initialEntries: ['/search?q=telephone'] }
    })

    expect(await screen.findByRole('heading', { name: /résultats de recherche/i })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /aucune annonce ne correspond à votre recherche/i })).toBeInTheDocument()
    const alertButtons = screen.getAllByRole('button', { name: /créer une alerte/i })
    expect(alertButtons.length).toBeGreaterThan(0)
    expect(alertButtons[0]).toHaveClass('search-page__alert-button')

    await user.click(screen.getByRole('button', { name: /filtres/i }))
    expect(document.querySelector('.search-drawer--open')).toBeTruthy()

    expect(vi.mocked(Api.apiGet)).toHaveBeenCalledWith(
      expect.stringContaining('/listings?'),
      expect.any(Object)
    )
  })

  it('normalizes query search before calling API', async () => {
    renderWithProviders(<SearchResults />, {
      useRouter: true,
      router: { initialEntries: ['/search?q=%20%20coloc%20%20'] }
    })

    await waitFor(() => {
      expect(vi.mocked(Api.apiGet)).toHaveBeenCalledWith(
        expect.stringContaining('search=coloc'),
        expect.any(Object)
      )
    })
  })

  it('forwards advanced search syntax (phrase + exclusion) to API', async () => {
    renderWithProviders(<SearchResults />, {
      useRouter: true,
      router: { initialEntries: ['/search?q=%22studio%20coloc%22%20-balcon'] }
    })

    await waitFor(() => {
      const calls = vi.mocked(Api.apiGet).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const listingPath = calls
        .map(([path]) => String(path))
        .reverse()
        .find(path => path.startsWith('/listings?'))
      expect(listingPath).toBeTruthy()
      const queryString = (listingPath as string).split('?')[1] ?? ''
      const params = new URLSearchParams(queryString)
      expect(params.get('search')).toBe('"studio coloc" -balcon')
    })
  })

  it('applies a syntax example chip and refreshes API query', async () => {
    const user = userEvent.setup()

    renderWithProviders(<SearchResults />, {
      useRouter: true,
      router: { initialEntries: ['/search'] }
    })

    await user.click(await screen.findByRole('button', { name: '"studio meublé"' }))

    await waitFor(() => {
      const calls = vi.mocked(Api.apiGet).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const listingPath = calls
        .map(([path]) => String(path))
        .reverse()
        .find(path => path.startsWith('/listings?'))
      expect(listingPath).toBeTruthy()
      const queryString = (listingPath as string).split('?')[1] ?? ''
      const params = new URLSearchParams(queryString)
      expect(params.get('search')).toBe('"studio meublé"')
    })
  })

  it('shows and applies did-you-mean suggestion when query looks misspelled', async () => {
    const user = userEvent.setup()
    vi.mocked(Api.apiGet).mockImplementation((path: string) => {
      if (path.startsWith('/search/suggestions')) {
        return Promise.resolve([
          { id: 's1', label: 'Téléphone', query: 'telephone', resultCount: 42, hits: 12 }
        ] as any)
      }
      return Promise.resolve({
        data: [],
        total: 0,
        page: 1,
        limit: 20
      } as any)
    })

    renderWithProviders(<SearchResults />, {
      useRouter: true,
      router: { initialEntries: ['/search?q=telephne'] }
    })

    expect(await screen.findByText(/vous vouliez dire/i)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Téléphone' })[0])

    await waitFor(() => {
      const calls = vi.mocked(Api.apiGet).mock.calls
      const listingCall = calls
        .map(([path]) => String(path))
        .reverse()
        .find(path => path.startsWith('/listings?'))
      expect(listingCall).toContain('search=telephone')
    })
  })

  it('applies manual location search on Enter', async () => {
    const user = userEvent.setup()

    renderWithProviders(<SearchResults />, {
      useRouter: true,
      router: { initialEntries: ['/search'] }
    })

    const locationInput = await screen.findByPlaceholderText(/ville|city/i)
    await user.clear(locationInput)
    await user.type(locationInput, 'Douala{enter}')

    await waitFor(() => {
      expect(vi.mocked(Api.apiGet)).toHaveBeenCalledWith(
        expect.stringContaining('city=Douala'),
        expect.any(Object)
      )
    })
  })

  it('keeps location selection and updates query when selecting a radius', async () => {
    const user = userEvent.setup()

    renderWithProviders(<SearchResults />, {
      useRouter: true,
      router: { initialEntries: ['/search?l=Douala&lat=4.0511&lng=9.7679'] }
    })

    const radiusTenButton = await screen.findByRole('button', { name: '10 km' })
    await user.click(radiusTenButton)

    await waitFor(() => {
      expect(vi.mocked(Api.apiGet)).toHaveBeenCalledWith(
        expect.stringContaining('radiusKm=10'),
        expect.any(Object)
      )
    })

    expect(screen.getByRole('button', { name: '25 km' })).toBeInTheDocument()
  })

  it('renders each sub-category once in the filters drawer', async () => {
    const user = userEvent.setup()
    const vehicleCategory: Category = {
      id: 'cat-vehicles',
      name: 'Véhicules',
      slug: 'vehicules',
      description: null,
      icon: null,
      color: null,
      gradient: null,
      isActive: true,
      position: 1
    }
    const carsCategory: Category = {
      id: 'cat-cars',
      name: 'Voitures',
      slug: 'voitures',
      description: null,
      icon: null,
      color: null,
      gradient: null,
      isActive: true,
      position: 2,
      parentId: 'cat-vehicles'
    }

    vi.mocked(CategoriesMod.useCategories).mockReturnValue({
      categories: [
        {
          ...vehicleCategory,
          children: [carsCategory]
        },
        carsCategory
      ],
      isLoading: false,
      error: null,
      refresh: vi.fn()
    } as any)

    renderWithProviders(<SearchResults />, {
      useRouter: true,
      router: { initialEntries: ['/search?category=vehicules'] }
    })

    await user.click(await screen.findByRole('button', { name: /filtres/i }))
    await user.click(screen.getByRole('button', { name: /sous-catégorie/i }))

    expect(screen.getAllByRole('button', { name: 'Voitures' })).toHaveLength(1)
  })
})
