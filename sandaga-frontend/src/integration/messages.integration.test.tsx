import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderAppWithProviders } from '../test/test-utils'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}))
vi.mock('../utils/api', () => ({
  setApiLocale: vi.fn(),
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
      user: { id: 'u1', firstName: 'Jane', lastName: 'Doe', role: 'user', isPro: true },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: true,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)
  })

  it('shows empty state when no conversations', async () => {
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/messages/conversations')) return conversationsResponse() as any
      if (url === '/messages/quick-replies') return [] as any
      return [] as any
    })

    renderAppWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: /aucune conversation pour le moment/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /actualiser/i })).toBeInTheDocument()
  })

  it('shows loading skeleton then content once loaded', async () => {
    let resolveFn: (v: any) => void
    const pending = new Promise(r => {
      resolveFn = r
    })
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/messages/conversations')) return pending as any
      if (url === '/messages/quick-replies') return [] as any
      return [] as any
    })

    renderAppWithProviders(<App />)

    expect(document.querySelector('.message-list[aria-hidden]')).toBeTruthy()

    resolveFn!(conversationsResponse())

    expect(await screen.findByRole('heading', { name: /aucune conversation pour le moment/i })).toBeInTheDocument()
  })

  it('shows RetryBanner on error and retries on click', async () => {
    let pageConversationsCallCount = 0
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/messages/conversations')) {
        if (url.includes('limit=10')) {
          return conversationsResponse() as any
        }
        pageConversationsCallCount += 1
        if (pageConversationsCallCount === 1) {
          throw new Error('Network down')
        }
        return conversationsResponse() as any
      }
      if (url === '/messages/quick-replies') return [] as any
      return [] as any
    })

    renderAppWithProviders(<App />)

    const retryBtn = await screen.findByRole('button', { name: /^réessayer$/i })
    await userEvent.click(retryBtn)

    expect(await screen.findByRole('heading', { name: /aucune conversation pour le moment/i })).toBeInTheDocument()
    expect(pageConversationsCallCount).toBeGreaterThanOrEqual(2)
  })
})
