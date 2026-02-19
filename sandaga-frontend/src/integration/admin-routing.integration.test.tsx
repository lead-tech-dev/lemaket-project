import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderAppWithProviders } from '../test/test-utils'
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
  apiDelete: vi.fn()
}))
vi.mock('../contexts/FeatureFlagContext', async (orig) => {
  const mod: any = await orig()
  return {
    ...mod,
    useFeatureFlagsContext: vi.fn(),
  }
})

import * as AuthMod from '../hooks/useAuth'
import * as Api from '../utils/api'
import { useFeatureFlagsContext } from '../contexts/FeatureFlagContext'

describe('Admin routing (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/admin')
    vi.resetAllMocks()
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url === '/dashboard/overview') {
        return {
          stats: [],
          reminders: [],
          messages: [],
          notificationSummary: null,
          onboardingChecklist: { dismissed: true, tasks: [] }
        } as any
      }
      if (url === '/admin/metrics') {
        return [] as any
      }
      if (url === '/admin/activities') {
        return [] as any
      }
      return [] as any
    })
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

    renderAppWithProviders(<App />)

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

    renderAppWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: /admin|administration/i })).toBeInTheDocument()
  })
})
