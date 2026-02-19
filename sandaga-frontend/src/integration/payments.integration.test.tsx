import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
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
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
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

describe('Payments (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/dashboard/payments')
    vi.resetAllMocks()
    vi.mocked(useFeatureFlagsContext).mockReturnValue({
      flags: {} as any,
      isEnabled: () => true,
      setFlag: () => {}
    } as any)
    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: { id: 'u1', firstName: 'John', lastName: 'Doe', role: 'user', isPro: true },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: true,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)
  })

  it('opens add-method modal and creates a payment method', async () => {
    const user = userEvent.setup()
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/messages/conversations')) {
        return { data: [], nextCursor: null, unreadTotal: 0 } as any
      }
      if (url === '/payments/methods') return [] as any
      if (url === '/payments/invoices') return [] as any
      if (url === '/payments/subscriptions') return [] as any
      return [] as any
    })
    vi.mocked(Api.apiPost).mockResolvedValue({
      id: 'pm-new',
      type: 'card',
      holderName: 'John Doe',
      isDefault: true,
      currency: 'XAF'
    } as any)

    renderAppWithProviders(<App />)

    await user.click(
      await screen.findByRole('button', { name: /^ajouter une méthode de paiement$/i })
    )
    await user.type(screen.getByLabelText(/nom du titulaire/i), 'John Doe')
    await user.click(screen.getByRole('button', { name: /enregistrer/i }))

    expect(vi.mocked(Api.apiPost)).toHaveBeenCalledWith(
      '/payments/methods',
      expect.objectContaining({
        holderName: 'John Doe'
      })
    )
  })

  it('sets a method as default', async () => {
    const user = userEvent.setup()
    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/messages/conversations')) {
        return { data: [], nextCursor: null, unreadTotal: 0 } as any
      }
      if (url === '/payments/methods') {
        return [
          {
            id: 'pm-1',
            type: 'card',
            holderName: 'John Doe',
            isDefault: false,
            status: 'active',
            verificationStatus: 'verified',
            currency: 'XAF'
          }
        ] as any
      }
      if (url === '/payments/invoices') return [] as any
      if (url === '/payments/subscriptions') return [] as any
      return [] as any
    })
    vi.mocked(Api.apiPatch).mockResolvedValue({
      id: 'pm-1',
      isDefault: true
    } as any)

    renderAppWithProviders(<App />)

    await user.click(await screen.findByRole('button', { name: /définir par défaut/i }))

    expect(vi.mocked(Api.apiPatch)).toHaveBeenCalledWith('/payments/methods/pm-1', {
      isDefault: true
    })
  })
})
