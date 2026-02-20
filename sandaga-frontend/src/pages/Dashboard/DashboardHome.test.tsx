import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import DashboardHome from './DashboardHome'
import { renderWithProviders } from '../../test/test-utils'

vi.mock('../../layouts/DashboardLayout', () => ({
  default: ({ children }: { children: any }) => <div data-testid="dashboard-layout">{children}</div>
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}))

vi.mock('../../utils/api', () => ({
  setApiLocale: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}))

import * as AuthMod from '../../hooks/useAuth'
import * as Api from '../../utils/api'

describe('DashboardHome', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: {
        id: 'u1',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        isPro: false,
        role: 'user'
      },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: false,
      isAdmin: false,
      acknowledgePromotion: vi.fn()
    } as any)

    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url === '/dashboard/overview') {
        return {
          stats: [],
          reminders: [],
          messages: [],
          notificationSummary: null,
          onboardingChecklist: null
        } as any
      }
      if (url.startsWith('/messages/conversations')) {
        return { data: [], nextCursor: null, unreadTotal: 0 } as any
      }
      return [] as any
    })
  })

  it('renders the publish CTA and navigates to new listing page', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/listings/new" element={<h1>Nouvelle annonce</h1>} />
      </Routes>,
      {
        useRouter: true,
        router: { initialEntries: ['/dashboard'] }
      }
    )

    const publishButton = await screen.findByRole('button', { name: /publier une annonce/i })
    expect(publishButton).toHaveClass('dashboard-header__primary-action')

    await user.click(publishButton)

    expect(await screen.findByRole('heading', { name: /nouvelle annonce/i })).toBeInTheDocument()
  })
})
