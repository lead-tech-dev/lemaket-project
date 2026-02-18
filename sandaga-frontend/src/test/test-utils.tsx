import React, { PropsWithChildren } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom'
import { I18nProvider } from '../contexts/I18nContext'
import { FeatureFlagProvider } from '../contexts/FeatureFlagContext'
import { ToastProvider } from '../components/ui/Toast'

export type RenderOptions = {
  router?: MemoryRouterProps
  useRouter?: boolean
}

function Providers({ children, router, useRouter = false }: PropsWithChildren<{ router?: MemoryRouterProps; useRouter?: boolean }>) {
  const routerProps: MemoryRouterProps = router ?? { initialEntries: ['/'] }
  const content = useRouter ? (
    <MemoryRouter {...routerProps}>{children}</MemoryRouter>
  ) : (
    <>{children}</>
  )
  return (
    <I18nProvider>
      <FeatureFlagProvider>
        <ToastProvider>
          {content}
        </ToastProvider>
      </FeatureFlagProvider>
    </I18nProvider>
  )
}

export function renderWithProviders(ui: React.ReactElement, options?: RenderOptions) {
  return render(<Providers router={options?.router} useRouter={options?.useRouter ?? false}>{ui}</Providers>)
}

export function renderAppWithProviders(ui: React.ReactElement) {
  // For App-level rendering, avoid MemoryRouter to prevent double routers since App uses BrowserRouter internally
  return render(<Providers useRouter={false}>{ui}</Providers>)
}
