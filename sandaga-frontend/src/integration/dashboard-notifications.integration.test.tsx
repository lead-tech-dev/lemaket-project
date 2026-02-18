import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/test-utils'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../utils/api', () => ({
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

    renderWithProviders(<App />, { router: { initialEntries: ['/dashboard'] } })

    // Wait for Center heading
    expect(await screen.findByRole('heading', { name: /centre de notifications/i })).toBeInTheDocument()

    // Find the first item and click "Marquer comme lu"
    const list = document.querySelector('.notification-center__list') as HTMLElement
    const firstItem = within(list).getAllByText(/marquer comme lu/i)[0]
    await userEvent.click(firstItem)

    // Button should disappear for that item (replaced by "Lu") and counts decrease
    expect(await screen.findByText('Lu')).toBeInTheDocument()
    expect(screen.getByText(/non lues/i).textContent).toMatch(/1\s+non lues/)
  })

  it('marks all notifications as read', async () => {
    vi.mocked(Api.apiGet).mockResolvedValue(overviewResponse() as any)
    vi.mocked(Api.apiPatch).mockResolvedValue({} as any)

    renderWithProviders(<App />, { router: { initialEntries: ['/dashboard'] } })

    expect(await screen.findByRole('heading', { name: /centre de notifications/i })).toBeInTheDocument()

    // Click "Tout marquer comme lu"
    const markAllBtn = screen.getByRole('button', { name: /tout marquer comme lu/i })
    await userEvent.click(markAllBtn)

    // Badge shows 0 non lues
    expect(screen.getByText(/0\s+non lues/)).toBeInTheDocument()
  })
})
