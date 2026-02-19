import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAppWithProviders } from '../test/test-utils'
import { App } from '../App'

vi.mock('../utils/auth', async (orig) => {
  const mod: any = await orig()
  return {
    ...mod,
    login: vi.fn(),
  }
})
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}))
import * as AuthApi from '../utils/auth'
import * as AuthMod from '../hooks/useAuth'

describe('Login flow (integration)', () => {
  let isAuthenticated = false
  const authUser = { id: 'u1', firstName: 'Jane', lastName: 'Doe', role: 'user', isPro: false }

  beforeEach(() => {
    window.history.pushState({}, '', '/login')
    vi.resetAllMocks()
    isAuthenticated = false
    vi.mocked(AuthMod.useAuth).mockImplementation(
      () =>
        ({
          user: isAuthenticated ? authUser : null,
          loading: false,
          error: null,
          justPromotedPro: false,
          isAuthenticated,
          isPro: false,
          isAdmin: false,
          acknowledgePromotion: () => {}
        }) as any
    )
    vi.mocked(AuthMod.invalidateAuthCache).mockImplementation(() => {
      isAuthenticated = true
    })
  })

  it('logs in successfully and redirects to dashboard with a toast', async () => {
    vi.mocked(AuthApi.login).mockResolvedValue({
      accessToken: 'token',
      user: authUser,
      expiresIn: 3600,
    } as any)

    const user = userEvent.setup()
    renderAppWithProviders(<App />)

    await user.type(screen.getByLabelText(/adresse e-mail/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/mot de passe/i), 'secret')
    await user.click(screen.getByRole('button', { name: /se connecter/i }))

    expect(vi.mocked(AuthApi.login)).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'secret'
    })
    expect(await screen.findByRole('heading', { name: /bonjour/i })).toBeInTheDocument()
  })
})
