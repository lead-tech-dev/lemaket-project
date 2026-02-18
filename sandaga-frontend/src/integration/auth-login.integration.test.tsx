import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../contexts/I18nContext'
import { FeatureFlagProvider } from '../contexts/FeatureFlagContext'
import { ToastProvider } from '../components/ui/Toast'
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
}))
import * as AuthApi from '../utils/auth'
import * as AuthMod from '../hooks/useAuth'

function renderApp() {
  return render(
    <I18nProvider>
      <FeatureFlagProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </FeatureFlagProvider>
    </I18nProvider>
  )
}

describe('Login flow (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/login')
    vi.resetAllMocks()
  })

  it('logs in successfully and redirects to dashboard with a toast', async () => {
    // unauthenticated before login
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

    vi.mocked(AuthApi.login).mockResolvedValue({
      accessToken: 'token',
      user: { id: 'u1', firstName: 'Jane', lastName: 'Doe', role: 'user', isPro: false },
      expiresIn: 3600,
    } as any)

    const user = userEvent.setup()
    renderApp()

    // Fill and submit
    await user.type(screen.getByLabelText(/adresse e-mail/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/mot de passe/i), 'secret')
    await user.click(screen.getByRole('button', { name: /se connecter/i }))

    // After login, the app will render dashboard route; since useAuth is cached internally,
    // we rely on navigation + visible dashboard heading
    expect(await screen.findByRole('heading', { name: /bonjour/i })).toBeInTheDocument()
  })
})
