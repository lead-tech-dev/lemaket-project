import { screen, fireEvent } from '@testing-library/react';
import { SwitchTheme } from './SwitchTheme';
import { renderWithProviders } from '../../test/test-utils';

describe('SwitchTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme-id');
  });

  it('cycles through the three themes on click', () => {
    renderWithProviders(<SwitchTheme />);
    const button = screen.getByRole('button', { name: 'Basculer thème' });

    // Thème par défaut : terroir (clair)
    expect(document.documentElement.getAttribute('data-theme-id')).toBe('terroir');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(button); // → indigo (clair)
    expect(document.documentElement.getAttribute('data-theme-id')).toBe('indigo');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(button); // → nuit (sombre)
    expect(document.documentElement.getAttribute('data-theme-id')).toBe('nuit');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fireEvent.click(button); // → retour terroir
    expect(document.documentElement.getAttribute('data-theme-id')).toBe('terroir');
  });

  it('loads the saved theme from local storage', () => {
    localStorage.setItem('theme', 'nuit');
    renderWithProviders(<SwitchTheme />);
    expect(document.documentElement.getAttribute('data-theme-id')).toBe('nuit');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('migrates the legacy "dark" value to the nuit theme', () => {
    localStorage.setItem('theme', 'dark');
    renderWithProviders(<SwitchTheme />);
    expect(document.documentElement.getAttribute('data-theme-id')).toBe('nuit');
  });
});
