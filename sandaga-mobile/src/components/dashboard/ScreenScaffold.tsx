import type { PropsWithChildren } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

type ScreenScaffoldProps = PropsWithChildren<{
  title: string
  subtitle: string
}>

export function ScreenScaffold({ title, subtitle, children }: ScreenScaffoldProps) {
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + spacing.md
        }
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {children}
    </ScrollView>
  )
}

export const dashboardStyles = StyleSheet.create({
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.body,
    marginBottom: spacing.sm
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.md
  }
})

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md
  },
  header: {
    marginBottom: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: typography.titleLg,
    lineHeight: 34,
    fontWeight: typography.weightBlack
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.bodySm
  }
})
