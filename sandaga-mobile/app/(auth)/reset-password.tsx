import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'
import { authApi } from '@/core/auth/auth.api'
import { TextInputField } from '@/components/ui/TextInputField'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'

const schema = z
  .object({
    token: z.string().min(8, 'Token invalide'),
    password: z.string().min(8, 'Mot de passe minimum 8 caractères'),
    confirmPassword: z.string().min(8, 'Confirmation requise')
  })
  .refine(values => values.password === values.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword']
  })

export default function ResetPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ token?: string | string[] }>()
  const initialToken = Array.isArray(params.token) ? params.token[0] ?? '' : params.token ?? ''
  const [token, setToken] = useState(initialToken)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    const parsed = schema.safeParse({ token, password, confirmPassword })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
      return
    }

    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      await authApi.resetPassword({ token: parsed.data.token.trim(), password: parsed.data.password })
      setSuccess('Mot de passe réinitialisé. Tu peux maintenant te connecter.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réinitialisation impossible')
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
          <Text style={styles.brandTagline}>Définis un nouveau mot de passe</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Réinitialiser le mot de passe</Text>
          <Text style={styles.subtitle}>Colle le token reçu puis choisis un nouveau mot de passe.</Text>

          <TextInputField label="Token" value={token} onChangeText={setToken} placeholder="Token de réinitialisation" autoCapitalize="none" />
          <TextInputField
            label="Nouveau mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInputField
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            error={error ?? undefined}
          />

          {success ? <Text style={styles.success}>{success}</Text> : null}

          <PrimaryButton label="Valider" onPress={onSubmit} loading={loading} />

          <View style={styles.footerRow}>
            <Pressable onPress={() => router.replace('/(auth)/login')}>
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
    justifyContent: 'center'
  },
  footerLink: {
    color: colors.accent,
    fontWeight: typography.weightBold
  }
})
