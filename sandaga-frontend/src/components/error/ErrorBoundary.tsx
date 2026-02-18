import { Component, type ErrorInfo, type ReactNode } from 'react'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'
import { I18nContext, type I18nContextValue } from '../../contexts/I18nContext'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  static contextType = I18nContext

  state: State = {
    hasError: false,
    error: null
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in layout boundary', error, info)
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null })
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    const i18n = this.context as I18nContextValue | undefined
    const translate = i18n?.t
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <EmptyState
          icon="🛠️"
          title={translate ? translate('errors.unexpectedTitle') : 'Something went wrong'}
          description={
            this.state.error?.message ??
            translate?.('errors.unexpected') ??
            'We ran into an unexpected issue. Please try again in a moment.'
          }
          action={
            <Button onClick={this.handleReload}>
              {translate ? translate('actions.reload') : 'Reload page'}
            </Button>
          }
        />
      )
    }

    return this.props.children
  }
}
