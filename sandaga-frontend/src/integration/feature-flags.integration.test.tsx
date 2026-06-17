import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { I18nProvider } from '../contexts/I18nContext'
import { FeatureFlagProvider, useFeatureFlagsContext } from '../contexts/FeatureFlagContext'
import { ToastProvider } from '../components/ui/Toast'
import { AppThemeProvider } from '../theme/ThemeProvider'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}))
vi.mock('../utils/api', () => ({
  setApiLocale: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}))
import * as AuthMod from '../hooks/useAuth'
import * as Api from '../utils/api'

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
    <AppThemeProvider>
      <I18nProvider>
        <FeatureFlagProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </FeatureFlagProvider>
      </I18nProvider>
    </AppThemeProvider>
  )
}

describe('Feature flags (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    vi.resetAllMocks()
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/messages/conversations')) {
        return { data: [], nextCursor: null, unreadTotal: 0 } as any
      }
      if (url === '/dashboard/overview') {
        return {
          stats: [],
          reminders: [],
          messages: [],
          notificationSummary: null,
          onboardingChecklist: { dismissed: true, tasks: [] }
        } as any
      }
      return [] as any
    })
  })

  it('keeps access to /dashboard/messages even if proMessaging is disabled', async () => {
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

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard/messages')
    })
  })
})
