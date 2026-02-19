import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAppWithProviders } from '../test/test-utils'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}))
vi.mock('../utils/api', () => ({
  setApiLocale: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}))

import * as AuthMod from '../hooks/useAuth'
import * as Api from '../utils/api'

describe('Dashboard notifications (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/dashboard')
    vi.resetAllMocks()
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
  })

  function overviewResponse() {
    const now = new Date().toISOString()
    return {
      stats: [],
      reminders: [],
      messages: [],
      onboardingChecklist: {
        dismissed: true,
        tasks: [],
      },
      notificationSummary: {
        totalUnread: 2,
        categories: [
          { category: 'system', unread: 2, total: 2, latest: { id: 'n1', isRead: false } },
        ],
        recent: [
          { id: 'n1', category: 'system', title: 'Incident résolu', body: 'Tout va bien', created_at: now, isRead: false },
          { id: 'n2', category: 'system', title: 'Mise à jour', body: 'Nouveautés', created_at: now, isRead: false },
        ],
      },
    }
  }

  it('marks a single notification as read', async () => {
    vi.mocked(Api.apiGet).mockResolvedValue(overviewResponse() as any)
    vi.mocked(Api.apiPatch).mockResolvedValue({} as any)

    renderAppWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: /notifications/i })).toBeInTheDocument()

    const list = document.querySelector('.notification-center__list') as HTMLElement
    const firstAction = within(list).getAllByRole('button', { name: /marquer/i })[0]
    await userEvent.click(firstAction)

    expect(vi.mocked(Api.apiPatch)).toHaveBeenCalledWith('/notifications/n1/read')
    expect(await screen.findByText('Lu')).toBeInTheDocument()
  })

  it('marks all notifications as read', async () => {
    vi.mocked(Api.apiGet).mockResolvedValue(overviewResponse() as any)
    vi.mocked(Api.apiPatch).mockResolvedValue({} as any)

    renderAppWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: /notifications/i })).toBeInTheDocument()

    const markAllBtn = screen.getByRole('button', { name: /tout marquer comme lu/i })
    await userEvent.click(markAllBtn)

    expect(vi.mocked(Api.apiPatch)).toHaveBeenCalledWith('/notifications/read-all')
    expect(markAllBtn).toBeDisabled()
  })
})
