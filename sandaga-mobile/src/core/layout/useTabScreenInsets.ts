import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing } from '@/core/theme/tokens'

export function useTabScreenInsets() {
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()

  return {
    topInset: insets.top + spacing.md,
    bottomInset: tabBarHeight + insets.bottom + spacing.md
  }
}

