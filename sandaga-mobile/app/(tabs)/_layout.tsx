import { Tabs, Redirect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@/core/auth/session-context'
import { colors, spacing, typography } from '@/core/theme/tokens'

export default function TabsLayout() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useSession()
  const insets = useSafeAreaInsets()
  const bottomSafePadding = Math.max(insets.bottom, spacing.md)

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 58 + bottomSafePadding + spacing.sm,
          paddingTop: spacing.xs,
          paddingBottom: bottomSafePadding,
          borderTopColor: colors.borderStrong,
          borderTopWidth: 1,
          backgroundColor: colors.surfaceRaised
        },
        tabBarLabelStyle: {
          fontSize: typography.captionSm,
          marginTop: 1,
          fontWeight: typography.weightSemibold
        },
        tabBarItemStyle: {
          paddingVertical: 2
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Recherche',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.9 }}>
              <Ionicons name={focused ? 'search' : 'search-outline'} color={color} size={22} />
            </View>
          )
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoris',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.9 }}>
              <Ionicons name={focused ? 'heart' : 'heart-outline'} color={color} size={22} />
            </View>
          )
        }}
      />
      <Tabs.Screen
        name="my-listings"
        listeners={{
          tabPress: event => {
            event.preventDefault()
            router.push('/listings/new')
          }
        }}
        options={{
          title: 'Publier',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.9 }}>
              <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} color={color} size={22} />
            </View>
          )
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.9 }}>
              <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} size={22} />
            </View>
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.9 }}>
              <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={22} />
            </View>
          )
        }}
      />
    </Tabs>
  )
}
