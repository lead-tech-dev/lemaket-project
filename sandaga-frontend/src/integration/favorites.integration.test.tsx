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
  apiDelete: vi.fn(),
}))
vi.mock('../utils/auth-token', () => ({
  getAuthToken: vi.fn(),
}))

import * as AuthMod from '../hooks/useAuth'
import * as Api from '../utils/api'
import * as Token from '../utils/auth-token'

describe('Favorites (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    vi.resetAllMocks()

    // default: unauthenticated
    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: null,
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: false,
      isPro: false,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)

    // mock Home endpoints to render featured listings quickly
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url === '/home/hero') return { ...({
        eyebrow: 'X', title: 'T', subtitle: 'S', tags: [], stats: [{ label: 'Annonces actives', value: '+18 M', detail: '...' }]
      }) } as any
      if (url === '/home/categories') return [] as any
      if (url === '/home/services') return [] as any
      if (url === '/home/seller-split') return { proListings: 0, individualListings: 0, proShare: 50, individualShare: 50 } as any
      if (url.startsWith('/home/listings')) {
        return {
          featured: [
            { id: 'fav-1', title: 'Item 1', price: '10', currency: 'EUR', city: 'City', location: 'City', tag: 'Tag', category: null, coverImage: null, owner: null, publishedAt: null, isFeatured: true, isBoosted: false, ribbon: 'À la une' },
          ],
          latest: []
        } as any
      }
      if (url === '/home/testimonials') return [] as any
      if (url === '/home/trending-searches') return [] as any
      return [] as any
    })
  })

  it('unauthenticated click on favorite requests login and shows toast', async () => {
    vi.mocked(Token.getAuthToken).mockReturnValue(null as any)

    renderAppWithProviders(<App />)

    // Wait for featured section and a favorite button
    const btn = await screen.findByRole('button', { name: /ajouter aux favoris/i })
    await userEvent.click(btn)

    // Login page should appear
    expect(await screen.findByRole('heading', { name: /connexion à votre compte/i })).toBeInTheDocument()
    // Error toast text also appears
    expect(await screen.findByText(/connexion requise/i)).toBeInTheDocument()
  })

  it('authenticated can toggle favorite and call APIs', async () => {
    vi.mocked(Token.getAuthToken).mockReturnValue('token' as any)
    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: { id: 'u1', firstName: 'John', lastName: 'Doe', role: 'user', isPro: false },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: false,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)

    renderAppWithProviders(<App />)

    const btn = await screen.findByRole('button', { name: /ajouter aux favoris/i })

    await userEvent.click(btn)
    expect(vi.mocked(Api.apiPost)).toHaveBeenCalledWith('/favorites/fav-1')

    // Button aria-pressed becomes true
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    // Toggle back
    await userEvent.click(btn)
    expect(vi.mocked(Api.apiDelete)).toHaveBeenCalledWith('/favorites/fav-1')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })
})
