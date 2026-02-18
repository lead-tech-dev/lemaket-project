import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../test/test-utils'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../contexts/FeatureFlagContext', async (orig) => {
  const mod: any = await orig()
  return {
    ...mod,
    useFeatureFlagsContext: vi.fn(),
  }
})

import * as AuthMod from '../hooks/useAuth'
import { useFeatureFlagsContext } from '../contexts/FeatureFlagContext'

describe('Admin routing (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    vi.resetAllMocks()
    // enable all admin flags by default
    vi.mocked(useFeatureFlagsContext).mockReturnValue({
      flags: {} as any,
      isEnabled: () => true,
      setFlag: () => {}
    } as any)
  })

  it('redirects non-admin users from /admin to /dashboard', async () => {
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

    renderWithProviders(<App />, { router: { initialEntries: ['/admin'] } })

    expect(await screen.findByRole('heading', { name: /bonjour/i })).toBeInTheDocument()
  })

  it('allows admin users to access /admin', async () => {
    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: { id: 'a1', firstName: 'Alice', lastName: 'Admin', role: 'admin', isPro: true },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: true,
      isAdmin: true,
      acknowledgePromotion: () => {}
    } as any)

    renderWithProviders(<App />, { router: { initialEntries: ['/admin'] } })

    expect(await screen.findByRole('heading', { name: /administration LEMAKET/i })).toBeInTheDocument()
  })
})
