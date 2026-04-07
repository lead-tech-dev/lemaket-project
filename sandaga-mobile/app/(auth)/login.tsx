import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'
import { useSession } from '@/core/auth/session-context'
import { TextInputField } from '@/components/ui/TextInputField'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { colors, radius, shadows, spacing, typography } from '@/core/theme/tokens'

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court')
})

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { signIn } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    const parsed = schema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
      return
    }

    setError(null)
    setLoading(true)
    try {
      await signIn(parsed.data)
      router.replace('/(tabs)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible')
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
          <Text style={styles.brandTagline}>Acheter. Vendre. En confiance.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>Accède à ton compte pour publier et gérer tes annonces.</Text>

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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton label="Se connecter" onPress={onSubmit} loading={loading} />

          <Pressable style={styles.forgotLinkWrap} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotLink}>Mot de passe oublié ?</Text>
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Pas encore de compte ?</Text>
            <Pressable onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>S&apos;inscrire</Text>
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
  forgotLinkWrap: {
    alignSelf: 'center',
    marginTop: -2
  },
  forgotLink: {
    color: colors.accent,
    fontWeight: typography.weightBold
  },
  footerText: {
    color: colors.muted
  },
  footerLink: {
    color: colors.primary,
    fontWeight: typography.weightBold
  }
})
