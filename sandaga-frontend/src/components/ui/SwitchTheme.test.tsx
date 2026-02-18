import { screen, fireEvent } from '@testing-library/react';
import { SwitchTheme } from './SwitchTheme';
import { renderWithProviders } from '../../test/test-utils';

describe('SwitchTheme', () => {
  it('toggles the theme on click', () => {
    renderWithProviders(<SwitchTheme />);
    const button = screen.getByRole('button', { name: 'Basculer thème' });

    // Initial theme is light
    document.documentElement.setAttribute('data-theme', 'light');

    fireEvent.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fireEvent.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('loads the saved theme from local storage', () => {
    localStorage.setItem('theme', 'dark');
    renderWithProviders(<SwitchTheme />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
