import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';

describe('Footer', () => {
  it('renders the footer with all sections and links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    // Check for column titles
    expect(screen.getByText('LEMAKET')).toBeInTheDocument();
    expect(screen.getByText('Informations légales')).toBeInTheDocument();
    expect(screen.getByText('Professionnels')).toBeInTheDocument();
    expect(screen.getByText('Suivez-nous')).toBeInTheDocument();

    // Check for some links
    expect(screen.getByText('À propos')).toBeInTheDocument();
    expect(screen.getByText('Conditions générales')).toBeInTheDocument();
    expect(screen.getByText('Compte Pro')).toBeInTheDocument();
    expect(screen.getByText('Facebook')).toBeInTheDocument();

    // Check for bottom text
    expect(screen.getByText(/© \d{4} LEMAKET — Tous droits réservés./)).toBeInTheDocument();
  });
});
