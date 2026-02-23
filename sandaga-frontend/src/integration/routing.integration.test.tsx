import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../contexts/I18nContext'
import { FeatureFlagProvider } from '../contexts/FeatureFlagContext'
import { ToastProvider } from '../components/ui/Toast'
import { App } from '../App'

function renderApp() {
  return render(
    <I18nProvider>
      <FeatureFlagProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </FeatureFlagProvider>
    </I18nProvider>
  )
}

describe('Routing (integration)', () => {
  beforeEach(() => {
    // reset location to home for each test
    window.history.pushState({}, '', '/')
  })

  it('navigates to the login page when clicking the header link', async () => {
    const user = userEvent.setup()
    renderApp()

    const link = await screen.findByRole('link', { name: /se connecter/i })
    await user.click(link)

    // Assert the login page heading appears
    expect(await screen.findByRole('heading', { name: /connexion à votre compte/i })).toBeInTheDocument()

    // Assert the email field is present
    expect(screen.getByLabelText(/adresse e-mail/i)).toBeInTheDocument()
  })

  it('scrolls to top when changing page', async () => {
    const user = userEvent.setup()
    const scrollToMock = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    renderApp()

    const link = await screen.findByRole('link', { name: /se connecter/i })
    scrollToMock.mockClear()
    await user.click(link)

    expect(await screen.findByRole('heading', { name: /connexion à votre compte/i })).toBeInTheDocument()
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' })
  })
})
