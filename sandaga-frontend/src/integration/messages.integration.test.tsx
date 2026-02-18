import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderWithProviders } from '../test/test-utils'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../utils/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}))

import * as AuthMod from '../hooks/useAuth'
import * as Api from '../utils/api'

function conversationsResponse(overrides?: Partial<{ data: any[]; nextCursor: string | null; unreadTotal: number }>) {
  return {
    data: [],
    nextCursor: null,
    unreadTotal: 0,
    ...overrides,
  }
}

describe('Messages page (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/dashboard/messages')
    vi.resetAllMocks()
    // authenticated user
    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: { id: 'u1', firstName: 'Jane', lastName: 'Doe', role: 'user', isPro: false },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: false,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)
  })

  it('shows empty state when no conversations', async () => {
    vi.mocked(Api.apiGet).mockResolvedValue(conversationsResponse())

    renderWithProviders(<App />, { router: { initialEntries: ['/dashboard/messages'] } })

    expect(await screen.findByRole('heading', { name: /aucune conversation pour le moment/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /actualiser/i })).toBeInTheDocument()
  })

  it('shows loading skeleton then content once loaded', async () => {
    // make the first call defer, then resolve
    let resolveFn: (v: any) => void
    const pending = new Promise(r => { resolveFn = r })
    vi.mocked(Api.apiGet).mockReturnValueOnce(pending as any)

    renderWithProviders(<App />, { router: { initialEntries: ['/dashboard/messages'] } })

    // skeleton container is rendered while loading
    const section = await screen.findByRole('region', { hidden: true }).catch(() => null)
    // Alternatively check by querying the skeleton container via aria-hidden
    expect(document.querySelector('.message-list[aria-hidden]')).toBeTruthy()

    // resolve
    resolveFn!(conversationsResponse())

    // eventually shows empty state
    expect(await screen.findByRole('heading', { name: /aucune conversation pour le moment/i })).toBeInTheDocument()
  })

  it('shows RetryBanner on error and retries on click', async () => {
    // first call rejects
    vi.mocked(Api.apiGet)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(conversationsResponse())

    renderWithProviders(<App />, { router: { initialEntries: ['/dashboard/messages'] } })

    // RetryBanner visible
    const banner = await screen.findByText(/impossible de charger vos conversations/i)
    expect(banner).toBeInTheDocument()

    // Click Retry
    const retryContainer = banner.closest('[role="region"], div') as HTMLElement
    const retryBtn = within(retryContainer.parentElement as HTMLElement).getByRole('button', { name: /réessayer|actualiser/i })
    await userEvent.click(retryBtn)

    // Empty state after retry
    expect(await screen.findByRole('heading', { name: /aucune conversation pour le moment/i })).toBeInTheDocument()
    expect(vi.mocked(Api.apiGet)).toHaveBeenCalledTimes(2)
  })
})
