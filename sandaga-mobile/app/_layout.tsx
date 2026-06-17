import { useEffect } from 'react'
import { Stack, usePathname, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AppProviders } from '@/core/providers'
import { AnimatedLogoSplash } from '@/core/layout/AnimatedLogoSplash'
import { getFeatureFlagFallbackPath } from '@/core/config/featureFlags'

function LaunchRouteGuard() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const fallbackPath = getFeatureFlagFallbackPath(pathname)
    if (fallbackPath && fallbackPath !== pathname) {
      router.replace(fallbackPath)
    }
  }, [pathname, router])

  return null
}

export default function RootLayout() {
  return (
    <AppProviders>
      <AnimatedLogoSplash>
        <StatusBar style="dark" />
        <LaunchRouteGuard />
        <Stack screenOptions={{ headerShown: false }} />
      </AnimatedLogoSplash>
    </AppProviders>
  )
}
