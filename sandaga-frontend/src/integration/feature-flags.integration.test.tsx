import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../contexts/I18nContext'
import { FeatureFlagProvider, useFeatureFlagsContext } from '../contexts/FeatureFlagContext'
import { ToastProvider } from '../components/ui/Toast'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}))
import * as AuthMod from '../hooks/useAuth'

// We'll override the feature flag context via vi.spyOn hook
vi.mock('../contexts/FeatureFlagContext', async (orig) => {
  const mod: any = await orig()
  return {
    ...mod,
    useFeatureFlagsContext: vi.fn(),
  }
})

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

describe('Feature flags (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    vi.resetAllMocks()
  })

  it('blocks access to /dashboard/messages if proMessaging is disabled', async () => {
    // authenticated user
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

    // disable the proMessaging flag
    vi.mocked(useFeatureFlagsContext).mockReturnValue({
      flags: {} as any,
      isEnabled: (flag: any) => flag !== 'proMessaging',
      setFlag: () => {}
    } as any)

    window.history.pushState({}, '', '/dashboard/messages')
    renderApp()

    // Should be redirected to dashboard
    expect(await screen.findByRole('heading', { name: /bonjour/i })).toBeInTheDocument()
  })
})
