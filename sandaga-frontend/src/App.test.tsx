import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react';
import { I18nProvider } from './contexts/I18nContext'
import { ToastProvider } from './components/ui/Toast'
import { FeatureFlagProvider } from './contexts/FeatureFlagContext'
import { App } from './App';

describe('App', () => {
  it('renders the App component', () => {
    render(
      <I18nProvider>
        <FeatureFlagProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </FeatureFlagProvider>
      </I18nProvider>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
