import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAppWithProviders } from '../test/test-utils'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../utils/api', () => ({
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

  beforeEach(() => {
    window.history.pushState({}, '', '/listings/new')
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

    // categories API returns one category, auto-selected by component
    categoriesResponse = [{ id: 'cat1', name: 'Immobilier', parentId: null, extraFields: [] }]

    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
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

  it('fills base fields and publishes listing, then navigates to edit page', async () => {
    const user = userEvent.setup()

    renderAppWithProviders(<App />)

    // Ensure page loaded
    expect(await screen.findByRole('heading', { name: /déposer une annonce/i })).toBeInTheDocument()

    // Fill required base fields (category auto-selected)
    await user.clear(screen.getByLabelText(/devise/i))
    await user.type(screen.getByLabelText(/devise/i), 'EUR')

    await user.type(screen.getByLabelText(/titre de l’annonce/i), 'Appartement T3 rénové')

    await user.type(screen.getByLabelText(/description/i), 'Bel appartement proche des commodités')

    await user.type(screen.getByLabelText(/prix/i), '120000')

    await user.type(screen.getByLabelText(/ville/i), 'Dakar')

    await user.type(screen.getByLabelText(/localisation précise/i), 'Plateau')

    // No dynamic steps; directly submit (button label switches on last step)
    await user.click(screen.getByRole('button', { name: /publier mon annonce/i }))

    // Success toast
    expect(await screen.findByText(/annonce créée/i)).toBeInTheDocument()

    // Router navigates to edit page
    expect(window.location.pathname).toBe('/listings/edit/l1')
  })

  it('requires selecting a sub-category when available', async () => {
    categoriesResponse = [
      { id: 'parent1', name: 'Immobilier', parentId: null, extraFields: [] },
      { id: 'child1', name: 'Appartements', parentId: 'parent1', extraFields: [] }
    ]

    const user = userEvent.setup()

    renderAppWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: /déposer une annonce/i })).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/devise/i))
    await user.type(screen.getByLabelText(/devise/i), 'EUR')
    await user.type(screen.getByLabelText(/titre de l’annonce/i), 'Appartement T3 rénové')
    await user.type(screen.getByLabelText(/description/i), 'Bel appartement proche des commodités')
    await user.type(screen.getByLabelText(/prix/i), '120000')
    await user.type(screen.getByLabelText(/ville/i), 'Dakar')
    await user.type(screen.getByLabelText(/localisation précise/i), 'Plateau')

    await user.click(screen.getByRole('button', { name: /publier mon annonce/i }))
    expect(await screen.findByText(/veuillez sélectionner une catégorie/i)).toBeInTheDocument()
    expect(Api.apiPost).not.toHaveBeenCalled()

    await user.selectOptions(screen.getByLabelText(/sous-catégorie/i), 'child1')
    await user.click(screen.getByRole('button', { name: /publier mon annonce/i }))

    expect(await screen.findByText(/annonce créée/i)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/listings/edit/l1')
  })
})
