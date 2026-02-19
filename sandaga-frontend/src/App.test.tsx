import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { App } from './App'
import { renderAppWithProviders } from './test/test-utils'

describe('App', () => {
  it('renders the App component', async () => {
    window.history.pushState({}, '', '/')
    renderAppWithProviders(<App />)
    expect(await screen.findByRole('link', { name: /lemaket/i })).toBeInTheDocument()
  })
})
