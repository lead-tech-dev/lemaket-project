import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ToastProvider } from './components/ui/Toast'
import { FeatureFlagProvider } from './contexts/FeatureFlagContext'
import { I18nProvider } from './contexts/I18nContext'
import './assets/scss/main.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <FeatureFlagProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </FeatureFlagProvider>
    </ToastProvider>
  </React.StrictMode>,
)
