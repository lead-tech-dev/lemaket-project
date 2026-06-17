import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'
import { authApi } from '@/core/auth/auth.api'
import { TextInputField } from '@/components/ui/TextInputField'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'

const schema = z.object({
  email: z.string().email('Email invalide')
})

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    const parsed = schema.safeParse({ email })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
      return
    }

    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const response = await authApi.forgotPassword(parsed.data)
      setSuccess(response.message || 'Si le compte existe, les instructions ont été envoyées.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>LEMAKET</Text>
          <Text style={styles.brandTagline}>Récupère l’accès à ton compte</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Mot de passe oublié</Text>
          <Text style={styles.subtitle}>Entre ton email pour recevoir les instructions de réinitialisation.</Text>

          <TextInputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="exemple@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            error={error ?? undefined}
          />

          {success ? <Text style={styles.success}>{success}</Text> : null}

          <PrimaryButton label="Envoyer les instructions" onPress={onSubmit} loading={loading} />

          <View style={styles.footerRow}>
            <Pressable onPress={() => router.push('/(auth)/reset-password')}>
              <Text style={styles.footerLink}>J’ai déjà un token</Text>
            </Pressable>
            <Text style={styles.dot}>•</Text>
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Retour connexion</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg
  },
  brandBlock: {
    alignItems: 'center',
    gap: spacing.xs
  },
  brand: {
    color: colors.primary,
    fontSize: typography.titleLg,
    fontWeight: typography.weightBlack
  },
  brandTagline: {
    color: colors.muted,
    fontSize: typography.bodySm
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.soft
  },
  title: {
    fontSize: typography.title,
    fontWeight: typography.weightExtrabold,
    color: colors.text
  },
  subtitle: {
    color: colors.muted,
    marginTop: -4,
    marginBottom: 4,
    fontSize: typography.bodySm
  },
  success: {
    color: colors.success,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  footerLink: {
    color: colors.accent,
    fontWeight: typography.weightBold
  },
  dot: {
    color: colors.muted
  }
})
