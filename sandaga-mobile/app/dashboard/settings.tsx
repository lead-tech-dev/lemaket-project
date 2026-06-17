import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { usersApi } from '@/features/users/users.api'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'
import { isMobileFeatureEnabled } from '@/core/config/featureFlags'

function normalizeCameroonMobileNumber(rawValue: string) {
  return rawValue.replace(/[\s().-]/g, '')
}

function isValidCameroonMobileNumber(value: string) {
  const normalized = normalizeCameroonMobileNumber(value)
  return /^(\+237|237)?6\d{8}$/.test(normalized)
}

function toCanonicalCameroonMobileNumber(value: string) {
  const normalized = normalizeCameroonMobileNumber(value)
  if (!normalized) {
    return ''
  }
  if (normalized.startsWith('+237')) {
    return normalized
  }
  if (normalized.startsWith('237')) {
    return `+${normalized}`
  }
  return `+237${normalized}`
}

export default function DashboardSettingsScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const verificationEnabled = isMobileFeatureEnabled('dashboardVerification')
  const courierEnabled = isMobileFeatureEnabled('dashboardCourier')
  const meQuery = useQuery({
    queryKey: ['users', 'me', 'settings'],
    queryFn: () => usersApi.me()
  })

  const settings = meQuery.data?.settings ?? {}
  const [network, setNetwork] = useState<'mtn' | 'orange' | ''>((settings.payoutMobileNetwork as 'mtn' | 'orange') || '')
  const [number, setNumber] = useState(settings.payoutMobileNumber ?? '')
  const [name, setName] = useState(settings.payoutMobileName ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setNetwork((settings.payoutMobileNetwork as 'mtn' | 'orange') || '')
    setNumber(settings.payoutMobileNumber ?? '')
    setName(settings.payoutMobileName ?? '')
  }, [settings.payoutMobileName, settings.payoutMobileNetwork, settings.payoutMobileNumber])

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => usersApi.updateSettings(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', 'me', 'settings'] })
  })

  const twoFactorMutation = useMutation({
    mutationFn: (enable: boolean) => usersApi.updateTwoFactor(enable),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'me', 'settings'] })
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
    }
  })

  const savePayout = () => {
    const normalizedName = name.trim()
    const canonicalNumber = toCanonicalCameroonMobileNumber(number)
    if (!network) {
      setFormError('Sélectionnez un réseau Mobile Money.')
      return
    }
    if (!isValidCameroonMobileNumber(number)) {
      setFormError('Numéro Cameroun invalide. Utilisez 6XXXXXXXX, 2376XXXXXXXX ou +2376XXXXXXXX.')
      return
    }
    if (!/^[\p{L}\s'.-]{2,80}$/u.test(normalizedName)) {
      setFormError('Nom bénéficiaire invalide.')
      return
    }
    setFormError(null)
    updateMutation.mutate({
      payoutMobileNetwork: network,
      payoutMobileNumber: canonicalNumber,
      payoutMobileName: normalizedName
    })
  }

  const notifications = useMemo(
    () => [
      { key: 'tipsNotifications', label: 'Recevoir des conseils', value: Boolean(settings.tipsNotifications) },
      { key: 'favoritePriceAlerts', label: 'Alertes de prix favoris', value: Boolean(settings.favoritePriceAlerts) },
      { key: 'savedSearchAlerts', label: 'Alertes recherches sauvegardées', value: Boolean(settings.savedSearchAlerts) },
      { key: 'moderationAlerts', label: 'Alertes modération', value: Boolean(settings.moderationAlerts) },
      { key: 'systemAlerts', label: 'Notifications système', value: Boolean(settings.systemAlerts) }
    ],
    [
      settings.favoritePriceAlerts,
      settings.moderationAlerts,
      settings.savedSearchAlerts,
      settings.systemAlerts,
      settings.tipsNotifications
    ]
  )

  return (
    <ScreenScaffold title="Paramètres" subtitle="Personnalisez votre compte LEMAKET.">
      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Confidentialité</Text>
        <ToggleRow
          label="Afficher le téléphone uniquement aux contacts approuvés"
          value={Boolean(settings.showPhoneToApprovedOnly)}
          onChange={next => updateMutation.mutate({ showPhoneToApprovedOnly: next })}
        />
        <ToggleRow
          label="Masquer la localisation précise"
          value={Boolean(settings.maskPreciseLocation)}
          onChange={next => updateMutation.mutate({ maskPreciseLocation: next })}
        />
        <ToggleRow
          label="Activer la double authentification"
          value={Boolean(settings.enableTwoFactorAuth)}
          onChange={next => twoFactorMutation.mutate(next)}
        />
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Notifications</Text>
        {notifications.map(item => (
          <ToggleRow key={item.key} label={item.label} value={item.value} onChange={next => updateMutation.mutate({ [item.key]: next })} />
        ))}
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Paiement / retrait (Mobile Money)</Text>
        <View style={styles.segment}>
          <Pressable style={[styles.segmentItem, network === 'mtn' && styles.segmentItemActive]} onPress={() => setNetwork('mtn')}>
            <Text style={[styles.segmentLabel, network === 'mtn' && styles.segmentLabelActive]}>MTN</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentItem, network === 'orange' && styles.segmentItemActive]}
            onPress={() => setNetwork('orange')}
          >
            <Text style={[styles.segmentLabel, network === 'orange' && styles.segmentLabelActive]}>Orange</Text>
          </Pressable>
        </View>

        <TextInput
          value={number}
          onChangeText={setNumber}
          placeholder="Numéro Mobile Money"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nom bénéficiaire"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={savePayout}>
          <Text style={styles.primaryButtonText}>Enregistrer</Text>
        </Pressable>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Compte</Text>
        <ActionRow label="Sécurité du compte" icon="shield-checkmark-outline" onPress={() => router.push('/dashboard/security')} />
        <ActionRow label="Mes adresses" icon="location-outline" onPress={() => router.push('/dashboard/addresses')} />
        {verificationEnabled ? (
          <ActionRow label="Vérifications & documents" icon="document-text-outline" onPress={() => router.push('/dashboard/verification')} />
        ) : null}
        {courierEnabled ? (
          <ActionRow label="Paramètres livreur" icon="bicycle-outline" onPress={() => router.push('/dashboard/courier')} />
        ) : null}
      </View>
    </ScreenScaffold>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  )
}

function ActionRow({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable style={styles.actionRow} onPress={onPress}>
      <View style={styles.actionLeading}>
        <Ionicons name={icon} size={18} color={colors.text} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  toggleRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm
  },
  toggleLabel: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised
  },
  segmentItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  segmentLabel: {
    color: colors.text,
    fontWeight: typography.weightSemibold
  },
  segmentLabelActive: {
    color: colors.primary
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    color: colors.text,
    marginTop: spacing.sm
  },
  primaryButton: {
    marginTop: spacing.sm,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold
  },
  error: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontSize: typography.caption
  },
  actionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm
  },
  actionLeading: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted
  },
  actionLabel: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightSemibold
  }
})
