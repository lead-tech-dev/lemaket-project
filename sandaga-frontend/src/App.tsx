import { AppRouter } from './router/AppRouter'
import { LoadingOverlay } from './components/ui/LoadingOverlay'

export function App() {
  return (
    <>
      <LoadingOverlay />
      <AppRouter />
    </>
  )
}
