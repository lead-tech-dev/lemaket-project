import { Stack, Redirect } from 'expo-router'
import { useSession } from '@/core/auth/session-context'

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useSession()

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
