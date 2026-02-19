import { screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'
import { renderWithProviders } from '../../test/test-utils'

const ThrowError = () => {
  throw new Error('Test error')
}

describe('ErrorBoundary', () => {
  const originalConsoleError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('catches an error and renders the fallback UI', () => {
    renderWithProviders(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recharger la page' })).toBeInTheDocument()
  })

  it('renders children when there is no error', () => {
    renderWithProviders(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('renders a custom fallback component', () => {
    renderWithProviders(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
  })
})
