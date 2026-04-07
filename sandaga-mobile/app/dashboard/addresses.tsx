import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { TextInputField } from '@/components/ui/TextInputField'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'
import { usersApi, type UpsertAddressPayload, type UserAddress } from '@/features/users/users.api'

const EMPTY_FORM: UpsertAddressPayload = {
  label: '',
  recipientName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Cameroun',
  phone: '',
  isDefaultShipping: false,
  isDefaultBilling: false
}

export default function DashboardAddressesScreen() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<UserAddress | null>(null)
  const [form, setForm] = useState<UpsertAddressPayload>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  const addressesQuery = useQuery({
    queryKey: ['users', 'addresses'],
    queryFn: () => usersApi.addresses()
  })

  useEffect(() => {
    if (!editing) {
      setForm(EMPTY_FORM)
    }
  }, [editing])

  const saveMutation = useMutation({
    mutationFn: (payload: UpsertAddressPayload) =>
      editing ? usersApi.updateAddress(editing.id, payload) : usersApi.createAddress(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'addresses'] })
      setEditing(null)
      setForm(EMPTY_FORM)
      setError(null)
    },
    onError: err => setError(err instanceof Error ? err.message : 'Enregistrement impossible')
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => usersApi.removeAddress(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'addresses'] })
      if (editing) {
        setEditing(null)
      }
    },
    onError: err => Alert.alert('Suppression impossible', err instanceof Error ? err.message : 'Réessaie plus tard.')
  })

  const updateField = <K extends keyof UpsertAddressPayload>(key: K, value: UpsertAddressPayload[K]) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const submit = () => {
    if (!form.label?.trim() || !form.recipientName?.trim() || !form.line1?.trim() || !form.city?.trim() || !form.postalCode?.trim() || !form.country?.trim()) {
      setError('Complète tous les champs obligatoires.')
      return
    }
    setError(null)
    saveMutation.mutate({
      ...form,
      label: form.label.trim(),
      recipientName: form.recipientName.trim(),
      line1: form.line1.trim(),
      line2: form.line2?.trim() || undefined,
      city: form.city.trim(),
      state: form.state?.trim() || undefined,
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
      phone: form.phone?.trim() || undefined
    })
  }

  const startEdit = (address: UserAddress) => {
    setEditing(address)
    setForm({
      label: address.label,
      recipientName: address.recipientName,
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state ?? '',
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone ?? '',
      isDefaultShipping: address.isDefaultShipping,
      isDefaultBilling: address.isDefaultBilling
    })
    setError(null)
  }

  const askDelete = (address: UserAddress) => {
    Alert.alert('Supprimer cette adresse ?', `${address.label} sera retirée de ton compte.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeMutation.mutate(address.id) }
    ])
  }

  return (
    <ScreenScaffold title="Mes adresses" subtitle="Gère les adresses de livraison et de facturation de ton compte.">
      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>{editing ? 'Modifier une adresse' : 'Ajouter une adresse'}</Text>
        <TextInputField label="Libellé *" value={form.label} onChangeText={value => updateField('label', value)} placeholder="Maison, Bureau..." />
        <TextInputField
          label="Destinataire *"
          value={form.recipientName}
          onChangeText={value => updateField('recipientName', value)}
          placeholder="Nom du destinataire"
        />
        <TextInputField label="Adresse *" value={form.line1} onChangeText={value => updateField('line1', value)} placeholder="Rue, quartier..." />
        <TextInputField label="Complément" value={form.line2 ?? ''} onChangeText={value => updateField('line2', value)} placeholder="Bâtiment, étage..." />
        <View style={styles.twoCols}>
          <View style={styles.col}>
            <TextInputField label="Ville *" value={form.city} onChangeText={value => updateField('city', value)} placeholder="Douala" />
          </View>
          <View style={styles.col}>
            <TextInputField
              label="Code postal *"
              value={form.postalCode}
              onChangeText={value => updateField('postalCode', value)}
              placeholder="00237"
            />
          </View>
        </View>
        <View style={styles.twoCols}>
          <View style={styles.col}>
            <TextInputField label="Région" value={form.state ?? ''} onChangeText={value => updateField('state', value)} placeholder="Littoral" />
          </View>
          <View style={styles.col}>
            <TextInputField
              label="Pays *"
              value={form.country}
              onChangeText={value => updateField('country', value)}
              placeholder="Cameroun"
            />
          </View>
        </View>
        <TextInputField label="Téléphone" value={form.phone ?? ''} onChangeText={value => updateField('phone', value)} placeholder="+2376XXXXXXXX" />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Par défaut pour la livraison</Text>
          <Switch
            value={Boolean(form.isDefaultShipping)}
            onValueChange={value => updateField('isDefaultShipping', value)}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Par défaut pour la facturation</Text>
          <Switch
            value={Boolean(form.isDefaultBilling)}
            onValueChange={value => updateField('isDefaultBilling', value)}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={editing ? 'Enregistrer les modifications' : 'Ajouter l’adresse'}
          onPress={submit}
          loading={saveMutation.isPending}
        />
        {editing ? (
          <Pressable style={styles.secondaryButton} onPress={() => setEditing(null)}>
            <Text style={styles.secondaryButtonText}>Annuler la modification</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={dashboardStyles.sectionCard}>
        <Text style={dashboardStyles.sectionTitle}>Adresses enregistrées</Text>
        {addressesQuery.isLoading ? <Text style={dashboardStyles.empty}>Chargement...</Text> : null}
        {!addressesQuery.isLoading && (addressesQuery.data?.length ?? 0) === 0 ? (
          <Text style={dashboardStyles.empty}>Aucune adresse enregistrée.</Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsWrap}>
          {addressesQuery.data?.map(address => (
            <View key={address.id} style={styles.addressCard}>
              <View style={styles.addressTop}>
                <Text style={styles.addressLabel}>{address.label}</Text>
                <View style={styles.badges}>
                  {address.isDefaultShipping ? <Badge label="Livraison" /> : null}
                  {address.isDefaultBilling ? <Badge label="Facturation" tone="accent" /> : null}
                </View>
              </View>
              <Text style={styles.addressText}>{address.recipientName}</Text>
              <Text style={styles.addressText}>{address.line1}</Text>
              {address.line2 ? <Text style={styles.addressMuted}>{address.line2}</Text> : null}
              <Text style={styles.addressMuted}>
                {address.city}, {address.postalCode}
              </Text>
              <Text style={styles.addressMuted}>{address.country}</Text>
              {address.phone ? <Text style={styles.addressMuted}>{address.phone}</Text> : null}

              <View style={styles.actionsRow}>
                <Pressable style={styles.actionButton} onPress={() => startEdit(address)}>
                  <Text style={styles.actionButtonText}>Modifier</Text>
                </Pressable>
                <Pressable style={[styles.actionButton, styles.deleteAction]} onPress={() => askDelete(address)}>
                  <Text style={[styles.actionButtonText, styles.deleteActionText]}>Supprimer</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScreenScaffold>
  )
}

function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'accent' }) {
  return (
    <View style={[styles.badge, tone === 'accent' && styles.badgeAccent]}>
      <Text style={[styles.badgeText, tone === 'accent' && styles.badgeTextAccent]}>{label}</Text>
    </View>
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  switchLabel: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption
  },
  secondaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: typography.weightBold
  },
  cardsWrap: {
    gap: spacing.md
  },
  addressCard: {
    width: 280,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.xs
  },
  addressTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  addressLabel: {
    flex: 1,
    color: colors.text,
    fontSize: typography.bodySm,
    fontWeight: typography.weightBold
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.xs
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.primarySoft
  },
  badgeAccent: {
    backgroundColor: colors.accentSoft
  },
  badgeText: {
    color: colors.primary,
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  badgeTextAccent: {
    color: colors.accent
  },
  addressText: {
    color: colors.text,
    fontSize: typography.bodySm
  },
  addressMuted: {
    color: colors.muted,
    fontSize: typography.caption
  },
  actionsRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm
  },
  actionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionButtonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  deleteAction: {
    borderColor: colors.dangerSurfaceStrong,
    backgroundColor: colors.dangerSoft
  },
  deleteActionText: {
    color: colors.danger
  }
})
