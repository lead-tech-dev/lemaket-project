import { screen } from '@testing-library/react'
import Footer from './Footer'
import { renderWithProviders } from '../test/test-utils'

describe('Footer', () => {
  it('renders the footer with all sections and links', () => {
    renderWithProviders(<Footer />, { useRouter: true })

    expect(screen.getAllByText('LEMAKET').length).toBeGreaterThan(0)
    expect(screen.getByText('Informations légales')).toBeInTheDocument()
    expect(screen.getByText('Suivez-nous')).toBeInTheDocument()

    expect(screen.getByText('À propos')).toBeInTheDocument()
    expect(screen.getByText('Conditions générales')).toBeInTheDocument()
    expect(screen.getByText('Facebook')).toBeInTheDocument()

    expect(screen.getByText(/© \d{4} LEMAKET — Tous droits réservés\./)).toBeInTheDocument()
  })
})
