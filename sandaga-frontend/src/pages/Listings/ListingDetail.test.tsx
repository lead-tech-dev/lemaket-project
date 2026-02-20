import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import ListingDetail from './ListingDetail'
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

vi.mock('../../hooks/useFollowedSellers', () => ({
  useFollowedSellers: vi.fn(),
}))

import * as Api from '../../utils/api'
import * as AuthMod from '../../hooks/useAuth'
import * as FollowMod from '../../hooks/useFollowedSellers'

describe('ListingDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.stubEnv('VITE_MAPBOX_TOKEN', '')

    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: {
        id: 'buyer-1',
        firstName: 'Jane',
        lastName: 'Doe',
        isPro: false,
      },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: false,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)

    vi.mocked(FollowMod.useFollowedSellers).mockReturnValue({
      sellerIds: [],
      isFollowing: () => false,
      followSeller: vi.fn(),
      unfollowSeller: vi.fn(),
      setFollowed: vi.fn(),
      loading: false
    } as any)

    vi.mocked(Api.apiGet).mockImplementation(async (url: string) => {
      if (url === '/listings/l1') {
        return {
          id: 'l1',
          title: 'Super annonce',
          description: 'Description test',
          status: 'published',
          price: 150000,
          currency: 'XAF',
          created_at: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          city: 'Dakar',
          location: { city: 'Dakar', zipcode: '10000', lat: 14.7, lng: -17.4 },
          images: [],
          owner: {
            id: 'seller-1',
            firstName: 'Alice',
            lastName: 'Seller',
            isPro: false,
            listingCount: 4,
            storefrontSlug: null,
            isCompanyVerified: false
          },
          attributes: {},
          details: {}
        } as any
      }
      if (url.startsWith('/listings/l1/similar')) {
        return [] as any
      }
      if (url.startsWith('/reviews/sellers/')) {
        return { items: [], summary: null } as any
      }
      if (url.startsWith('/deliveries/listing/l1')) {
        return null as any
      }
      return [] as any
    })

    vi.mocked(Api.apiPost).mockResolvedValue({} as any)
  })

  it('navigates to checkout when buy button is clicked', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/listing/:id" element={<ListingDetail />} />
        <Route path="/listing/:id/checkout" element={<h1>Checkout route</h1>} />
      </Routes>,
      {
        useRouter: true,
        router: { initialEntries: ['/listing/l1'] }
      }
    )

    expect(await screen.findByRole('heading', { name: /super annonce/i })).toBeInTheDocument()

    const buyButtons = await screen.findAllByRole('button', { name: /acheter/i })
    await user.click(buyButtons[0])

    expect(await screen.findByRole('heading', { name: /checkout route/i })).toBeInTheDocument()
  })
})
