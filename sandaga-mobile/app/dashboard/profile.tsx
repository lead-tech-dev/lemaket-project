import { useEffect, useState } from 'react'
import { Alert, StyleSheet, Switch, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { TextInputField } from '@/components/ui/TextInputField'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { useSession } from '@/core/auth/session-context'
import { colors, spacing, typography } from '@/core/theme/tokens'
import { isMobileFeatureEnabled } from '@/core/config/featureFlags'
import { usersApi, type UpdateProfilePayload, type UserMe } from '@/features/users/users.api'

function buildInitialForm(user?: UserMe): UpdateProfilePayload {
  return {
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    bio: user?.bio ?? '',
    location: user?.location ?? '',
    companyName: user?.companyName ?? '',
    companyId: user?.companyId ?? '',
    companyNiu: user?.companyNiu ?? '',
    companyRccm: user?.companyRccm ?? '',
    companyCity: user?.companyCity ?? '',
    businessDescription: user?.businessDescription ?? '',
    businessWebsite: user?.businessWebsite ?? '',
    storefrontSlug: user?.storefrontSlug ?? '',
    storefrontTagline: user?.storefrontTagline ?? '',
    storefrontHeroUrl: user?.storefrontHeroUrl ?? '',
    storefrontTheme: user?.storefrontTheme ?? '',
    storefrontShowReviews: user?.storefrontShowReviews ?? true
  }
}

export default function DashboardProfileScreen() {
  const queryClient = useQueryClient()
  const { refreshMe } = useSession()
  const meQuery = useQuery({
    queryKey: ['users', 'me', 'profile'],
    queryFn: () => usersApi.me()
  })

  const [form, setForm] = useState<UpdateProfilePayload>(buildInitialForm())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (meQuery.data) {
      setForm(buildInitialForm(meQuery.data))
    }
  }, [meQuery.data])

  const proPortalEnabled = isMobileFeatureEnabled('dashboardPro')
  const isPro = Boolean(meQuery.data?.isPro) && proPortalEnabled

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => usersApi.updateProfile(payload),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
      void queryClient.invalidateQueries({ queryKey: ['users', 'me', 'profile'] })
      await refreshMe()
      setError(null)
      Alert.alert('Profil', 'Informations mises à jour.')
    },
    onError: err => setError(err instanceof Error ? err.message : 'Mise à jour impossible')
  })

  const updateField = <K extends keyof UpdateProfilePayload>(key: K, value: UpdateProfilePayload[K]) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const submit = () => {
    if (!form.firstName?.trim() || !form.lastName?.trim()) {
      setError('Le prénom et le nom sont obligatoires.')
      return
    }
    if (form.businessWebsite && !/^https?:\/\//i.test(form.businessWebsite)) {
      setError("L'URL du site doit commencer par http:// ou https://")
      return
    }
    setError(null)
    updateMutation.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phoneNumber: form.phoneNumber?.trim() || undefined,
      bio: form.bio?.trim() || undefined,
      location: form.location?.trim() || undefined,
      companyName: form.companyName?.trim() || undefined,
      companyId: form.companyId?.trim() || undefined,
      companyNiu: form.companyNiu?.trim() || undefined,
      companyRccm: form.companyRccm?.trim() || undefined,
      companyCity: form.companyCity?.trim() || undefined,
      businessDescription: form.businessDescription?.trim() || undefined,
      businessWebsite: form.businessWebsite?.trim() || undefined,
      storefrontSlug: form.storefrontSlug?.trim() || undefined,
      storefrontTagline: form.storefrontTagline?.trim() || undefined,
      storefrontHeroUrl: form.storefrontHeroUrl?.trim() || undefined,
      storefrontTheme: form.storefrontTheme?.trim() || undefined,
      storefrontShowReviews: form.storefrontShowReviews
    })
  }

  return (
    <ScreenScaffold
      title="Profil"
      subtitle={isPro ? 'Mets à jour tes informations personnelles et, si besoin, ta boutique.' : 'Mets à jour tes informations personnelles.'}
    >
      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Informations personnelles</Text>
        <View style={styles.twoCols}>
          <View style={styles.col}>
            <TextInputField label="Prénom *" value={form.firstName ?? ''} onChangeText={value => updateField('firstName', value)} placeholder="Eric" />
          </View>
          <View style={styles.col}>
            <TextInputField label="Nom *" value={form.lastName ?? ''} onChangeText={value => updateField('lastName', value)} placeholder="Maximan" />
          </View>
        </View>
        <TextInputField
          label="Téléphone"
          value={form.phoneNumber ?? ''}
          onChangeText={value => updateField('phoneNumber', value)}
          placeholder="+2376XXXXXXXX"
        />
        <TextInputField
          label="Localisation"
          value={form.location ?? ''}
          onChangeText={value => updateField('location', value)}
          placeholder="Douala, Cameroun"
        />
        <TextInputField label="Bio" value={form.bio ?? ''} onChangeText={value => updateField('bio', value)} placeholder="Présente-toi en quelques lignes" />
      </View>

      {isPro ? (
        <View style={dashboardStyles.sectionCard}>
          <Text style={dashboardStyles.sectionTitle}>Informations entreprise</Text>
          <TextInputField label="Nom de l’entreprise" value={form.companyName ?? ''} onChangeText={value => updateField('companyName', value)} placeholder="LEMAKET SARL" />
          <View style={styles.twoCols}>
            <View style={styles.col}>
              <TextInputField label="ID société" value={form.companyId ?? ''} onChangeText={value => updateField('companyId', value)} placeholder="ID société" />
            </View>
            <View style={styles.col}>
              <TextInputField label="NIU" value={form.companyNiu ?? ''} onChangeText={value => updateField('companyNiu', value)} placeholder="NIU" />
            </View>
          </View>
          <View style={styles.twoCols}>
            <View style={styles.col}>
              <TextInputField label="RCCM" value={form.companyRccm ?? ''} onChangeText={value => updateField('companyRccm', value)} placeholder="RCCM" />
            </View>
            <View style={styles.col}>
              <TextInputField label="Ville" value={form.companyCity ?? ''} onChangeText={value => updateField('companyCity', value)} placeholder="Douala" />
            </View>
          </View>
          <TextInputField
            label="Description activité"
            value={form.businessDescription ?? ''}
            onChangeText={value => updateField('businessDescription', value)}
            placeholder="Décris ton activité"
          />
          <TextInputField
            label="Site web"
            value={form.businessWebsite ?? ''}
            onChangeText={value => updateField('businessWebsite', value)}
            placeholder="https://..."
            autoCapitalize="none"
          />
        </View>
      ) : null}

      {isPro ? (
        <View style={dashboardStyles.sectionCard}>
          <Text style={dashboardStyles.sectionTitle}>Boutique</Text>
          <TextInputField
            label="Slug vitrine"
            value={form.storefrontSlug ?? ''}
            onChangeText={value => updateField('storefrontSlug', value)}
            placeholder="lemaket-store"
            autoCapitalize="none"
          />
          <TextInputField
            label="Tagline"
            value={form.storefrontTagline ?? ''}
            onChangeText={value => updateField('storefrontTagline', value)}
            placeholder="Le meilleur de la marketplace locale"
          />
          <TextInputField
            label="Image hero URL"
            value={form.storefrontHeroUrl ?? ''}
            onChangeText={value => updateField('storefrontHeroUrl', value)}
            placeholder="/uploads/storefront.jpg ou http://localhost:..."
            autoCapitalize="none"
          />
          <TextInputField
            label="Thème"
            value={form.storefrontTheme ?? ''}
            onChangeText={value => updateField('storefrontTheme', value)}
            placeholder="sunrise, cobalt..."
          />
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchTitle}>Afficher les avis sur la boutique</Text>
              <Text style={styles.switchSubtitle}>Permet aux visiteurs de voir les avis client sur ta vitrine.</Text>
            </View>
            <Switch
              value={Boolean(form.storefrontShowReviews)}
              onValueChange={value => updateField('storefrontShowReviews', value)}
            />
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton label="Enregistrer le profil" onPress={submit} loading={updateMutation.isPending} />
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  twoCols: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  col: {
    flex: 1
  },
  switchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  switchTextWrap: {
    flex: 1
  },
  switchTitle: {
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  switchSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.caption
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  }
})
