import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import ListingCheckout from './ListingCheckout'
import { renderWithProviders } from '../../test/test-utils'

vi.mock('../../layouts/MainLayout', () => ({
  default: ({ children }: { children: any }) => <div data-testid="main-layout">{children}</div>
}))

vi.mock('../../utils/api', () => ({
  setApiLocale: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}))

import * as Api from '../../utils/api'
import * as AuthMod from '../../hooks/useAuth'

describe('ListingCheckout', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('VITE_MAPBOX_TOKEN', '')

    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: {
        id: 'buyer-1',
        firstName: 'Jane',
        lastName: 'Doe',
        phoneNumber: '77000000',
        isPro: false
      },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: false,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)

    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url === '/listings/l1') {
        return {
          id: 'l1',
          title: 'Annonce test',
          status: 'published',
          price: 25000,
          currency: 'XAF',
          city: 'Dakar',
          location: { city: 'Dakar', zipcode: '10000', lat: 14.7, lng: -17.4 },
          images: [],
          attributes: {},
          details: {}
        } as any
      }
      if (url === '/payments/wallet') {
        return { balance: 80000, currency: 'XAF' } as any
      }
      if (url.startsWith('/users/couriers')) {
        return [] as any
      }
      return [] as any
    })

    vi.mocked(Api.apiPost).mockResolvedValue({
      paymentId: 'pay-1',
      orderId: 'order-1'
    } as any)
  })

  it('submits secured checkout in pickup mode and redirects back to listing', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/listing/:id/checkout" element={<ListingCheckout />} />
        <Route path="/listing/:id" element={<h1>Listing return</h1>} />
      </Routes>,
      {
        useRouter: true,
        router: { initialEntries: ['/listing/l1/checkout'] }
      }
    )

    expect(await screen.findByRole('heading', { name: /finaliser l’achat/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /remise en main propre/i }))

    await waitFor(() => {
      const payButtons = screen.getAllByRole('button', { name: /payer en sécurisé/i })
      expect(payButtons[0]).toBeEnabled()
    })

    await user.click(screen.getAllByRole('button', { name: /payer en sécurisé/i })[0])

    await waitFor(() => {
      expect(vi.mocked(Api.apiPost)).toHaveBeenCalledWith(
        '/deliveries/escrow/init',
        expect.objectContaining({
          listingId: 'l1',
          handoverMode: 'pickup'
        })
      )
    })

    expect(await screen.findByRole('heading', { name: /listing return/i })).toBeInTheDocument()
  })
})
