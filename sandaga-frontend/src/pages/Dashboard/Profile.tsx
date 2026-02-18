import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { apiGet } from '../../utils/api'
import {
  type UpdateProfilePayload,
  type UserAccount,
  type IdentityDocument,
  type IdentityVerificationStatus,
  type IdentityDocumentType,
  type CompanyVerificationStatus,
  type PreferredContactChannel,
  uploadIdentityDocument,
  uploadCompanyVerificationDocument,
  removeIdentityDocument,
  updateProfile
} from '../../utils/auth'
import { resolveMediaUrl, uploadMedia } from '../../utils/media'
import { useToast } from '../../components/ui/Toast'
import { useAuth, invalidateAuthCache } from '../../hooks/useAuth'
import { useI18n } from '../../contexts/I18nContext'
import { buildProPlanOptions } from '../../constants/proPlans'

const EMPTY_FORM: UpdateProfilePayload & { email: string } = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  avatarUrl: '',
  bio: '',
  location: '',
  companyName: '',
  companyId: '',
  companyNiu: '',
  companyRccm: '',
  companyCity: '',
  businessDescription: '',
  businessWebsite: '',
  storefrontSlug: '',
  storefrontTagline: '',
  storefrontHeroUrl: '',
  storefrontTheme: 'classic',
  storefrontShowReviews: true,
  email: ''
}

const DEFAULT_CONTACT_CHANNELS: PreferredContactChannel[] = ['email', 'in_app']

function resolvePreferredChannels(
  settings: Record<string, unknown>,
  allowWhatsapp: boolean
): PreferredContactChannel[] {
  const raw = settings.preferredContactChannels
  if (!Array.isArray(raw)) {
    return DEFAULT_CONTACT_CHANNELS
  }

  const normalized = Array.from(
    new Set(
      raw
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.toLowerCase())
        .filter((item): item is PreferredContactChannel =>
          ['email', 'sms', 'phone', 'whatsapp', 'in_app'].includes(item)
        )
        .filter(item => allowWhatsapp || item !== 'whatsapp')
    )
  ) as PreferredContactChannel[]

  if (!normalized.length) {
    return DEFAULT_CONTACT_CHANNELS
  }

  if (!normalized.includes('in_app')) {
    normalized.push('in_app')
  }

  return normalized
}

export default function Profile(){
  const navigate = useNavigate()
  const { user } = useAuth()
  const isPro = Boolean(user?.isPro)
  const { addToast } = useToast()
  const { locale, t } = useI18n()
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const [form, setForm] = useState(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactPreferences, setContactPreferences] = useState({
    emailAlerts: true,
    importantSmsNotifications: false,
    preferredContactChannels: [...DEFAULT_CONTACT_CHANNELS]
  })
  const [identityStatus, setIdentityStatus] = useState<IdentityVerificationStatus>('unverified')
  const [identityDocuments, setIdentityDocuments] = useState<IdentityDocument[]>([])
  const [identitySubmittedAt, setIdentitySubmittedAt] = useState<string | null>(null)
  const [identityReviewNotes, setIdentityReviewNotes] = useState<string | null>(null)
  const [companyVerificationStatus, setCompanyVerificationStatus] =
    useState<CompanyVerificationStatus>('unverified')
  const [companyVerificationDocumentUrl, setCompanyVerificationDocumentUrl] =
    useState<string | null>(null)
  const [companyVerificationSubmittedAt, setCompanyVerificationSubmittedAt] =
    useState<string | null>(null)
  const [companyVerificationReviewNotes, setCompanyVerificationReviewNotes] =
    useState<string | null>(null)
  const [selectedDocumentType, setSelectedDocumentType] = useState<IdentityDocumentType>('id_card_front')
  const [documentDescription, setDocumentDescription] = useState('')
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [uploadingCompanyDocument, setUploadingCompanyDocument] = useState(false)
  const [uploadingStorefrontAvatar, setUploadingStorefrontAvatar] = useState(false)
  const [uploadingStorefrontHero, setUploadingStorefrontHero] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [removingDocumentId, setRemovingDocumentId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const companyDocInputRef = useRef<HTMLInputElement | null>(null)
  const storefrontAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const storefrontHeroInputRef = useRef<HTMLInputElement | null>(null)

  const idDocumentOptions = useMemo(
    () => [
      { value: 'id_card_front', label: t('dashboard.profile.documents.types.idCardFront') },
      { value: 'id_card_back', label: t('dashboard.profile.documents.types.idCardBack') },
      { value: 'passport', label: t('dashboard.profile.documents.types.passport') },
      { value: 'driver_license', label: t('dashboard.profile.documents.types.driverLicense') },
      { value: 'selfie', label: t('dashboard.profile.documents.types.selfie') },
      { value: 'business_registration', label: t('dashboard.profile.documents.types.businessRegistration') }
    ],
    [t]
  )

  const storefrontThemeOptions = useMemo(
    () => [
      { value: 'classic', label: t('dashboard.profile.storefront.theme.classic') },
      { value: 'modern', label: t('dashboard.profile.storefront.theme.modern') },
      { value: 'artisan', label: t('dashboard.profile.storefront.theme.artisan') }
    ],
    [t]
  )

  const contactChannelLabels = useMemo(
    () => ({
      email: t('dashboard.profile.contactChannels.email'),
      sms: t('dashboard.profile.contactChannels.sms'),
      phone: t('dashboard.profile.contactChannels.phone'),
      whatsapp: t('dashboard.profile.contactChannels.whatsapp'),
      in_app: t('dashboard.profile.contactChannels.inApp')
    }),
    [t]
  )

  const documentStatusMeta = useMemo(
    () => ({
      pending: {
        label: t('dashboard.profile.documents.status.pending'),
        variant: 'info' as const
      },
      approved: {
        label: t('dashboard.profile.documents.status.approved'),
        variant: 'success' as const
      },
      rejected: {
        label: t('dashboard.profile.documents.status.rejected'),
        variant: 'danger' as const
      }
    }),
    [t]
  )

  const identityStatusMeta = useMemo(
    () => ({
      unverified: {
        label: t('dashboard.profile.identity.status.unverified'),
        description: t('dashboard.profile.identity.unverifiedDescription'),
        variant: 'muted' as const
      },
      pending: {
        label: t('dashboard.profile.identity.status.pending'),
        description: t('dashboard.profile.identity.pendingDescription'),
        variant: 'info' as const
      },
      approved: {
        label: t('dashboard.profile.identity.status.approved'),
        description: t('dashboard.profile.identity.approvedDescription'),
        variant: 'success' as const
      },
      rejected: {
        label: t('dashboard.profile.identity.status.rejected'),
        description: t('dashboard.profile.identity.rejectedDescription'),
        variant: 'danger' as const
      }
    }),
    [t]
  )

  const companyStatusMeta = useMemo(
    () => ({
      unverified: {
        label: t('dashboard.profile.company.status.unverified'),
        description: t('dashboard.profile.company.unverifiedDescription'),
        variant: 'muted' as const
      },
      pending: {
        label: t('dashboard.profile.company.status.pending'),
        description: t('dashboard.profile.company.pendingDescription'),
        variant: 'info' as const
      },
      approved: {
        label: t('dashboard.profile.company.status.approved'),
        description: t('dashboard.profile.company.approvedDescription'),
        variant: 'success' as const
      },
      rejected: {
        label: t('dashboard.profile.company.status.rejected'),
        description: t('dashboard.profile.company.rejectedDescription'),
        variant: 'danger' as const
      }
    }),
    [t]
  )

  const getDocumentLabel = useCallback(
    (type: IdentityDocumentType) => {
      const option = idDocumentOptions.find(item => item.value === type)
      return option?.label ?? type
    },
    [idDocumentOptions]
  )

  const canSubmit = useMemo(() => {
    return Boolean(form.firstName?.trim() && form.lastName?.trim())
  }, [form.firstName, form.lastName])

  const canPreviewStorefront = useMemo(() => {
    return Boolean(isPro && form.storefrontSlug?.trim())
  }, [form.storefrontSlug, isPro])

  const identityMeta = identityStatusMeta[identityStatus]
  const companyMeta = companyStatusMeta[companyVerificationStatus]
  const proPlans = useMemo(() => buildProPlanOptions(t), [t])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    async function loadProfile(showSpinner: boolean) {
      if (showSpinner) {
        setIsLoading(true)
      }
      setError(null)

      try {
        const data = await apiGet<UserAccount>('/users/me', { signal: controller.signal })
        if (!active) return
        setForm({
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          phoneNumber: data.phoneNumber ?? '',
          avatarUrl: data.avatarUrl ?? '',
          bio: data.bio ?? '',
          location: data.location ?? '',
          companyName: data.companyName ?? '',
          companyId: data.companyId ?? '',
          companyNiu: data.companyNiu ?? '',
          companyRccm: data.companyRccm ?? '',
          companyCity: data.companyCity ?? '',
          businessDescription: data.businessDescription ?? '',
          businessWebsite: data.businessWebsite ?? '',
          storefrontSlug: data.storefrontSlug ?? '',
          storefrontTagline: data.storefrontTagline ?? '',
          storefrontHeroUrl: data.storefrontHeroUrl ?? '',
          storefrontTheme: data.storefrontTheme ?? 'classic',
          storefrontShowReviews:
            typeof data.storefrontShowReviews === 'boolean' ? data.storefrontShowReviews : true,
          email: data.email
        })
        const settings = (data.settings ?? {}) as Record<string, unknown>
        setContactPreferences({
          emailAlerts:
            typeof settings.emailAlerts === 'boolean'
              ? (settings.emailAlerts as boolean)
              : true,
          importantSmsNotifications:
            typeof settings.importantSmsNotifications === 'boolean'
              ? (settings.importantSmsNotifications as boolean)
              : false,
          preferredContactChannels: resolvePreferredChannels(settings, isPro)
        })
        setIdentityStatus(
          (data.identityVerificationStatus as IdentityVerificationStatus) ?? 'unverified'
        )
        setIdentityDocuments(Array.isArray(data.identityDocuments) ? data.identityDocuments : [])
        setIdentitySubmittedAt(data.identitySubmittedAt ?? null)
        setIdentityReviewNotes(data.identityReviewNotes ?? null)
        setCompanyVerificationStatus(
          (data.companyVerificationStatus as CompanyVerificationStatus) ?? 'unverified'
        )
        setCompanyVerificationDocumentUrl(data.companyVerificationDocumentUrl ?? null)
        setCompanyVerificationSubmittedAt(data.companyVerificationSubmittedAt ?? null)
        setCompanyVerificationReviewNotes(data.companyVerificationReviewNotes ?? null)
      } catch (err) {
        if (!active) return
        console.error('Unable to load profile', err)
        setError(
          err instanceof Error
            ? err.message
            : t('dashboard.profile.loadError')
        )
      } finally {
        if (active && showSpinner) {
          setIsLoading(false)
        }
      }
    }

    if (user) {
      const account = user as UserAccount
      setForm({
        firstName: account.firstName ?? '',
        lastName: account.lastName ?? '',
        phoneNumber: account.phoneNumber ?? '',
        avatarUrl: account.avatarUrl ?? '',
        bio: account.bio ?? '',
        location: account.location ?? '',
        companyName: account.companyName ?? '',
        companyId: account.companyId ?? '',
        companyNiu: account.companyNiu ?? '',
        companyRccm: account.companyRccm ?? '',
        companyCity: account.companyCity ?? '',
        businessDescription: account.businessDescription ?? '',
        businessWebsite: account.businessWebsite ?? '',
        storefrontSlug: account.storefrontSlug ?? '',
        storefrontTagline: account.storefrontTagline ?? '',
        storefrontHeroUrl: account.storefrontHeroUrl ?? '',
        storefrontTheme: account.storefrontTheme ?? 'classic',
        storefrontShowReviews:
          typeof account.storefrontShowReviews === 'boolean'
            ? account.storefrontShowReviews
            : true,
        email: account.email ?? ''
      })
      const settings = (account.settings ?? {}) as Record<string, unknown>
      setContactPreferences({
        emailAlerts:
          typeof settings.emailAlerts === 'boolean'
            ? (settings.emailAlerts as boolean)
            : true,
        importantSmsNotifications:
          typeof settings.importantSmsNotifications === 'boolean'
            ? (settings.importantSmsNotifications as boolean)
            : false,
        preferredContactChannels: resolvePreferredChannels(settings, isPro)
      })
      setIdentityStatus(
        (account.identityVerificationStatus as IdentityVerificationStatus) ?? 'unverified'
      )
      setIdentityDocuments(Array.isArray(account.identityDocuments) ? account.identityDocuments : [])
      setIdentitySubmittedAt(account.identitySubmittedAt ?? null)
      setIdentityReviewNotes(account.identityReviewNotes ?? null)
      setCompanyVerificationStatus(
        (account.companyVerificationStatus as CompanyVerificationStatus) ?? 'unverified'
      )
      setCompanyVerificationDocumentUrl(account.companyVerificationDocumentUrl ?? null)
      setCompanyVerificationSubmittedAt(account.companyVerificationSubmittedAt ?? null)
      setCompanyVerificationReviewNotes(account.companyVerificationReviewNotes ?? null)
      setIsLoading(false)
    }
    loadProfile(!user)

    return () => {
      active = false
      controller.abort()
    }
  }, [t, user, isPro])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || isSaving) {
      return
    }

    setIsSaving(true)
    setError(null)

    const storefrontSlug = form.storefrontSlug?.trim().toLowerCase()
    const storefrontTheme = form.storefrontTheme?.trim()
    const businessWebsite = form.businessWebsite?.trim()
    const storefrontHeroUrl = form.storefrontHeroUrl?.trim()

    const payload: UpdateProfilePayload = {
      firstName: form.firstName?.trim() || undefined,
      lastName: form.lastName?.trim() || undefined,
      phoneNumber: form.phoneNumber?.trim() || undefined,
      avatarUrl: form.avatarUrl?.trim() || undefined,
      bio: form.bio?.trim() || undefined,
      location: form.location?.trim() || undefined,
      companyName: form.companyName?.trim() || undefined,
      companyId: form.companyId?.trim() || undefined,
      companyNiu: form.companyNiu?.trim() || undefined,
      companyRccm: form.companyRccm?.trim() || undefined,
      companyCity: form.companyCity?.trim() || undefined,
      businessDescription: form.businessDescription?.trim() || undefined,
      businessWebsite: businessWebsite || undefined,
      storefrontSlug: storefrontSlug || undefined,
      storefrontTagline: form.storefrontTagline?.trim() || undefined,
      storefrontHeroUrl: storefrontHeroUrl || undefined,
      storefrontTheme: storefrontTheme || undefined,
      storefrontShowReviews: form.storefrontShowReviews
    }

    if (!isPro) {
      delete payload.companyName
      delete payload.companyId
      delete payload.companyNiu
      delete payload.companyRccm
      delete payload.companyCity
      delete payload.businessDescription
      delete payload.businessWebsite
      delete payload.storefrontSlug
      delete payload.storefrontTagline
      delete payload.storefrontHeroUrl
      delete payload.storefrontTheme
      delete payload.storefrontShowReviews
    }

    try {
      const updated = await updateProfile(payload)
      setForm(prev => ({
        ...prev,
        firstName: updated.firstName ?? prev.firstName,
        lastName: updated.lastName ?? prev.lastName,
        phoneNumber: updated.phoneNumber ?? prev.phoneNumber,
        avatarUrl: updated.avatarUrl ?? prev.avatarUrl,
        bio: updated.bio ?? prev.bio,
        location: updated.location ?? prev.location,
        companyName: updated.companyName ?? prev.companyName,
        companyId: updated.companyId ?? prev.companyId,
        companyNiu: updated.companyNiu ?? prev.companyNiu,
        companyRccm: updated.companyRccm ?? prev.companyRccm,
        companyCity: updated.companyCity ?? prev.companyCity,
        businessDescription: updated.businessDescription ?? prev.businessDescription,
        businessWebsite: updated.businessWebsite ?? prev.businessWebsite,
        storefrontSlug: updated.storefrontSlug ?? prev.storefrontSlug,
        storefrontTagline: updated.storefrontTagline ?? prev.storefrontTagline,
        storefrontHeroUrl: updated.storefrontHeroUrl ?? prev.storefrontHeroUrl,
        storefrontTheme: updated.storefrontTheme ?? prev.storefrontTheme,
        storefrontShowReviews:
          typeof updated.storefrontShowReviews === 'boolean'
            ? updated.storefrontShowReviews
            : prev.storefrontShowReviews,
        email: updated.email ?? prev.email
      }))
      if (updated.companyVerificationStatus) {
        setCompanyVerificationStatus(updated.companyVerificationStatus)
      }
      if (updated.companyVerificationSubmittedAt !== undefined) {
        setCompanyVerificationSubmittedAt(updated.companyVerificationSubmittedAt ?? null)
      }
      if (updated.companyVerificationReviewNotes !== undefined) {
        setCompanyVerificationReviewNotes(updated.companyVerificationReviewNotes ?? null)
      }
      invalidateAuthCache()
      addToast({
        variant: 'success',
        title: t('dashboard.profile.saveTitle'),
        message: t('dashboard.profile.saveMessage')
      })
    } catch (err) {
      console.error('Unable to update profile', err)
      const message =
        err instanceof Error
          ? err.message
          : t('dashboard.profile.saveErrorMessage')
      setError(message)
      addToast({
        variant: 'error',
        title: t('dashboard.profile.saveErrorTitle'),
        message
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleIdentityFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      return
    }

    setUploadingDocument(true)
    setUploadError(null)

    try {
      const response = await uploadIdentityDocument({
        type: selectedDocumentType,
        description: documentDescription.trim() || undefined,
        file
      })
      setIdentityStatus(response.status)
      setIdentityDocuments(response.documents)
      setIdentitySubmittedAt(response.submittedAt ?? null)
      setDocumentDescription('')
      addToast({
        variant: 'success',
        title: t('dashboard.profile.documents.uploadedTitle'),
        message: t('dashboard.profile.documents.uploadedMessage')
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Unable to upload identity document', error)
      const message =
        error instanceof Error
          ? error.message
          : t('dashboard.profile.documents.uploadErrorMessage')
      setUploadError(message)
      addToast({
        variant: 'error',
        title: t('dashboard.profile.documents.uploadErrorTitle'),
        message
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setUploadingDocument(false)
    }
  }

  const handleCompanyDocChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      return
    }

    setUploadingCompanyDocument(true)
    setUploadError(null)

    try {
      const updated = await uploadCompanyVerificationDocument(file)
      setCompanyVerificationStatus(updated.companyVerificationStatus ?? 'pending')
      setCompanyVerificationDocumentUrl(updated.companyVerificationDocumentUrl ?? null)
      setCompanyVerificationSubmittedAt(updated.companyVerificationSubmittedAt ?? null)
      setCompanyVerificationReviewNotes(updated.companyVerificationReviewNotes ?? null)
      addToast({
        variant: 'success',
        title: t('dashboard.profile.company.uploadSuccessTitle'),
        message: t('dashboard.profile.company.uploadSuccessMessage')
      })
    } catch (error) {
      console.error('Unable to upload company document', error)
      const message =
        error instanceof Error
          ? error.message
          : t('dashboard.profile.company.uploadErrorMessage')
      setUploadError(message)
      addToast({
        variant: 'error',
        title: t('dashboard.profile.company.uploadErrorTitle'),
        message
      })
    } finally {
      setUploadingCompanyDocument(false)
      if (companyDocInputRef.current) {
        companyDocInputRef.current.value = ''
      }
    }
  }

  const handleStorefrontAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setUploadingStorefrontAvatar(true)
    try {
      const result = await uploadMedia(file)
      setForm(prev => ({ ...prev, avatarUrl: result.url }))
      const updated = await updateProfile({ avatarUrl: result.url })
      setForm(prev => ({ ...prev, avatarUrl: updated.avatarUrl ?? result.url }))
      addToast({
        variant: 'success',
        title: t('dashboard.profile.storefront.uploadSuccessTitle'),
        message: t('dashboard.profile.storefront.uploadSuccessMessage')
      })
    } catch (err) {
      console.error('Unable to upload storefront avatar', err)
      addToast({
        variant: 'error',
        title: t('dashboard.profile.storefront.uploadErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.profile.storefront.uploadErrorMessage')
      })
    } finally {
      setUploadingStorefrontAvatar(false)
      event.target.value = ''
    }
  }

  const handleStorefrontHeroUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setUploadingStorefrontHero(true)
    try {
      const result = await uploadMedia(file)
      setForm(prev => ({ ...prev, storefrontHeroUrl: result.url }))
      const updated = await updateProfile({ storefrontHeroUrl: result.url })
      setForm(prev => ({ ...prev, storefrontHeroUrl: updated.storefrontHeroUrl ?? result.url }))
      addToast({
        variant: 'success',
        title: t('dashboard.profile.storefront.uploadSuccessTitle'),
        message: t('dashboard.profile.storefront.uploadSuccessMessage')
      })
    } catch (err) {
      console.error('Unable to upload storefront cover', err)
      addToast({
        variant: 'error',
        title: t('dashboard.profile.storefront.uploadErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.profile.storefront.uploadErrorMessage')
      })
    } finally {
      setUploadingStorefrontHero(false)
      event.target.value = ''
    }
  }

  const handleRemoveIdentityDocument = async (documentId: string) => {
    if (removingDocumentId) {
      return
    }

    setRemovingDocumentId(documentId)
    setUploadError(null)

    try {
      const response = await removeIdentityDocument(documentId)
      setIdentityStatus(response.status)
      setIdentityDocuments(response.documents)
      setIdentitySubmittedAt(response.submittedAt ?? null)
      addToast({
        variant: 'info',
        title: t('dashboard.profile.documents.deletedTitle'),
        message: t('dashboard.profile.documents.deletedMessage')
      })
    } catch (error) {
      console.error('Unable to remove identity document', error)
      addToast({
        variant: 'error',
        title: t('dashboard.profile.documents.deleteErrorTitle'),
        message:
          error instanceof Error
            ? error.message
            : t('dashboard.profile.documents.deleteErrorMessage')
      })
    } finally {
      setRemovingDocumentId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('dashboard.profile.title')}</h1>
            <p>{t('dashboard.profile.subtitle')}</p>
          </div>
          {isPro ? (
            <Button
              type="button"
              variant="outline"
              disabled={!canPreviewStorefront}
              onClick={() => {
                const slug = form.storefrontSlug?.trim()
                if (!slug) {
                  addToast({
                    variant: 'info',
                    title: t('dashboard.profile.storefront.previewUnavailableTitle'),
                    message: t('dashboard.profile.storefront.previewUnavailableMessage')
                  })
                  return
                }
                const origin = typeof window !== 'undefined' ? window.location.origin : ''
                const url = `${origin}/store/${slug.toLowerCase()}`
                window.open(url, '_blank', 'noopener')
              }}
            >
              {t('dashboard.profile.storefront.preview')}
            </Button>
          ) : null}
        </header>

        <section className="dashboard-section">
          <h2>{t('dashboard.profile.sections.personal')}</h2>
          {isLoading ? (
            <p style={{ color: '#6c757d' }}>{t('dashboard.profile.loading')}</p>
          ) : (
            <form className="profile-form" onSubmit={handleSubmit}>
              <div className="listing-form__grid">
                <FormField label={t('dashboard.profile.fields.firstName')} htmlFor="profile-first" required>
                  <Input
                    id="profile-first"
                    value={form.firstName ?? ''}
                    onChange={event =>
                      setForm(prev => ({ ...prev, firstName: event.target.value }))
                    }
                    required
                  />
                </FormField>
                <FormField label={t('dashboard.profile.fields.lastName')} htmlFor="profile-last" required>
                  <Input
                    id="profile-last"
                    value={form.lastName ?? ''}
                    onChange={event =>
                      setForm(prev => ({ ...prev, lastName: event.target.value }))
                    }
                    required
                  />
                </FormField>
              </div>
              <FormField label={t('dashboard.profile.fields.email')} htmlFor="profile-email" required>
                <Input
                  id="profile-email"
                  type="email"
                  value={form.email ?? ''}
                  disabled
                />
              </FormField>
              <FormField label={t('dashboard.profile.fields.phone')} htmlFor="profile-phone">
                <Input
                  id="profile-phone"
                  type="tel"
                  value={form.phoneNumber ?? ''}
                  onChange={event =>
                    setForm(prev => ({ ...prev, phoneNumber: event.target.value }))
                  }
                />
              </FormField>
              <FormField label={t('dashboard.profile.fields.location')} htmlFor="profile-location">
                <Input
                  id="profile-location"
                  value={form.location ?? ''}
                  onChange={event =>
                    setForm(prev => ({ ...prev, location: event.target.value }))
                  }
                />
              </FormField>
              <FormField
                label={t('dashboard.profile.fields.bio')}
                htmlFor="profile-bio"
                hint={t('dashboard.profile.fields.bioHint')}
              >
                <textarea
                  id="profile-bio"
                  className="input"
                  rows={4}
                  value={form.bio ?? ''}
                  onChange={event =>
                    setForm(prev => ({ ...prev, bio: event.target.value }))
                  }
                />
              </FormField>
              {isPro ? (
                <>
                  <h3 style={{ marginTop: '24px' }}>{t('dashboard.profile.sections.business')}</h3>
                  <div className="listing-form__grid">
                    <FormField label={t('dashboard.profile.fields.companyName')} htmlFor="profile-company-name">
                      <Input
                        id="profile-company-name"
                        value={form.companyName ?? ''}
                        onChange={event =>
                          setForm(prev => ({ ...prev, companyName: event.target.value }))
                        }
                        placeholder={t('dashboard.profile.fields.companyNamePlaceholder')}
                      />
                    </FormField>
                    <FormField label={t('dashboard.profile.fields.companyId')} htmlFor="profile-company-id">
                      <Input
                        id="profile-company-id"
                        value={form.companyId ?? ''}
                        onChange={event =>
                          setForm(prev => ({ ...prev, companyId: event.target.value }))
                        }
                        placeholder={t('dashboard.profile.fields.companyIdPlaceholder')}
                      />
                    </FormField>
                  </div>
                  <div className="listing-form__grid">
                    <FormField label={t('dashboard.profile.fields.companyNiu')} htmlFor="profile-company-niu">
                      <Input
                        id="profile-company-niu"
                        value={form.companyNiu ?? ''}
                        onChange={event =>
                          setForm(prev => ({ ...prev, companyNiu: event.target.value }))
                        }
                        placeholder={t('dashboard.profile.fields.companyNiuPlaceholder')}
                      />
                    </FormField>
                    <FormField label={t('dashboard.profile.fields.companyRccm')} htmlFor="profile-company-rccm">
                      <Input
                        id="profile-company-rccm"
                        value={form.companyRccm ?? ''}
                        onChange={event =>
                          setForm(prev => ({ ...prev, companyRccm: event.target.value }))
                        }
                        placeholder={t('dashboard.profile.fields.companyRccmPlaceholder')}
                      />
                    </FormField>
                    <FormField label={t('dashboard.profile.fields.companyCity')} htmlFor="profile-company-city">
                      <Input
                        id="profile-company-city"
                        value={form.companyCity ?? ''}
                        onChange={event =>
                          setForm(prev => ({ ...prev, companyCity: event.target.value }))
                        }
                        placeholder={t('dashboard.profile.fields.companyCityPlaceholder')}
                      />
                    </FormField>
                  </div>
                  <FormField
                    label={t('dashboard.profile.fields.businessDescription')}
                    htmlFor="profile-business-description"
                    hint={t('dashboard.profile.fields.businessDescriptionHint')}
                  >
                    <textarea
                      id="profile-business-description"
                      className="input"
                      rows={4}
                      value={form.businessDescription ?? ''}
                      onChange={event =>
                        setForm(prev => ({ ...prev, businessDescription: event.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label={t('dashboard.profile.fields.businessWebsite')} htmlFor="profile-business-website">
                    <Input
                      id="profile-business-website"
                      type="url"
                      value={form.businessWebsite ?? ''}
                      onChange={event =>
                        setForm(prev => ({ ...prev, businessWebsite: event.target.value }))
                      }
                      onBlur={event => {
                        const raw = event.target.value.trim()
                        if (!raw) {
                          return
                        }
                        if (!raw.includes('://')) {
                          const normalized = `https://${raw}`
                          setForm(prev => ({ ...prev, businessWebsite: normalized }))
                        }
                      }}
                      placeholder={t('dashboard.profile.fields.businessWebsitePlaceholder')}
                    />
                  </FormField>
                </>
              ) : null}

              {isPro ? (
                <>
                  <h3 style={{ marginTop: '24px' }}>{t('dashboard.profile.sections.storefront')}</h3>
                  <div className="listing-form__grid">
                    <FormField
                      label={t('dashboard.profile.fields.storefrontSlug')}
                      htmlFor="profile-storefront-slug"
                      hint={t('dashboard.profile.fields.storefrontSlugHint')}
                      required={false}
                    >
                      <Input
                        id="profile-storefront-slug"
                        value={form.storefrontSlug ?? ''}
                        onChange={event => {
                          const raw = event.target.value
                          const sanitized = raw
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, '-')
                            .replace(/-{2,}/g, '-')
                            .replace(/^-+|-+$/g, '')
                          setForm(prev => ({ ...prev, storefrontSlug: sanitized }))
                        }}
                        placeholder={t('dashboard.profile.fields.storefrontSlugPlaceholder')}
                      />
                    </FormField>
                    <FormField
                      label={t('dashboard.profile.fields.storefrontTagline')}
                      htmlFor="profile-storefront-tagline"
                      hint={t('dashboard.profile.fields.storefrontTaglineHint')}
                    >
                      <Input
                        id="profile-storefront-tagline"
                        value={form.storefrontTagline ?? ''}
                        onChange={event =>
                          setForm(prev => ({ ...prev, storefrontTagline: event.target.value }))
                        }
                        placeholder={t('dashboard.profile.fields.storefrontTaglinePlaceholder')}
                      />
                  </FormField>
                </div>
                <FormField
                  label={t('dashboard.profile.fields.storefrontAvatar')}
                  htmlFor="profile-storefront-avatar"
                  hint={t('dashboard.profile.fields.storefrontAvatarHint')}
                >
                  <div className="storefront-media">
                    <div className="storefront-media__preview storefront-media__preview--avatar">
                      {form.avatarUrl ? (
                        <img src={resolveMediaUrl(form.avatarUrl)} alt="" />
                      ) : (
                        <span>{t('dashboard.profile.storefront.media.emptyAvatar')}</span>
                      )}
                    </div>
                    <div className="storefront-media__actions">
                      <input
                        ref={storefrontAvatarInputRef}
                        id="profile-storefront-avatar"
                        type="file"
                        accept="image/*"
                        onChange={handleStorefrontAvatarUpload}
                        style={{ display: 'none' }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => storefrontAvatarInputRef.current?.click()}
                        disabled={uploadingStorefrontAvatar}
                      >
                        {uploadingStorefrontAvatar
                          ? t('dashboard.profile.storefront.media.uploading')
                          : t('dashboard.profile.storefront.media.upload')}
                      </Button>
                      {form.avatarUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setForm(prev => ({ ...prev, avatarUrl: '' }))}
                        >
                          {t('actions.remove')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </FormField>
                <FormField
                  label={t('dashboard.profile.fields.storefrontHero')}
                  htmlFor="profile-storefront-hero"
                  hint={t('dashboard.profile.fields.storefrontHeroHint')}
                >
                  <Input
                    id="profile-storefront-hero"
                    value={form.storefrontHeroUrl ?? ''}
                    onChange={event =>
                      setForm(prev => ({ ...prev, storefrontHeroUrl: event.target.value }))
                    }
                    placeholder={t('dashboard.profile.fields.storefrontHeroPlaceholder')}
                  />
                  <div className="storefront-media storefront-media--hero">
                    <div className="storefront-media__preview storefront-media__preview--hero">
                      {form.storefrontHeroUrl ? (
                        <img src={resolveMediaUrl(form.storefrontHeroUrl)} alt="" />
                      ) : (
                        <span>{t('dashboard.profile.storefront.media.emptyHero')}</span>
                      )}
                    </div>
                    <div className="storefront-media__actions">
                      <input
                        ref={storefrontHeroInputRef}
                        id="profile-storefront-hero-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleStorefrontHeroUpload}
                        style={{ display: 'none' }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => storefrontHeroInputRef.current?.click()}
                        disabled={uploadingStorefrontHero}
                      >
                        {uploadingStorefrontHero
                          ? t('dashboard.profile.storefront.media.uploading')
                          : t('dashboard.profile.storefront.media.upload')}
                      </Button>
                      {form.storefrontHeroUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setForm(prev => ({ ...prev, storefrontHeroUrl: '' }))}
                        >
                          {t('actions.remove')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </FormField>
                  <div className="listing-form__grid">
                    <FormField label={t('dashboard.profile.fields.storefrontTheme')} htmlFor="profile-storefront-theme">
                      <select
                        id="profile-storefront-theme"
                        className="input"
                        value={form.storefrontTheme ?? 'classic'}
                        onChange={event =>
                          setForm(prev => ({ ...prev, storefrontTheme: event.target.value }))
                        }
                      >
                        {storefrontThemeOptions.map(theme => (
                          <option key={theme.value} value={theme.value}>
                            {theme.label}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label={t('dashboard.profile.fields.storefrontReviews')} htmlFor="profile-storefront-reviews">
                      <label className="form-field__control" style={{ gap: '8px' }}>
                        <input
                          id="profile-storefront-reviews"
                          type="checkbox"
                          checked={Boolean(form.storefrontShowReviews)}
                          onChange={event =>
                            setForm(prev => ({
                              ...prev,
                              storefrontShowReviews: event.target.checked
                            }))
                          }
                        />
                        <span>{t('dashboard.profile.fields.storefrontReviewsToggle')}</span>
                      </label>
                    </FormField>
                  </div>
                </>
              ) : null}
              {error ? (
                <p className="auth-form__error" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={!canSubmit || isSaving}>
                {isSaving ? t('dashboard.profile.saveLoading') : t('actions.save')}
              </Button>
            </form>
          )}
        </section>

        {isPro ? (
          <section className="dashboard-section">
            <div className="dashboard-section__head">
              <h2>{t('dashboard.profile.company.title')}</h2>
              <span className={`badge badge--${companyMeta.variant}`}>
                {companyMeta.label}
              </span>
            </div>
            <p className="dashboard-section__description">{companyMeta.description}</p>
            {companyVerificationSubmittedAt ? (
              <p style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                {t('dashboard.profile.company.lastSubmission')}{' '}
                {new Date(companyVerificationSubmittedAt).toLocaleString(dateLocale, {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </p>
            ) : null}
            {companyVerificationReviewNotes ? (
              <p className="auth-form__error" role="alert">
                {t('dashboard.profile.company.reviewNotes')} {companyVerificationReviewNotes}
              </p>
            ) : null}

            <div className="card" style={{ padding: '16px', marginTop: '16px' }}>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <strong>{t('dashboard.profile.company.documentTitle')}</strong>
                  <p style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                    {t('dashboard.profile.company.documentHint')}
                  </p>
                </div>
                {companyVerificationDocumentUrl ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => window.open(companyVerificationDocumentUrl, '_blank', 'noopener')}
                    >
                      {t('dashboard.profile.company.openDocument')}
                    </Button>
                    <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                      {t('dashboard.profile.company.documentUploaded')}
                    </span>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                    {t('dashboard.profile.company.documentEmpty')}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    ref={companyDocInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleCompanyDocChange}
                    disabled={uploadingCompanyDocument}
                    style={{ display: 'none' }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => companyDocInputRef.current?.click()}
                    disabled={uploadingCompanyDocument}
                  >
                    {uploadingCompanyDocument
                      ? t('dashboard.profile.company.uploading')
                      : t('actions.upload')}
                  </Button>
                  <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                    {t('dashboard.profile.company.acceptedFormats')}
                  </span>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!isPro ? (
          <section className="dashboard-section">
            <div className="dashboard-section__head">
              <div>
                <h2>{t('dashboard.profile.proUpsell.title')}</h2>
                <p style={{ margin: '6px 0 0', color: '#6c757d' }}>
                  {t('dashboard.profile.proUpsell.subtitle')}
                </p>
              </div>
              <Button
                variant="accent"
                onClick={() => {
                  navigate('/dashboard/pro')
                }}
              >
                {t('dashboard.profile.proUpsell.cta')}
              </Button>
            </div>
            <div className="message-list">
              {proPlans.map(plan => (
                <div key={plan.id} className="message-item">
                  <div>
                    <span className="message-item__title">{plan.name}</span>
                    <span className="message-item__snippet">{plan.description}</span>
                  </div>
                  <span className="message-item__snippet">{plan.priceLabel}</span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigate('/dashboard/pro')
                    }}
                  >
                    {plan.cta}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="dashboard-section">
          <h2>{t('dashboard.profile.sections.contact')}</h2>
          <p className="dashboard-section__description">
            {t('dashboard.profile.contactDescription')}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {contactPreferences.preferredContactChannels.map(channel => (
              <span key={channel} className="badge badge--info">
                {contactChannelLabels[channel] ?? channel}
              </span>
            ))}
          </div>
          <div className="settings-form">
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={contactPreferences.emailAlerts}
                  readOnly
                  disabled
                />
                <span>{t('dashboard.profile.contactEmailAlerts')}</span>
              </div>
            </label>
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={contactPreferences.importantSmsNotifications}
                  readOnly
                  disabled
                />
                <span>{t('dashboard.profile.contactSmsAlerts')}</span>
              </div>
            </label>
          </div>
          <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#6c757d' }}>
            {t('dashboard.profile.contactHint')}
          </p>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__head">
            <h2>{t('dashboard.profile.identity.title')}</h2>
            <span className={`badge badge--${identityMeta.variant}`}>
              {identityMeta.label}
            </span>
          </div>
          <p className="dashboard-section__description">{identityMeta.description}</p>
          {identitySubmittedAt ? (
            <p style={{ fontSize: '0.875rem', color: '#6c757d' }}>
              {t('dashboard.profile.identity.lastSubmission')}{' '}
              {new Date(identitySubmittedAt).toLocaleString(dateLocale, {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}
            </p>
          ) : null}
          {identityReviewNotes ? (
            <p className="auth-form__error" role="alert">
              {t('dashboard.profile.identity.reviewNotes')} {identityReviewNotes}
            </p>
          ) : null}

          <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
            {identityDocuments.length ? (
              identityDocuments.map(document => {
                const meta = documentStatusMeta[document.status ?? 'pending']
                return (
                  <article
                    key={document.id}
                    className="card"
                    style={{ padding: '12px', display: 'grid', gap: '8px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <div>
                        <strong>{getDocumentLabel(document.type)}</strong>
                        <p style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                          {t('dashboard.profile.documents.uploadedOn')}{' '}
                          {new Date(document.uploadedAt).toLocaleString(dateLocale, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </p>
                      </div>
                      <span className={`badge badge--${meta.variant}`}>{meta.label}</span>
                    </div>
                    {document.description ? (
                      <p style={{ fontSize: '0.9rem' }}>{document.description}</p>
                    ) : null}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => window.open(document.url, '_blank', 'noopener')}
                      >
                        {t('dashboard.profile.documents.open')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleRemoveIdentityDocument(document.id)}
                        disabled={removingDocumentId === document.id || uploadingDocument}
                      >
                        {removingDocumentId === document.id
                          ? t('dashboard.profile.documents.deleting')
                          : t('dashboard.profile.documents.delete')}
                      </Button>
                    </div>
                  </article>
                )
              })
            ) : (
              <p style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                {t('dashboard.profile.documents.empty')}
              </p>
            )}
          </div>

          <div
            className="identity-upload"
            style={{ marginTop: '16px', padding: '16px', border: '1px solid #e9ecef', borderRadius: '8px', display: 'grid', gap: '12px' }}
          >
            <h3 style={{ margin: 0 }}>{t('dashboard.profile.documents.addTitle')}</h3>
            <FormField label={t('dashboard.profile.documents.typeLabel')} htmlFor="identity-document-type">
              <select
                id="identity-document-type"
                className="input"
                value={selectedDocumentType}
                onChange={event => setSelectedDocumentType(event.target.value as IdentityDocumentType)}
                disabled={uploadingDocument}
              >
                {idDocumentOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label={t('dashboard.profile.documents.notesLabel')}
              htmlFor="identity-document-description"
              hint={t('dashboard.profile.documents.notesHint')}
            >
              <Input
                id="identity-document-description"
                value={documentDescription}
                onChange={event => setDocumentDescription(event.target.value)}
                disabled={uploadingDocument}
              />
            </FormField>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleIdentityFileChange}
                disabled={uploadingDocument}
                style={{ display: 'none' }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingDocument}
              >
                {uploadingDocument
                  ? t('dashboard.profile.documents.uploading')
                  : t('actions.upload')}
              </Button>
              <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                {t('dashboard.profile.documents.acceptedFormats')}
              </span>
            </div>
            {uploadError ? (
              <p className="auth-form__error" role="alert">
                {uploadError}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
