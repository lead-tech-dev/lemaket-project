import { Link } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '@/core/theme/tokens'

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Page introuvable</Text>
      <Link href="/" style={styles.link}>
        Retour à l&apos;accueil
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background
  },
  title: {
    fontSize: typography.titleSm,
    fontWeight: typography.weightBold,
    color: colors.text
  },
  link: {
    color: colors.primary,
    fontWeight: typography.weightBold
  }
})
