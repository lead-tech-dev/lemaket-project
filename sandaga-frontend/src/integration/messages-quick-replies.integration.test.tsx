import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
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

function emptyConversations() {
  return { data: [], nextCursor: null, unreadTotal: 0 }
}

describe('Messages quick replies (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/dashboard/messages')
    vi.resetAllMocks()
    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: { id: 'u1', firstName: 'Jane', lastName: 'Doe', role: 'user', isPro: false },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: true,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/messages/conversations')) return emptyConversations() as any
      if (url === '/messages/quick-replies') return [] as any
      return [] as any
    })
  })

  it('creates a quick reply via modal and shows success toast', async () => {
    const user = userEvent.setup()
    vi.mocked(Api.apiPost).mockResolvedValue({ id: 'qr1', label: 'Merci', content: 'Merci pour votre message.' } as any)

    renderAppWithProviders(<App />)

    const manageBtn = await screen.findByRole('button', { name: /gérer les réponses rapides/i })
    await user.click(manageBtn)
    await user.type(
      await screen.findByPlaceholderText(/ex: remerciement/i),
      'Merci'
    )
    await user.type(
      screen.getByPlaceholderText(/réponse rapide/i),
      'Merci pour votre message.'
    )
    await user.click(screen.getByRole('button', { name: /créer le modèle/i }))

    expect(await screen.findByText(/modèle créé/i)).toBeInTheDocument()
  })

  it('deletes a quick reply via modal and shows success toast', async () => {
    const user = userEvent.setup()
    // First load returns one quick reply
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/messages/conversations')) return emptyConversations() as any
      if (url === '/messages/quick-replies') return [{ id: 'qr1', label: 'Merci', content: 'Merci' }] as any
      return [] as any
    })
    vi.mocked(Api.apiDelete).mockResolvedValue({ success: true } as any)

    renderAppWithProviders(<App />)

    const manageBtn = await screen.findByRole('button', { name: /gérer les réponses rapides/i })
    await user.click(manageBtn)
    await user.click(await screen.findByRole('button', { name: /supprimer/i }))

    expect(await screen.findByText(/modèle supprimé/i)).toBeInTheDocument()
  })
})
