import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test/test-utils'
import NewListing from '../pages/Listings/NewListing'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}))
vi.mock('../utils/api', () => ({
  setApiLocale: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))
vi.mock('../hooks/useListingFormSchema', () => ({
  useListingFormSchema: vi.fn(),
}))

import * as AuthMod from '../hooks/useAuth'
import * as Api from '../utils/api'
import * as SchemaHook from '../hooks/useListingFormSchema'

describe('New Listing flow (integration)', () => {
  let categoriesResponse: any[]
  const publishButtonMatcher = /publier l['’]?annonce/i

  beforeEach(() => {
    vi.resetAllMocks()

    // authenticated user
    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: { id: 'u1', firstName: 'Jane', lastName: 'Doe', role: 'user', isPro: false },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: false,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)

    // categories API (root + children/details endpoints)
    categoriesResponse = [
      { id: 'cat1', name: 'Immobilier', parentId: null, extraFields: [], description: 'Biens immobiliers', icon: '🏠' }
    ]

    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/categories/')) {
        const categoryId = url.split('/').pop() ?? ''
        return (categoriesResponse.find(category => category.id === categoryId) ?? null) as any
      }
      if (url.startsWith('/categories') && url.includes('parentId=null')) {
        return categoriesResponse.filter(category => category.parentId === null) as any
      }
      if (url.startsWith('/categories') && url.includes('parentId=')) {
        const parentId = url.split('parentId=')[1]?.split('&')[0] ?? ''
        return categoriesResponse.filter(category => category.parentId === parentId) as any
      }
      if (url.startsWith('/categories')) {
        return categoriesResponse as any
      }
      return [] as any
    })

    // no dynamic steps to simplify
    vi.mocked(SchemaHook.useListingFormSchema).mockReturnValue({
      schema: { categoryId: 'cat1', steps: [] },
      isLoading: false,
      error: null,
    } as any)

    // create listing returns id
    vi.mocked(Api.apiPost).mockResolvedValue({ id: 'l1' } as any)
  })

  it.skip('selects a category and publishes listing, then navigates to edit page', async () => {
    renderWithProviders(<NewListing />, {
      useRouter: true,
      router: { initialEntries: ['/listings/new'] }
    })

    expect(await screen.findByRole('heading', { name: /créer une annonce/i })).toBeInTheDocument()

    // Select root category (no sub-category in this scenario).
    fireEvent.click(await screen.findByRole('button', { name: /immobilier/i }))

    const publishButton = await screen.findByRole('button', { name: publishButtonMatcher })
    fireEvent.click(publishButton)

    // Success toast
    expect(await screen.findByText(/annonce créée/i)).toBeInTheDocument()

    expect(Api.apiPost).toHaveBeenCalledWith('/listings', expect.any(Object))

  })

  it.skip('requires selecting a sub-category when available', async () => {
    categoriesResponse = [
      {
        id: 'parent1',
        name: 'Immobilier',
        parentId: null,
        extraFields: [],
        description: 'Biens immobiliers',
        icon: '🏠'
      },
      {
        id: 'child1',
        name: 'Appartements',
        parentId: 'parent1',
        extraFields: [],
        description: 'Appartements à vendre',
        icon: '🏢'
      }
    ]

    renderWithProviders(<NewListing />, {
      useRouter: true,
      router: { initialEntries: ['/listings/new'] }
    })

    expect(await screen.findByRole('heading', { name: /créer une annonce/i })).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /immobilier/i }))
    expect(screen.queryByRole('button', { name: publishButtonMatcher })).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /appartements/i }))
    fireEvent.click(await screen.findByRole('button', { name: publishButtonMatcher }))

    expect(await screen.findByText(/annonce créée/i)).toBeInTheDocument()
    expect(Api.apiPost).toHaveBeenCalledWith('/listings', expect.any(Object))
  })
})
