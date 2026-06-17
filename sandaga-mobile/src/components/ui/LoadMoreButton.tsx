import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

type LoadMoreButtonProps = {
  onPress: () => void
  label?: string
  disabled?: boolean
}

export function LoadMoreButton({ onPress, label = 'Charger plus', disabled = false }: LoadMoreButtonProps) {
  return (
    <Pressable style={({ pressed }) => [styles.button, pressed && !disabled && styles.buttonPressed, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm
  },
  buttonPressed: {
    opacity: 0.85
  },
  buttonDisabled: {
    opacity: 0.6
  },
  label: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  }
})
