import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleSwitcher } from './LocaleSwitcher';
import { useI18n } from '../../contexts/I18nContext';

const mockSetLocale = vi.fn();

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ locale: 'fr', setLocale: mockSetLocale, t: (key: string) => key }),
}));

describe('LocaleSwitcher', () => {
  it('renders the select with the current locale', () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole('button', { name: 'locale.switcherLabel' })).toHaveTextContent('FR');
  });

  it('calls setLocale when a new locale is selected', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'locale.switcherLabel' }));
    fireEvent.click(screen.getByRole('option', { name: 'EN' }));
    expect(mockSetLocale).toHaveBeenCalledWith('en');
  });
});
