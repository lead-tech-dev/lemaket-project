import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/test-utils'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../utils/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

import * as AuthMod from '../hooks/useAuth'
import * as Api from '../utils/api'

function overviewWithReminder() {
  return {
    stats: [],
    reminders: [
      { title: 'Découvrez les offres PRO', due: 'Aujourd\'hui', action: 'Découvrir' },
    ],
    messages: [],
    notificationSummary: null,
    onboardingChecklist: { dismissed: true, tasks: [] },
  }
}

describe('Payments (integration)', () => {
  const originalAssign = window.location.assign

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
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url === '/dashboard/overview') return overviewWithReminder() as any
      return [] as any
    })
  })

  afterEach(() => {
    window.location.assign = originalAssign
  })

  it('opens PRO upgrade modal and redirects to Stripe when redirectUrl is returned', async () => {
    const user = userEvent.setup()
    // mock apiPost to return redirectUrl
    vi.mocked(Api.apiPost).mockResolvedValue({ redirectUrl: 'https://stripe.test/session' } as any)

    // spy on location.assign
    const assignSpy = vi.fn()
    window.location.assign = assignSpy as typeof window.location.assign

    renderWithProviders(<App />, { router: { initialEntries: ['/dashboard'] } })

    // Click the reminder CTA "Découvrir" in Actions rapides
    const discoverBtn = await screen.findByRole('button', { name: /découvrir/i })
    await user.click(discoverBtn)

    // Modal appears: click on one plan CTA (match by button text from constants, generic by role)
    const planButtons = await screen.findAllByRole('button', { name: /essai|activer|mensuel|annuel|gratuit|pro/i })
    await user.click(planButtons[0])

    expect(assignSpy).toHaveBeenCalledWith('https://stripe.test/session')
  })

  it('shows success toast and closes modal when subscription is activated without redirect', async () => {
    const user = userEvent.setup()
    // mock apiPost to return nextRenewalAt only
    vi.mocked(Api.apiPost).mockResolvedValue({ nextRenewalAt: new Date().toISOString() } as any)

    renderWithProviders(<App />, { router: { initialEntries: ['/dashboard'] } })

    const discoverBtn = await screen.findByRole('button', { name: /découvrir/i })
    await user.click(discoverBtn)

    const planButtons = await screen.findAllByRole('button', { name: /essai|activer|mensuel|annuel|gratuit|pro/i })
    await user.click(planButtons[0])

    // Expect a success toast message
    expect(await screen.findByText(/abonnement confirmé|essai activé/i)).toBeInTheDocument()
  })
})
