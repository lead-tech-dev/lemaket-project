import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  Linking
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScreenScaffold, dashboardStyles } from '@/components/dashboard/ScreenScaffold'
import { usersApi, type IdentityDocumentRecord, type IdentityDocumentType } from '@/features/users/users.api'
import { colors, radius, spacing, typography } from '@/core/theme/tokens'

type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected'

const IDENTITY_DOCUMENTS: { type: IdentityDocumentType; label: string; helper?: string }[] = [
  { type: 'id_card_front', label: 'Carte ID (recto)' },
  { type: 'id_card_back', label: 'Carte ID (verso)' },
  { type: 'passport', label: 'Passeport' },
  { type: 'driver_license', label: 'Permis de conduire' },
  { type: 'selfie', label: 'Selfie avec document' }
]

function formatStatus(status?: VerificationStatus) {
  switch (status) {
    case 'approved':
      return 'Vérifié'
    case 'pending':
      return 'En revue'
    case 'rejected':
      return 'Refusé'
    default:
      return 'Non vérifié'
  }
}

function statusTheme(status?: VerificationStatus) {
  switch (status) {
    case 'approved':
      return { bg: colors.successSoft, border: colors.primarySoftStrong, text: colors.success }
    case 'pending':
      return { bg: colors.warningSoft, border: colors.accentOutline, text: colors.warning }
    case 'rejected':
      return { bg: colors.dangerSurface, border: colors.dangerSurfaceStrong, text: colors.danger }
    default:
      return { bg: colors.surfaceMuted, border: colors.border, text: colors.muted }
  }
}

type UploadableFile = {
  uri: string
  name: string
  type: string
}

async function pickImageFromLibrary(): Promise<UploadableFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Permission refusée pour accéder à la galerie.')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85
  })

  if (result.canceled || !result.assets?.[0]) {
    return null
  }

  const asset = result.assets[0]
  return {
    uri: asset.uri,
    name: asset.fileName || `document-${Date.now()}.jpg`,
    type: asset.mimeType || 'image/jpeg'
  }
}

async function pickImageFromCamera(): Promise<UploadableFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Permission refusée pour accéder à la caméra.')
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85
  })

  if (result.canceled || !result.assets?.[0]) {
    return null
  }

  const asset = result.assets[0]
  return {
    uri: asset.uri,
    name: asset.fileName || `document-${Date.now()}.jpg`,
    type: asset.mimeType || 'image/jpeg'
  }
}

async function pickPdfDocument(): Promise<UploadableFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf']
  })

  if (result.canceled || !result.assets?.[0]) {
    return null
  }

  const asset = result.assets[0]
  return {
    uri: asset.uri,
    name: asset.name || `document-${Date.now()}.pdf`,
    type: asset.mimeType || 'application/pdf'
  }
}

async function chooseDocumentSource(): Promise<UploadableFile | null> {
  return new Promise(resolve => {
    Alert.alert('Ajouter un document', 'Choisissez la source', [
      {
        text: 'Caméra',
        onPress: () => {
          void pickImageFromCamera()
            .then(resolve)
            .catch(error => {
              Alert.alert('Caméra', error instanceof Error ? error.message : 'Impossible d’ouvrir la caméra.')
              resolve(null)
            })
        }
      },
      {
        text: 'Galerie',
        onPress: () => {
          void pickImageFromLibrary()
            .then(resolve)
            .catch(error => {
              Alert.alert('Galerie', error instanceof Error ? error.message : 'Impossible d’ouvrir la galerie.')
              resolve(null)
            })
        }
      },
      {
        text: 'PDF',
        onPress: () => {
          void pickPdfDocument()
            .then(resolve)
            .catch(error => {
              Alert.alert('Document', error instanceof Error ? error.message : 'Impossible d’ouvrir le document.')
              resolve(null)
            })
        }
      },
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) }
    ])
  })
}

export default function VerificationScreen() {
  const queryClient = useQueryClient()
  const [uploadingType, setUploadingType] = useState<IdentityDocumentType | 'company' | 'courier' | null>(null)

  const meQuery = useQuery({
    queryKey: ['users', 'me', 'verification'],
    queryFn: () => usersApi.me()
  })

  const identityDocs = useMemo(() => meQuery.data?.identityDocuments ?? [], [meQuery.data?.identityDocuments])
  const identityStatus = (meQuery.data?.identityVerificationStatus ?? 'unverified') as VerificationStatus
  const companyStatus = (meQuery.data?.companyVerificationStatus ?? 'unverified') as VerificationStatus
  const courierStatus = (meQuery.data?.courierVerificationStatus ?? 'unverified') as VerificationStatus

  const identityDocsMap = useMemo(() => {
    const map = new Map<IdentityDocumentType, IdentityDocumentRecord>()
    identityDocs.forEach(doc => {
      map.set(doc.type, doc)
    })
    return map
  }, [identityDocs])

  const uploadIdentityMutation = useMutation({
    mutationFn: async (payload: { type: IdentityDocumentType }) => {
      const file = await chooseDocumentSource()
      if (!file) return null
      return usersApi.uploadIdentityDocument({ type: payload.type, file })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'verification'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
    }
  })

  const removeIdentityMutation = useMutation({
    mutationFn: (documentId: string) => usersApi.removeIdentityDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'verification'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
    }
  })

  const uploadCompanyMutation = useMutation({
    mutationFn: async () => {
      const file = await chooseDocumentSource()
      if (!file) return null
      return usersApi.uploadCompanyDocument(file)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'verification'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
    }
  })

  const uploadCourierMutation = useMutation({
    mutationFn: async () => {
      const file = await chooseDocumentSource()
      if (!file) return null
      return usersApi.uploadCourierDocument(file)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'verification'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] })
    }
  })

  const handleIdentityUpload = async (type: IdentityDocumentType) => {
    try {
      setUploadingType(type)
      await uploadIdentityMutation.mutateAsync({ type })
    } catch (error) {
      Alert.alert('Document', error instanceof Error ? error.message : 'Impossible d’envoyer le document.')
    } finally {
      setUploadingType(null)
    }
  }

  const handleCompanyUpload = async () => {
    try {
      setUploadingType('company')
      await uploadCompanyMutation.mutateAsync()
    } catch (error) {
      Alert.alert('Document entreprise', error instanceof Error ? error.message : 'Impossible d’envoyer le document.')
    } finally {
      setUploadingType(null)
    }
  }

  const handleCourierUpload = async () => {
    try {
      setUploadingType('courier')
      await uploadCourierMutation.mutateAsync()
    } catch (error) {
      Alert.alert('Document livreur', error instanceof Error ? error.message : 'Impossible d’envoyer le document.')
    } finally {
      setUploadingType(null)
    }
  }

  return (
    <ScreenScaffold title="Vérifications" subtitle="Envoyez vos documents pour sécuriser votre compte.">
      <View style={dashboardStyles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={dashboardStyles.sectionTitle}>Identité</Text>
          <StatusPill status={identityStatus} />
        </View>
        {meQuery.data?.identityReviewNotes ? (
          <Text style={styles.reviewNotes}>{meQuery.data.identityReviewNotes}</Text>
        ) : null}

        <View style={styles.list}>
          {IDENTITY_DOCUMENTS.map(doc => {
            const existing = identityDocsMap.get(doc.type)
            const docStatus = existing?.status ?? 'pending'
            const isUploading = uploadingType === doc.type
            return (
              <View key={doc.type} style={styles.row}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{doc.label}</Text>
                  <Text style={styles.rowSubtitle}>
                    {existing ? `Document ${docStatus === 'approved' ? 'validé' : docStatus === 'rejected' ? 'refusé' : 'en revue'}` : 'Aucun document'}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  {existing?.url ? (
                    <Pressable style={styles.linkButton} onPress={() => Linking.openURL(existing.url)}>
                      <Text style={styles.linkButtonText}>Voir</Text>
                    </Pressable>
                  ) : null}
                  {existing?.id ? (
                    <Pressable
                      style={styles.ghostButton}
                      onPress={() =>
                        Alert.alert('Supprimer', 'Supprimer ce document ?', [
                          { text: 'Annuler', style: 'cancel' },
                          { text: 'Supprimer', style: 'destructive', onPress: () => removeIdentityMutation.mutate(existing.id) }
                        ])
                      }
                    >
                      <Text style={styles.ghostButtonText}>Retirer</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => handleIdentityUpload(doc.type)}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>{existing ? 'Remplacer' : 'Ajouter'}</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )
          })}
        </View>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={dashboardStyles.sectionTitle}>Entreprise</Text>
          <StatusPill status={companyStatus} />
        </View>
        {meQuery.data?.companyVerificationReviewNotes ? (
          <Text style={styles.reviewNotes}>{meQuery.data.companyVerificationReviewNotes}</Text>
        ) : null}
        {!meQuery.data?.isPro ? (
          <Text style={styles.helperText}>Cette section sera activée dans une prochaine version.</Text>
        ) : null}
        <Pressable
          style={[styles.uploadCard, !meQuery.data?.isPro && styles.uploadCardDisabled]}
          onPress={meQuery.data?.isPro ? handleCompanyUpload : undefined}
        >
          <View style={styles.uploadIcon}>
            {uploadingType === 'company' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="document-text-outline" size={20} color={colors.accent} />
            )}
          </View>
          <View style={styles.uploadContent}>
            <Text style={styles.uploadTitle}>Justificatif d’entreprise</Text>
            <Text style={styles.uploadSubtitle}>
              {meQuery.data?.companyVerificationDocumentUrl ? 'Document reçu' : 'Télécharger un document officiel'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <View style={dashboardStyles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={dashboardStyles.sectionTitle}>Livreur</Text>
          <StatusPill status={courierStatus} />
        </View>
        {meQuery.data?.courierVerificationReviewNotes ? (
          <Text style={styles.reviewNotes}>{meQuery.data.courierVerificationReviewNotes}</Text>
        ) : null}
        {!meQuery.data?.settings?.isCourier ? (
          <Text style={styles.helperText}>Activez le mode livreur pour déposer un justificatif.</Text>
        ) : null}
        <Pressable
          style={[styles.uploadCard, !meQuery.data?.settings?.isCourier && styles.uploadCardDisabled]}
          onPress={meQuery.data?.settings?.isCourier ? handleCourierUpload : undefined}
        >
          <View style={styles.uploadIcon}>
            {uploadingType === 'courier' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="id-card-outline" size={20} color={colors.accent} />
            )}
          </View>
          <View style={styles.uploadContent}>
            <Text style={styles.uploadTitle}>Justificatif livreur</Text>
            <Text style={styles.uploadSubtitle}>
              {meQuery.data?.courierVerificationDocumentUrl ? 'Document reçu' : 'Télécharger un document officiel'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </View>
    </ScreenScaffold>
  )
}

function StatusPill({ status }: { status: VerificationStatus }) {
  const theme = statusTheme(status)
  return (
    <View style={[styles.statusPill, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <Text style={[styles.statusPillText, { color: theme.text }]}>{formatStatus(status)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  statusPillText: {
    fontSize: typography.captionSm,
    fontWeight: typography.weightBold
  },
  reviewNotes: {
    color: colors.danger,
    fontSize: typography.caption,
    marginBottom: spacing.sm
  },
  list: {
    gap: spacing.sm
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    gap: spacing.sm
  },
  rowContent: {
    gap: 2
  },
  rowTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: typography.caption
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap'
  },
  primaryButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.caption,
    fontWeight: typography.weightBold
  },
  ghostButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  ghostButtonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  linkButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentOutline,
    backgroundColor: colors.surface
  },
  linkButtonText: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: typography.weightSemibold
  },
  helperText: {
    color: colors.muted,
    fontSize: typography.caption,
    marginBottom: spacing.sm
  },
  uploadCard: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  uploadCardDisabled: {
    opacity: 0.6
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  uploadContent: {
    flex: 1,
    gap: 2
  },
  uploadTitle: {
    color: colors.text,
    fontWeight: typography.weightBold,
    fontSize: typography.bodySm
  },
  uploadSubtitle: {
    color: colors.muted,
    fontSize: typography.caption
  }
})
