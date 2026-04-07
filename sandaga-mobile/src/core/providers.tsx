import type { PropsWithChildren } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryProvider } from '@/core/query/query-provider'
import { SessionProvider } from '@/core/auth/session-context'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <SessionProvider>{children}</SessionProvider>
      </QueryProvider>
    </SafeAreaProvider>
  )
}
