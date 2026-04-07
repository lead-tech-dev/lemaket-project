import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { TextInputField } from '@/components/ui/TextInputField'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { useSession } from '@/core/auth/session-context'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'
import { usersApi } from '@/features/users/users.api'

export default function DashboardSecurityScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { signOut } = useSession()
  const meQuery = useQuery({
    queryKey: ['users', 'me', 'security'],
    queryFn: () => usersApi.me()
  })

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deactivationReason, setDeactivationReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const changePasswordMutation = useMutation({
    mutationFn: () => usersApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError(null)
      Alert.alert('Sécurité', 'Mot de passe mis à jour.')
    },
    onError: err => setError(err instanceof Error ? err.message : 'Modification impossible')
  })

  const twoFactorMutation = useMutation({
    mutationFn: (enable: boolean) => usersApi.updateTwoFactor(enable),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
      void queryClient.invalidateQueries({ queryKey: ['users', 'me', 'security'] })
      void queryClient.invalidateQueries({ queryKey: ['users', 'me', 'settings'] })
    }
  })

  const deactivateMutation = useMutation({
    mutationFn: () => usersApi.deactivate(deactivationReason.trim() || undefined),
    onSuccess: async () => {
      await signOut()
      router.replace('/(auth)/login')
    },
    onError: err => Alert.alert('Suppression impossible', err instanceof Error ? err.message : 'Réessaie plus tard.')
  })

  const submitChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Tous les champs sont obligatoires.')
      return
    }
    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setError(null)
    changePasswordMutation.mutate()
  }

  const confirmDeactivation = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action désactive ton compte mobile. Veux-tu continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', style: 'destructive', onPress: () => deactivateMutation.mutate() }
      ]
    )
  }

  const twoFactorEnabled = Boolean(meQuery.data?.settings?.enableTwoFactorAuth)

  return (
    <ScreenScaffold title="Sécurité" subtitle="Protège l’accès à ton compte et gère les actions sensibles.">
      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Mot de passe</Text>
        <TextInputField
          label="Mot de passe actuel"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInputField
          label="Nouveau mot de passe"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInputField
          label="Confirmer le nouveau mot de passe"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          error={error ?? undefined}
        />
        <PrimaryButton label="Mettre à jour" onPress={submitChangePassword} loading={changePasswordMutation.isPending} />
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Authentification renforcée</Text>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Double authentification</Text>
            <Text style={styles.rowSubtitle}>Ajoute une validation supplémentaire sur ton compte.</Text>
          </View>
          <Pressable
            style={[styles.badgeToggle, twoFactorEnabled && styles.badgeToggleActive]}
            onPress={() => twoFactorMutation.mutate(!twoFactorEnabled)}
          >
            <Text style={[styles.badgeToggleText, twoFactorEnabled && styles.badgeToggleTextActive]}>
              {twoFactorEnabled ? 'Activée' : 'Inactive'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[dashboardStyles.sectionCard, styles.dangerCard]}>
        <Text style={styles.dangerTitle}>Zone sensible</Text>
        <Text style={styles.dangerText}>
          Si tu veux quitter LEMAKET, tu peux désactiver ton compte. Tu seras déconnecté immédiatement.
        </Text>
        <TextInput
          value={deactivationReason}
          onChangeText={setDeactivationReason}
          placeholder="Raison optionnelle"
          placeholderTextColor={colors.placeholder}
          multiline
          style={styles.textarea}
        />
        <Pressable style={styles.dangerButton} onPress={confirmDeactivation}>
          <Text style={styles.dangerButtonText}>Désactiver mon compte</Text>
        </Pressable>
      </View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  flex: {
    flex: 1
  },
  rowTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  rowSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  badgeToggle: {
    minWidth: 84,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeToggleActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface
  },
  badgeToggleText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  badgeToggleTextActive: {
    color: colors.accent
  },
  dangerCard: {
    borderColor: colors.dangerSurfaceStrong,
    backgroundColor: colors.dangerSurface
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold,
    marginBottom: spacing.xs
  },
  dangerText: {
    color: colors.text,
    fontSize: typography.bodyXs,
    marginBottom: spacing.sm
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.dangerSurfaceStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm
  },
  dangerButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dangerButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold
  }
})
