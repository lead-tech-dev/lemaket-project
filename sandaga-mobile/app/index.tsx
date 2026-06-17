import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useSession } from '@/core/auth/session-context'

export default function Index() {
  const { isLoading, isAuthenticated } = useSession()

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/(auth)/login" />
}
