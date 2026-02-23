import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAppWithProviders } from '../test/test-utils'
import { App } from '../App'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
  invalidateAuthCache: vi.fn(),
}))
vi.mock('../utils/auth', async (orig) => {
  const mod: any = await orig()
  return {
    ...mod,
    updateSettings: vi.fn(),
    updateTwoFactor: vi.fn(),
    changePassword: vi.fn(),
    listAddresses: vi.fn(),
    createAddress: vi.fn(),
    updateAddress: vi.fn(),
    deleteAddress: vi.fn(),
  }
})

import * as AuthMod from '../hooks/useAuth'
import * as AuthApi from '../utils/auth'

describe('Settings page (integration)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/dashboard/settings')
    vi.resetAllMocks()
    vi.mocked(AuthMod.useAuth).mockReturnValue({
      user: {
        id: 'u1', firstName: 'Jane', lastName: 'Doe', role: 'user', isPro: false,
        settings: {
          maskPreciseLocation: false,
          emailAlerts: true,
          preferredContactChannels: ['email', 'in_app']
        }
      },
      loading: false,
      error: null,
      justPromotedPro: false,
      isAuthenticated: true,
      isPro: false,
      isAdmin: false,
      acknowledgePromotion: () => {}
    } as any)

    vi.mocked(AuthApi.listAddresses).mockResolvedValue([] as any)
  })

  it('optimistically toggles a privacy setting and calls updateSettings', async () => {
    const user = userEvent.setup()
    vi.mocked(AuthApi.updateSettings).mockResolvedValue({} as any)

    renderAppWithProviders(<App />)

    // Wait for page title
    expect(await screen.findByRole('heading', { name: /paramètres/i })).toBeInTheDocument()

    const toggle = screen.getByRole('checkbox', { name: /masquer ma localisation précise/i })
    expect(toggle).not.toBeChecked()

    await user.click(toggle)
    expect(toggle).toBeChecked()
    expect(vi.mocked(AuthApi.updateSettings)).toHaveBeenCalledWith({ maskPreciseLocation: true })
  })

  it('reverts toggle on updateSettings error and shows error toast', async () => {
    const user = userEvent.setup()
    vi.mocked(AuthApi.updateSettings).mockRejectedValue(new Error('Boom'))

    renderAppWithProviders(<App />)

    const toggle = await screen.findByRole('checkbox', { name: /masquer ma localisation précise/i })

    await user.click(toggle)
    // After error, it should revert back unchecked
    expect(await screen.findByText(/enregistrement impossible/i)).toBeInTheDocument()
    expect(toggle).not.toBeChecked()
  })

  it('toggles two-factor and shows success toast', async () => {
    const user = userEvent.setup()
    vi.mocked(AuthApi.updateTwoFactor).mockResolvedValue({} as any)

    renderAppWithProviders(<App />)

    const btn = await screen.findByRole('button', { name: /activer la double authentification/i })
    await user.click(btn)

    expect(vi.mocked(AuthApi.updateTwoFactor)).toHaveBeenCalledWith(true)
    expect(await screen.findByText(/double authentification activée/i)).toBeInTheDocument()
  })

  it('changes password successfully', async () => {
    const user = userEvent.setup()
    vi.mocked(AuthApi.changePassword).mockResolvedValue({} as any)

    renderAppWithProviders(<App />)

    // Open form
    const openBtn = await screen.findByRole('button', { name: /modifier mon mot de passe/i })
    await user.click(openBtn)

    await user.type(screen.getByLabelText(/mot de passe actuel/i), 'oldpassword1')
    await user.type(screen.getByLabelText(/^nouveau mot de passe/i), 'newpassword1')
    await user.type(screen.getByLabelText(/confirmer le nouveau mot de passe/i), 'newpassword1')

    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }))

    expect(vi.mocked(AuthApi.changePassword)).toHaveBeenCalled()
    expect(await screen.findByText(/mot de passe mis à jour/i)).toBeInTheDocument()
  })

  it('adds and deletes an address with success toasts', async () => {
    const user = userEvent.setup()
    vi.mocked(AuthApi.listAddresses).mockResolvedValueOnce([] as any).mockResolvedValueOnce([
      { id: 'a1', label: 'Maison', recipientName: 'Jane Doe', line1: '1 rue A', line2: null, city: 'Paris', state: null, postalCode: '75001', country: 'France', phone: null, isDefaultShipping: true, isDefaultBilling: true, created_at: '', updatedAt: '' }
    ] as any).mockResolvedValueOnce([] as any)

    vi.mocked(AuthApi.createAddress).mockResolvedValue({} as any)
    vi.mocked(AuthApi.deleteAddress).mockResolvedValue({ success: true } as any)

    renderAppWithProviders(<App />)

    // Add first address
    const addBtn = await screen.findByRole('button', { name: /ajouter une adresse|ajouter ma première adresse/i })
    await user.click(addBtn)
    const modal = await screen.findByRole('dialog')

    // Fill minimal required fields in modal form
    await user.type(within(modal).getByLabelText(/intitulé/i), 'Maison')
    await user.type(within(modal).getByLabelText(/destinataire/i), 'Jane Doe')
    const addressLine1 = modal.querySelector('#address-line1') as HTMLInputElement
    await user.type(addressLine1, '1 rue A')
    await user.type(within(modal).getByLabelText(/ville/i), 'Paris')
    await user.type(within(modal).getByLabelText(/code postal/i), '75001')
    await user.type(within(modal).getByLabelText(/pays/i), 'France')

    // Submit
    await user.click(within(modal).getByRole('button', { name: /enregistrer|ajouter/i }))

    // Address added toast
    expect(await screen.findByText(/adresse ajoutée|adresse mise à jour/i)).toBeInTheDocument()

    // After list refresh, click delete
    const deleteBtn = await screen.findByRole('button', { name: /^supprimer$/i })
    await user.click(deleteBtn)

    // Deleted toast
    expect(await screen.findByText(/adresse supprimée/i)).toBeInTheDocument()
  })
})
