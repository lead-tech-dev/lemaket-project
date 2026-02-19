import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../contexts/I18nContext'
import { FeatureFlagProvider } from '../contexts/FeatureFlagContext'
import { ToastProvider } from '../components/ui/Toast'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}))
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

describe('Auth routing (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    vi.resetAllMocks()
  })

  it('redirects unauthenticated users to /login for /dashboard', async () => {
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

    window.history.pushState({}, '', '/dashboard')
    renderApp()

    expect(await screen.findByRole('heading', { name: /connexion à votre compte/i })).toBeInTheDocument()
  })

  it('shows dashboard for authenticated users', async () => {
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

    window.history.pushState({}, '', '/dashboard')
    renderApp()

    expect(await screen.findByRole('heading', { name: /bonjour/i })).toBeInTheDocument()
  })
})
