import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'
import { authApi } from '@/core/auth/auth.api'
import { persistAccessToken } from '@/core/auth/token-storage'
import { useSession } from '@/core/auth/session-context'
import { TextInputField } from '@/components/ui/TextInputField'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'

const schema = z
  .object({
    firstName: z.string().min(2, 'Prénom trop court'),
    lastName: z.string().min(2, 'Nom trop court'),
    email: z.string().email('Email invalide'),
    password: z.string().min(8, 'Mot de passe minimum 8 caractères'),
    confirmPassword: z.string().min(8, 'Confirmation requise')
  })
  .refine(values => values.password === values.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword']
  })

export default function RegisterScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { refreshMe } = useSession()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    const parsed = schema.safeParse({ firstName, lastName, email, password, confirmPassword })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
      return
    }

    setError(null)
    setLoading(true)
    try {
      const response = await authApi.register({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        password: parsed.data.password,
        isPro: false
      })

      await persistAccessToken(response.accessToken)
      await refreshMe()
      router.replace('/(tabs)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible')
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
          <Text style={styles.brandTagline}>Crée ton compte en moins d&apos;une minute</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Inscription</Text>
          <Text style={styles.subtitle}>Rejoins la marketplace locale et commence à publier.</Text>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <TextInputField label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Eric" autoCapitalize="words" />
            </View>
            <View style={styles.rowItem}>
              <TextInputField label="Nom" value={lastName} onChangeText={setLastName} placeholder="Maximan" autoCapitalize="words" />
            </View>
          </View>

          <TextInputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="exemple@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInputField
            label="Mot de passe"
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
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton label="Créer mon compte" onPress={onSubmit} loading={loading} />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Déjà un compte ?</Text>
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Se connecter</Text>
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  rowItem: {
    flex: 1
  },
  error: {
    color: colors.danger,
    fontWeight: typography.weightSemibold
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs
  },
  footerText: {
    color: colors.muted
  },
  footerLink: {
    color: colors.primary,
    fontWeight: typography.weightBold
  }
})
