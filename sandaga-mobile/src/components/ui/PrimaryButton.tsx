import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { colors, controls, radius, spacing, typography } from '@/core/theme/tokens'

type PrimaryButtonProps = {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}

export function PrimaryButton({ label, onPress, disabled, loading }: PrimaryButtonProps) {
  const blocked = Boolean(disabled || loading)
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.button,
        blocked && styles.buttonDisabled,
        pressed && !blocked && styles.buttonPressed
      ]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: controls.height + 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark
  },
  label: {
    color: colors.white,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  }
})
