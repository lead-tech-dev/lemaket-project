import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import {
  changePassword,
  deactivateAccount,
  logout,
  updateSettings,
  updateTwoFactor,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  uploadCourierVerificationDocument,
  type PreferredContactChannel,
  type UserAddress,
  type UserAddressPayload
} from '../../utils/auth'
import { useToast } from '../../components/ui/Toast'
import { invalidateAuthCache, useAuth } from '../../hooks/useAuth'
import { Modal } from '../../components/ui/Modal'
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt'
import { Skeleton } from '../../components/ui/Skeleton'
import { useI18n } from '../../contexts/I18nContext'

type ToggleSettingKey =
  | 'showPhoneToApprovedOnly'
  | 'maskPreciseLocation'
  | 'enableTwoFactorAuth'
  | 'isCourier'
  | 'tipsNotifications'
  | 'favoritePriceAlerts'
  | 'emailAlerts'
  | 'importantSmsNotifications'
  | 'savedSearchAlerts'
  | 'moderationAlerts'
  | 'systemAlerts'
  | 'marketingOptIn'

type SettingsState = Record<ToggleSettingKey, boolean> & {
  preferredContactChannels: PreferredContactChannel[]
  payoutMobileNetwork: 'mtn' | 'orange' | ''
  payoutMobileNumber: string
  payoutMobileName: string
  courierCity: string
  courierZipcode: string
  courierLat: string
  courierLng: string
  courierRadiusKm: string
}

const DEFAULT_CONTACT_CHANNELS: PreferredContactChannel[] = ['email', 'in_app']

const DEFAULT_SETTINGS: SettingsState = {
  showPhoneToApprovedOnly: true,
  maskPreciseLocation: false,
  enableTwoFactorAuth: false,
  isCourier: false,
  tipsNotifications: true,
  favoritePriceAlerts: true,
  emailAlerts: true,
  importantSmsNotifications: false,
  savedSearchAlerts: true,
  moderationAlerts: true,
  systemAlerts: true,
  marketingOptIn: false,
  preferredContactChannels: DEFAULT_CONTACT_CHANNELS,
  payoutMobileNetwork: '',
  payoutMobileNumber: '',
  payoutMobileName: '',
  courierCity: '',
  courierZipcode: '',
  courierLat: '',
  courierLng: '',
  courierRadiusKm: '15'
}

function getEmptyAddressPayload(overrides: Partial<UserAddressPayload> = {}): UserAddressPayload {
  return {
    label: '',
    recipientName: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
    isDefaultShipping: false,
    isDefaultBilling: false,
    ...overrides
  }
}

function sanitizePreferredChannels(
  value: unknown,
  allowWhatsapp: boolean
): PreferredContactChannel[] {
  if (!Array.isArray(value)) {
    return DEFAULT_CONTACT_CHANNELS
  }

  const normalized = Array.from(
    new Set(
      value
        .map(item => (typeof item === 'string' ? item.toLowerCase() : ''))
        .filter((item): item is PreferredContactChannel =>
          ['email', 'sms', 'phone', 'whatsapp', 'in_app'].includes(item)
        )
        .filter(item => allowWhatsapp || item !== 'whatsapp')
    )
  ) as PreferredContactChannel[]

  if (!normalized.includes('in_app')) {
    normalized.push('in_app')
  }

  return normalized.length ? normalized : DEFAULT_CONTACT_CHANNELS
}

const getContactChannelOptions = (
  t: (key: string, values?: Record<string, string | number>) => string,
  allowWhatsapp: boolean
): Array<{
  value: PreferredContactChannel
  label: string
  description: string
  locked?: boolean
}> => {
  const options: Array<{
    value: PreferredContactChannel
    label: string
    description: string
    locked?: boolean
  }> = [
    {
      value: 'email',
      label: t('dashboard.settings.channels.email.label'),
      description: t('dashboard.settings.channels.email.description')
    },
    {
      value: 'sms',
      label: t('dashboard.settings.channels.sms.label'),
      description: t('dashboard.settings.channels.sms.description')
    },
    {
      value: 'phone',
      label: t('dashboard.settings.channels.phone.label'),
      description: t('dashboard.settings.channels.phone.description')
    }
  ]

  if (allowWhatsapp) {
    options.push({
      value: 'whatsapp',
      label: t('dashboard.settings.channels.whatsapp.label'),
      description: t('dashboard.settings.channels.whatsapp.description')
    })
  }

  options.push({
    value: 'in_app',
    label: t('dashboard.settings.channels.inApp.label'),
    description: t('dashboard.settings.channels.inApp.description'),
    locked: true
  })

  return options
}

export default function Settings(){
  const location = useLocation()
  const { user, isPro } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const contactChannelOptions = useMemo(
    () => getContactChannelOptions(t, isPro),
    [t, isPro]
  )
  const payoutNetworkOptions = useMemo(
    () => [
      { value: '', label: t('dashboard.settings.payout.network.placeholder') },
      { value: 'mtn', label: t('dashboard.settings.payout.network.mtn') },
      { value: 'orange', label: t('dashboard.settings.payout.network.orange') }
    ],
    [t]
  )
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const [updatingSetting, setUpdatingSetting] = useState<ToggleSettingKey | null>(null)
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [updatingTwoFactor, setUpdatingTwoFactor] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [channelUpdating, setChannelUpdating] = useState<PreferredContactChannel | null>(null)
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [addressesError, setAddressesError] = useState<string | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [addressForm, setAddressForm] = useState<UserAddressPayload>(getEmptyAddressPayload())
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null)
  const { addToast } = useToast()
  const hasPendingPasswordChanges =
    showPasswordForm && Boolean(currentPassword || newPassword || confirmPassword)
  const hasPendingDeactivation =
    showDeactivateModal && Boolean(deactivateReason.trim())
  const payoutMissing =
    !settings.payoutMobileNetwork || !settings.payoutMobileNumber.trim()
  const [courierSaving, setCourierSaving] = useState(false)
  const [courierGeocoding, setCourierGeocoding] = useState(false)
  const [courierDocUploading, setCourierDocUploading] = useState(false)

  useUnsavedChangesPrompt(hasPendingPasswordChanges || hasPendingDeactivation)

  useEffect(() => {
    if (!location.hash) {
      return
    }
    const id = location.hash.replace('#', '')
    if (!id) {
      return
    }
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  useEffect(() => {
    const rawSettings = (user?.settings ?? {}) as Record<string, unknown>
    const resolve = (key: ToggleSettingKey) =>
      typeof rawSettings[key] === 'boolean'
        ? (rawSettings[key] as boolean)
        : DEFAULT_SETTINGS[key]
    const resolveText = (key: 'payoutMobileNetwork' | 'payoutMobileNumber' | 'payoutMobileName') =>
      typeof rawSettings[key] === 'string' ? (rawSettings[key] as string) : DEFAULT_SETTINGS[key]

    const courierLocation = (rawSettings.courierLocation ?? {}) as {
      city?: string
      zipcode?: string
      lat?: number
      lng?: number
    }
    const courierRadius = rawSettings.courierRadiusKm

    setSettings(prev => ({
      ...prev,
      showPhoneToApprovedOnly: resolve('showPhoneToApprovedOnly'),
      maskPreciseLocation: resolve('maskPreciseLocation'),
      enableTwoFactorAuth: resolve('enableTwoFactorAuth'),
      isCourier: resolve('isCourier'),
      tipsNotifications: resolve('tipsNotifications'),
      favoritePriceAlerts: resolve('favoritePriceAlerts'),
      emailAlerts: resolve('emailAlerts'),
      importantSmsNotifications: resolve('importantSmsNotifications'),
      savedSearchAlerts: resolve('savedSearchAlerts'),
      moderationAlerts: resolve('moderationAlerts'),
      systemAlerts: resolve('systemAlerts'),
      marketingOptIn: resolve('marketingOptIn'),
      preferredContactChannels: sanitizePreferredChannels(
        (rawSettings.preferredContactChannels as unknown) ?? DEFAULT_CONTACT_CHANNELS,
        isPro
      ),
      payoutMobileNetwork: resolveText('payoutMobileNetwork') as SettingsState['payoutMobileNetwork'],
      payoutMobileNumber: resolveText('payoutMobileNumber'),
      payoutMobileName: resolveText('payoutMobileName'),
      courierCity: courierLocation.city ?? '',
      courierZipcode: courierLocation.zipcode ?? '',
      courierLat:
        typeof courierLocation.lat === 'number' && Number.isFinite(courierLocation.lat)
          ? courierLocation.lat.toString()
          : '',
      courierLng:
        typeof courierLocation.lng === 'number' && Number.isFinite(courierLocation.lng)
          ? courierLocation.lng.toString()
          : '',
      courierRadiusKm:
        typeof courierRadius === 'number' && Number.isFinite(courierRadius)
          ? courierRadius.toString()
          : DEFAULT_SETTINGS.courierRadiusKm
    }))
  }, [user, isPro])

  useEffect(() => {
    if (!user) {
      setAddresses([])
      return
    }

    setAddressesLoading(true)
    setAddressesError(null)
    listAddresses()
      .then(response => {
        setAddresses(response)
      })
      .catch(error => {
        console.error('Unable to load addresses', error)
        setAddressesError(
          error instanceof Error
            ? error.message
            : t('dashboard.settings.address.loadError')
        )
      })
      .finally(() => {
        setAddressesLoading(false)
      })
  }, [user])

  const resetPasswordFields = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    if (newPassword.length < 8) {
      setPasswordError(t('dashboard.settings.password.minLength'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('dashboard.settings.password.mismatch'))
      return
    }

    setIsSubmitting(true)
    setPasswordError(null)

    try {
      await changePassword({
        currentPassword,
        newPassword
      })
      addToast({
        variant: 'success',
        title: t('dashboard.settings.password.successTitle'),
        message: t('dashboard.settings.password.successMessage')
      })
      resetPasswordFields()
      setShowPasswordForm(false)
    } catch (error) {
      console.error('Unable to change password', error)
      const message =
        error instanceof Error
          ? error.message
          : t('dashboard.settings.password.errorMessage')
      setPasswordError(message)
      addToast({
        variant: 'error',
        title: t('dashboard.settings.password.errorTitle'),
        message
      })
    } finally {
      setIsSubmitting(false)
      }
    }

  const handleSettingToggle =
    (key: ToggleSettingKey) => async (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.checked
      const previousValue = settings[key]

      if (previousValue === nextValue || updatingSetting) {
        setSettings(prev => ({ ...prev, [key]: nextValue }))
        return
      }

      setSettings(prev => ({ ...prev, [key]: nextValue }))
      setUpdatingSetting(key)

      try {
        await updateSettings({ [key]: nextValue })
      } catch (error) {
        console.error('Unable to update settings', error)
        const message =
          error instanceof Error
            ? error.message
            : t('dashboard.settings.toasts.settingErrorMessage')
        setSettings(prev => ({ ...prev, [key]: previousValue }))
        addToast({
          variant: 'error',
          title: t('dashboard.settings.toasts.settingErrorTitle'),
          message
        })
      } finally {
        setUpdatingSetting(null)
      }
    }

  const handleChannelToggle =
    (channel: PreferredContactChannel) => async (event: ChangeEvent<HTMLInputElement>) => {
      const nextChecked = event.target.checked
      const previousChannels = settings.preferredContactChannels

      if (!nextChecked && channel === 'in_app') {
        addToast({
          variant: 'info',
          title: t('dashboard.settings.toasts.channelRequiredTitle'),
          message: t('dashboard.settings.toasts.channelRequiredMessage')
        })
        return
      }

      let nextChannels = previousChannels
      if (nextChecked) {
        if (!previousChannels.includes(channel)) {
          nextChannels = [...previousChannels, channel]
        }
      } else {
        nextChannels = previousChannels.filter(item => item !== channel)
        if (!nextChannels.length) {
          addToast({
            variant: 'info',
            title: t('dashboard.settings.toasts.channelMinimumTitle'),
            message: t('dashboard.settings.toasts.channelMinimumMessage')
          })
          return
        }
      }

      setSettings(prev => ({ ...prev, preferredContactChannels: nextChannels }))
      setChannelUpdating(channel)

      try {
        await updateSettings({ preferredContactChannels: nextChannels })
      } catch (error) {
        console.error('Unable to update preferred channels', error)
        const message =
          error instanceof Error
            ? error.message
            : t('dashboard.settings.toasts.channelErrorMessage')
        setSettings(prev => ({ ...prev, preferredContactChannels: previousChannels }))
        addToast({
          variant: 'error',
          title: t('dashboard.settings.toasts.settingErrorTitle'),
          message
        })
      } finally {
        setChannelUpdating(null)
      }
    }

  const handlePayoutSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (payoutSaving) {
      return
    }
    setPayoutSaving(true)
    try {
      await updateSettings({
        payoutMobileNetwork: settings.payoutMobileNetwork || undefined,
        payoutMobileNumber: settings.payoutMobileNumber?.trim() || undefined,
        payoutMobileName: settings.payoutMobileName?.trim() || undefined
      })
      addToast({
        variant: 'success',
        title: t('dashboard.settings.payout.savedTitle'),
        message: t('dashboard.settings.payout.savedMessage')
      })
    } catch (error) {
      console.error('Unable to update payout settings', error)
      addToast({
        variant: 'error',
        title: t('dashboard.settings.payout.errorTitle'),
        message: t('dashboard.settings.payout.errorMessage')
      })
    } finally {
      setPayoutSaving(false)
    }
  }

  const handleCourierGeocode = async () => {
    if (courierGeocoding) return
    const city = settings.courierCity.trim()
    const zipcode = settings.courierZipcode.trim()
    if (!city && !zipcode) {
      addToast({
        variant: 'info',
        title: 'Localisation livreur',
        message: 'Renseignez au moins la ville ou le code postal.'
      })
      return
    }
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      addToast({
        variant: 'error',
        title: 'Localisation livreur',
        message: 'Token Mapbox manquant.'
      })
      return
    }
    setCourierGeocoding(true)
    try {
      const query = encodeURIComponent([zipcode, city].filter(Boolean).join(' '))
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?limit=1&types=place,postcode&access_token=${token}`
      )
      if (!response.ok) {
        throw new Error('Geocoding failed')
      }
      const data = await response.json()
      const center = data?.features?.[0]?.center
      if (Array.isArray(center) && center.length === 2) {
        setSettings(prev => ({
          ...prev,
          courierLng: center[0].toString(),
          courierLat: center[1].toString()
        }))
        addToast({
          variant: 'success',
          title: 'Localisation livreur',
          message: 'Coordonnées mises à jour.'
        })
      } else {
        addToast({
          variant: 'info',
          title: 'Localisation livreur',
          message: 'Aucun résultat trouvé.'
        })
      }
    } catch (error) {
      console.error('Unable to geocode courier location', error)
      addToast({
        variant: 'error',
        title: 'Localisation livreur',
        message: 'Impossible de géocoder cette adresse.'
      })
    } finally {
      setCourierGeocoding(false)
    }
  }

  const handleCourierSave = async () => {
    if (courierSaving) return
    setCourierSaving(true)
    try {
      const lat = settings.courierLat.trim()
      const lng = settings.courierLng.trim()
      await updateSettings({
        courierLocation: {
          city: settings.courierCity.trim() || undefined,
          zipcode: settings.courierZipcode.trim() || undefined,
          lat: lat ? Number(lat) : undefined,
          lng: lng ? Number(lng) : undefined
        },
        courierRadiusKm: settings.courierRadiusKm
          ? Number(settings.courierRadiusKm)
          : undefined
      })
      addToast({
        variant: 'success',
        title: 'Localisation livreur',
        message: 'Informations livreur enregistrées.'
      })
    } catch (error) {
      console.error('Unable to update courier location', error)
      addToast({
        variant: 'error',
        title: 'Localisation livreur',
        message: 'Impossible de sauvegarder la localisation.'
      })
    } finally {
      setCourierSaving(false)
    }
  }

  const handleCourierDocumentUpload = async (file?: File) => {
    if (!file || courierDocUploading) return
    setCourierDocUploading(true)
    try {
      await uploadCourierVerificationDocument(file)
      addToast({
        variant: 'success',
        title: 'Vérification livreur',
        message: 'Document envoyé. Vérification en cours.'
      })
      await invalidateAuthCache()
    } catch (error) {
      console.error('Unable to upload courier document', error)
      addToast({
        variant: 'error',
        title: 'Vérification livreur',
        message: 'Impossible d’envoyer le document.'
      })
    } finally {
      setCourierDocUploading(false)
    }
  }

  const refreshAddresses = async () => {
    const response = await listAddresses()
    setAddresses(response)
    return response
  }

  const openAddressModal = (address?: UserAddress) => {
    if (address) {
      setEditingAddressId(address.id)
      setAddressForm(
        getEmptyAddressPayload({
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
      )
    } else {
      const isFirstAddress = !addresses.length
      setEditingAddressId(null)
      setAddressForm(
        getEmptyAddressPayload({
          isDefaultShipping: isFirstAddress,
          isDefaultBilling: isFirstAddress
        })
      )
    }
    setAddressError(null)
    setShowAddressModal(true)
  }

  const handleAddressFieldChange = <K extends keyof UserAddressPayload>(
    key: K,
    value: UserAddressPayload[K]
  ) => {
    setAddressForm(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSaveAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingAddress) {
      return
    }

    const label = addressForm.label.trim()
    const recipientName = addressForm.recipientName.trim()
    const line1 = addressForm.line1.trim()
    const city = addressForm.city.trim()
    const postalCode = addressForm.postalCode.trim()
    const country = addressForm.country.trim()

    if (!label || !recipientName || !line1 || !city || !postalCode || !country) {
      setAddressError(t('dashboard.settings.address.requiredError'))
      return
    }

    setSavingAddress(true)
    setAddressError(null)

    const payload: UserAddressPayload = {
      label,
      recipientName,
      line1,
      city,
      postalCode,
      country,
      line2: addressForm.line2?.trim() ? addressForm.line2.trim() : undefined,
      state: addressForm.state?.trim() ? addressForm.state.trim() : undefined,
      phone: addressForm.phone?.trim() ? addressForm.phone.trim() : undefined,
      isDefaultShipping: Boolean(addressForm.isDefaultShipping),
      isDefaultBilling: Boolean(addressForm.isDefaultBilling)
    }

    try {
      if (editingAddressId) {
        await updateAddress(editingAddressId, payload)
        addToast({
          variant: 'success',
          title: t('dashboard.settings.address.savedTitle'),
          message: t('dashboard.settings.address.savedMessage')
        })
      } else {
        await createAddress(payload)
        addToast({
          variant: 'success',
          title: t('dashboard.settings.address.addedTitle'),
          message: t('dashboard.settings.address.addedMessage')
        })
      }
      await refreshAddresses()
      setShowAddressModal(false)
      setEditingAddressId(null)
      setAddressForm(getEmptyAddressPayload())
    } catch (error) {
      console.error('Unable to save address', error)
      setAddressError(
        error instanceof Error
          ? error.message
          : t('dashboard.settings.address.saveError')
      )
    } finally {
      setSavingAddress(false)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    if (deletingAddressId) {
      return
    }
    setDeletingAddressId(addressId)
    try {
      await deleteAddress(addressId)
      await refreshAddresses()
      addToast({
        variant: 'info',
        title: t('dashboard.settings.address.deletedTitle'),
        message: t('dashboard.settings.address.deletedMessage')
      })
    } catch (error) {
      console.error('Unable to delete address', error)
      addToast({
        variant: 'error',
        title: t('dashboard.settings.address.deleteErrorTitle'),
        message:
          error instanceof Error
            ? error.message
            : t('dashboard.settings.address.deleteErrorMessage')
      })
    } finally {
      setDeletingAddressId(null)
    }
  }

  const handleToggleTwoFactor = async () => {
    if (updatingTwoFactor) {
      return
    }

    const nextValue = !settings.enableTwoFactorAuth
    setSettings(prev => ({ ...prev, enableTwoFactorAuth: nextValue }))
    setUpdatingTwoFactor(true)

    try {
      await updateTwoFactor(nextValue)
      addToast({
        variant: 'success',
        title: nextValue
          ? t('dashboard.settings.twoFactor.enabledTitle')
          : t('dashboard.settings.twoFactor.disabledTitle'),
        message: nextValue
          ? t('dashboard.settings.twoFactor.enabledMessage')
          : t('dashboard.settings.twoFactor.disabledMessage')
      })
    } catch (error) {
      console.error('Unable to toggle two-factor authentication', error)
      const message =
        error instanceof Error
          ? error.message
          : t('dashboard.settings.twoFactor.errorMessage')
      setSettings(prev => ({ ...prev, enableTwoFactorAuth: !nextValue }))
      addToast({
        variant: 'error',
        title: t('dashboard.settings.twoFactor.errorTitle'),
        message
      })
    } finally {
      setUpdatingTwoFactor(false)
    }
  }

  const handleDeactivateAccount = async () => {
    if (isDeactivating) {
      return
    }

    setIsDeactivating(true)

    try {
      const reason = deactivateReason.trim()
      await deactivateAccount(reason ? { reason } : undefined)
      await logout()
      invalidateAuthCache()
      addToast({
        variant: 'info',
        title: t('dashboard.settings.deactivate.successTitle'),
        message: t('dashboard.settings.deactivate.successMessage')
      })
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Unable to deactivate account', error)
      const message =
        error instanceof Error
          ? error.message
          : t('dashboard.settings.deactivate.errorMessage')
      addToast({
        variant: 'error',
        title: t('dashboard.settings.deactivate.errorTitle'),
        message
      })
    } finally {
      setIsDeactivating(false)
      setShowDeactivateModal(false)
      setDeactivateReason('')
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('dashboard.settings.title')}</h1>
            <p>{t('dashboard.settings.subtitle')}</p>
          </div>
          <Button variant="outline">{t('dashboard.settings.help')}</Button>
        </header>

        <section className="dashboard-section">
          <h2>{t('dashboard.settings.sections.privacy')}</h2>
          <div className="settings-form">
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.showPhoneToApprovedOnly}
                  onChange={handleSettingToggle('showPhoneToApprovedOnly')}
                  disabled={updatingSetting === 'showPhoneToApprovedOnly'}
                />
                <span>{t('dashboard.settings.privacy.showPhone')}</span>
              </div>
            </label>
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.maskPreciseLocation}
                  onChange={handleSettingToggle('maskPreciseLocation')}
                  disabled={updatingSetting === 'maskPreciseLocation'}
                />
                <span>{t('dashboard.settings.privacy.maskLocation')}</span>
              </div>
            </label>
          </div>
        </section>

        <section className="dashboard-section" id="messaging-settings">
          <h2>{t('dashboard.settings.sections.contact')}</h2>
          <p className="dashboard-section__description">
            {t('dashboard.settings.contact.description')}
          </p>
          <div
            className="settings-form settings-form--stack"
            style={{ display: 'grid', gap: '12px' }}
          >
            {contactChannelOptions.map(option => {
              const checked = settings.preferredContactChannels.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="form-field form-field--inline settings-contact-option"
                  style={{ alignItems: 'flex-start', gap: '12px' }}
                >
                  <div className="form-field__control" style={{ alignItems: 'flex-start', gap: '12px' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={handleChannelToggle(option.value)}
                      disabled={channelUpdating === option.value || option.locked}
                    />
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontWeight: 600 }}>{option.label}</span>
                      <p className="form-field__hint">{option.description}</p>
                    </div>
                  </div>
                  {option.locked ? (
                    <span className="badge badge--muted">
                      {t('dashboard.settings.contact.inAppBadge')}
                    </span>
                  ) : null}
                </label>
              )
            })}
          </div>

          <div className="settings-form">
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.emailAlerts}
                  onChange={handleSettingToggle('emailAlerts')}
                  disabled={updatingSetting === 'emailAlerts'}
                />
                <span>{t('dashboard.settings.contact.emailAlerts')}</span>
              </div>
            </label>
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.importantSmsNotifications}
                  onChange={handleSettingToggle('importantSmsNotifications')}
                  disabled={updatingSetting === 'importantSmsNotifications'}
                />
                <span>{t('dashboard.settings.contact.smsAlerts')}</span>
              </div>
            </label>
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.marketingOptIn}
                  onChange={handleSettingToggle('marketingOptIn')}
                  disabled={updatingSetting === 'marketingOptIn'}
                />
              <span>{t('dashboard.settings.contact.marketingOptIn')}</span>
            </div>
          </label>
          </div>
        </section>

        <section className="dashboard-section" id="delivery-settings">
          <h2>Livraison</h2>
          <p className="dashboard-section__description">
            Activez le mode livreur pour recevoir des courses locales.
          </p>
          <div className="settings-form">
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.isCourier}
                  onChange={handleSettingToggle('isCourier')}
                  disabled={updatingSetting === 'isCourier'}
                />
                <span>Je souhaite être livreur particulier</span>
              </div>
            </label>
          </div>
          {settings.isCourier ? (
            <div className="settings-form settings-form--stack" style={{ marginTop: '16px' }}>
              <div className="card" style={{ padding: '16px' }}>
                <strong>Vérification livreur</strong>
                <p className="form-field__hint" style={{ marginTop: '6px' }}>
                  Statut:{' '}
                  <span style={{ fontWeight: 600 }}>
                    {user?.courierVerificationStatus ?? 'unverified'}
                  </span>
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                  <label className="btn btn--outline">
                    {courierDocUploading ? 'Envoi...' : 'Téléverser un document'}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      style={{ display: 'none' }}
                      disabled={courierDocUploading}
                      onChange={event => {
                        const file = event.target.files?.[0]
                        if (file) {
                          handleCourierDocumentUpload(file)
                          event.target.value = ''
                        }
                      }}
                    />
                  </label>
                  {user?.courierVerificationDocumentUrl ? (
                    <a
                      className="btn btn--ghost"
                      href={user.courierVerificationDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Voir le document
                    </a>
                  ) : null}
                </div>
                {user?.courierVerificationReviewNotes ? (
                  <p className="form-field__hint" style={{ marginTop: '8px' }}>
                    Note: {user.courierVerificationReviewNotes}
                  </p>
                ) : null}
              </div>
              <FormField label="Ville du livreur" htmlFor="courier-city">
                <Input
                  id="courier-city"
                  value={settings.courierCity}
                  onChange={event =>
                    setSettings(prev => ({ ...prev, courierCity: event.target.value }))
                  }
                  placeholder="Ex: Douala"
                />
              </FormField>
              <FormField label="Code postal" htmlFor="courier-zipcode">
                <Input
                  id="courier-zipcode"
                  value={settings.courierZipcode}
                  onChange={event =>
                    setSettings(prev => ({ ...prev, courierZipcode: event.target.value }))
                  }
                  placeholder="Ex: 00000"
                />
              </FormField>
              <div className="settings-form__row" style={{ display: 'grid', gap: '12px', gridTemplateColumns: '1fr 1fr' }}>
                <FormField label="Latitude" htmlFor="courier-lat">
                  <Input
                    id="courier-lat"
                    value={settings.courierLat}
                    onChange={event =>
                      setSettings(prev => ({ ...prev, courierLat: event.target.value }))
                    }
                    placeholder="Ex: 4.0511"
                  />
                </FormField>
                <FormField label="Longitude" htmlFor="courier-lng">
                  <Input
                    id="courier-lng"
                    value={settings.courierLng}
                    onChange={event =>
                      setSettings(prev => ({ ...prev, courierLng: event.target.value }))
                    }
                    placeholder="Ex: 9.7679"
                  />
                </FormField>
              </div>
              <FormField label="Rayon d’intervention (km)" htmlFor="courier-radius">
                <select
                  id="courier-radius"
                  className="input"
                  value={settings.courierRadiusKm}
                  onChange={event =>
                    setSettings(prev => ({ ...prev, courierRadiusKm: event.target.value }))
                  }
                >
                  <option value="5">5 km</option>
                  <option value="10">10 km</option>
                  <option value="15">15 km</option>
                  <option value="20">20 km</option>
                  <option value="30">30 km</option>
                </select>
              </FormField>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button type="button" variant="outline" onClick={handleCourierGeocode} disabled={courierGeocoding}>
                  {courierGeocoding ? 'Localisation...' : 'Localiser automatiquement'}
                </Button>
                <Button type="button" onClick={handleCourierSave} disabled={courierSaving}>
                  {courierSaving ? 'Enregistrement...' : 'Enregistrer la localisation'}
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="dashboard-section" id="payout-settings">
          <h2>{t('dashboard.settings.sections.payout')}</h2>
          <p className="dashboard-section__description">
            {t('dashboard.settings.payout.description')}
          </p>
          {payoutMissing ? (
            <div className="card" style={{ padding: '16px', borderColor: '#f59e0b' }}>
              <strong>{t('dashboard.settings.payout.requiredTitle')}</strong>
              <p className="form-field__hint" style={{ marginTop: '6px' }}>
                {t('dashboard.settings.payout.requiredMessage')}
              </p>
            </div>
          ) : null}
          <form className="settings-form settings-form--stack" onSubmit={handlePayoutSubmit}>
            <FormField label={t('dashboard.settings.payout.network.label')}>
              <Select
                options={payoutNetworkOptions}
                value={settings.payoutMobileNetwork || ''}
                onChange={value =>
                  setSettings(prev => ({
                    ...prev,
                    payoutMobileNetwork: (value?.toString?.() ?? '') as SettingsState['payoutMobileNetwork']
                  }))
                }
              />
            </FormField>
            <FormField label={t('dashboard.settings.payout.number.label')}>
              <Input
                value={settings.payoutMobileNumber}
                onChange={event =>
                  setSettings(prev => ({
                    ...prev,
                    payoutMobileNumber: event.target.value
                  }))
                }
                placeholder={t('dashboard.settings.payout.number.placeholder')}
              />
            </FormField>
            <FormField label={t('dashboard.settings.payout.name.label')}>
              <Input
                value={settings.payoutMobileName}
                onChange={event =>
                  setSettings(prev => ({
                    ...prev,
                    payoutMobileName: event.target.value
                  }))
                }
                placeholder={t('dashboard.settings.payout.name.placeholder')}
              />
            </FormField>
            <Button type="submit" variant="outline" disabled={payoutSaving}>
              {payoutSaving
                ? t('dashboard.settings.payout.saving')
                : t('dashboard.settings.payout.saveAction')}
            </Button>
          </form>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__head">
            <h2>{t('dashboard.settings.sections.addressBook')}</h2>
            <Button variant="outline" onClick={() => openAddressModal()}>
              {t('dashboard.settings.address.add')}
            </Button>
          </div>
          {addressesLoading ? (
            <div style={{ display: 'grid', gap: '12px' }} aria-hidden>
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} width="100%" height="120px" />
              ))}
            </div>
          ) : addressesError ? (
            <p className="auth-form__error" role="alert">
              {addressesError}
            </p>
          ) : addresses.length ? (
            <div className="address-grid" style={{ display: 'grid', gap: '16px' }}>
              {addresses.map(address => (
                <article
                  key={address.id}
                  className="card address-card"
                  style={{ padding: '16px', display: 'grid', gap: '12px' }}
                >
                  <header
                    className="address-card__header"
                    style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}
                  >
                    <div>
                      <strong>{address.label}</strong>
                      <p>{address.recipientName}</p>
                    </div>
                    <div
                      className="address-card__tags"
                      style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
                    >
                      {address.isDefaultShipping ? (
                        <span className="badge badge--info">
                          {t('dashboard.settings.address.defaultShipping')}
                        </span>
                      ) : null}
                      {address.isDefaultBilling ? (
                        <span className="badge badge--info">
                          {t('dashboard.settings.address.defaultBilling')}
                        </span>
                      ) : null}
                    </div>
                  </header>
                  <div className="address-card__body" style={{ display: 'grid', gap: '4px' }}>
                    <p>{address.line1}</p>
                    {address.line2 ? <p>{address.line2}</p> : null}
                    <p>
                      {address.postalCode} {address.city}
                      {address.state ? `, ${address.state}` : ''}
                    </p>
                    <p>{address.country}</p>
                    {address.phone ? (
                      <p>
                        {t('dashboard.settings.address.phonePrefix')} {address.phone}
                      </p>
                    ) : null}
                  </div>
                  <footer
                    className="address-card__footer"
                    style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}
                  >
                    <Button
                      variant="ghost"
                      onClick={() => openAddressModal(address)}
                      disabled={savingAddress && editingAddressId === address.id}
                    >
                      {t('dashboard.settings.address.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleDeleteAddress(address.id)}
                      disabled={deletingAddressId === address.id}
                    >
                      {deletingAddressId === address.id
                        ? t('dashboard.settings.address.deleting')
                        : t('dashboard.settings.address.delete')}
                    </Button>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <div
              className="address-empty"
              style={{ display: 'grid', gap: '12px', padding: '16px', border: '1px dashed #ced4da', borderRadius: '8px' }}
            >
              <p>{t('dashboard.settings.address.emptyDescription')}</p>
              <Button onClick={() => openAddressModal()}>
                {t('dashboard.settings.address.emptyAction')}
              </Button>
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <h2>{t('dashboard.settings.sections.security')}</h2>
          <div
            className="settings-form"
            style={{ flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}
          >
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordForm(prev => !prev)
                setPasswordError(null)
                if (!showPasswordForm) {
                  resetPasswordFields()
                }
              }}
            >
              {showPasswordForm
                ? t('actions.cancel')
                : t('dashboard.settings.password.toggleShow')}
            </Button>
            {showPasswordForm ? (
              <form
                className="card settings-password-card"
                onSubmit={handleChangePassword}
                style={{ padding: '16px', display: 'grid', gap: '16px', maxWidth: '420px' }}
              >
                <FormField
                  label={t('dashboard.settings.password.currentLabel')}
                  htmlFor="settings-current-password"
                  required
                >
                  <Input
                    id="settings-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={event => setCurrentPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </FormField>
                <FormField
                  label={t('dashboard.settings.password.newLabel')}
                  htmlFor="settings-new-password"
                  required
                  hint={t('dashboard.settings.password.newHint')}
                >
                  <Input
                    id="settings-new-password"
                    type="password"
                    value={newPassword}
                    onChange={event => setNewPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </FormField>
                <FormField
                  label={t('dashboard.settings.password.confirmLabel')}
                  htmlFor="settings-confirm-password"
                  required
                >
                  <Input
                    id="settings-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </FormField>
                {passwordError ? (
                  <p className="auth-form__error" role="alert">
                    {passwordError}
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      resetPasswordFields()
                      setPasswordError(null)
                      setShowPasswordForm(false)
                    }}
                  >
                    {t('actions.cancel')}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? t('dashboard.settings.password.saveLoading') : t('actions.save')}
                  </Button>
                </div>
              </form>
            ) : null}
            <Button
              variant="outline"
              onClick={handleToggleTwoFactor}
              disabled={updatingTwoFactor}
            >
              {settings.enableTwoFactorAuth
                ? t('dashboard.settings.twoFactor.disable')
                : t('dashboard.settings.twoFactor.enable')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowDeactivateModal(true)
              }}
              disabled={isDeactivating}
            >
              {isDeactivating
                ? t('dashboard.settings.deactivate.loading')
                : t('dashboard.settings.deactivate.button')}
            </Button>
          </div>
        </section>

        <section className="dashboard-section">
          <h2>{t('dashboard.settings.sections.notifications')}</h2>
          <div className="settings-form">
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.tipsNotifications}
                  onChange={handleSettingToggle('tipsNotifications')}
                  disabled={updatingSetting === 'tipsNotifications'}
                />
                <span>{t('dashboard.settings.notifications.tips')}</span>
              </div>
            </label>
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.favoritePriceAlerts}
                  onChange={handleSettingToggle('favoritePriceAlerts')}
                  disabled={updatingSetting === 'favoritePriceAlerts'}
                />
                <span>{t('dashboard.settings.notifications.favoritePrice')}</span>
              </div>
            </label>
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.savedSearchAlerts}
                  onChange={handleSettingToggle('savedSearchAlerts')}
                  disabled={updatingSetting === 'savedSearchAlerts'}
                />
                <span>{t('dashboard.settings.notifications.savedSearch')}</span>
              </div>
            </label>
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.moderationAlerts}
                  onChange={handleSettingToggle('moderationAlerts')}
                  disabled={updatingSetting === 'moderationAlerts'}
                />
                <span>{t('dashboard.settings.notifications.moderation')}</span>
              </div>
            </label>
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={settings.systemAlerts}
                  onChange={handleSettingToggle('systemAlerts')}
                  disabled={updatingSetting === 'systemAlerts'}
                />
                <span>{t('dashboard.settings.notifications.system')}</span>
              </div>
            </label>
          </div>
        </section>
      </div>
      <Modal
        open={showAddressModal}
        title={
          editingAddressId
            ? t('dashboard.settings.address.modalTitleEdit')
            : t('dashboard.settings.address.modalTitleAdd')
        }
        onClose={() => {
          if (!savingAddress) {
            setShowAddressModal(false)
            setEditingAddressId(null)
            setAddressForm(getEmptyAddressPayload())
            setAddressError(null)
          }
        }}
      >
        <form
          className="address-form"
          style={{ display: 'grid', gap: '12px' }}
          onSubmit={handleSaveAddress}
        >
          <FormField label={t('dashboard.settings.address.fields.label')} htmlFor="address-label" required>
            <Input
              id="address-label"
              value={addressForm.label}
              onChange={event => handleAddressFieldChange('label', event.target.value)}
              required
            />
          </FormField>
          <FormField
            label={t('dashboard.settings.address.fields.recipient')}
            htmlFor="address-recipient"
            required
          >
            <Input
              id="address-recipient"
              value={addressForm.recipientName}
              onChange={event => handleAddressFieldChange('recipientName', event.target.value)}
              required
            />
          </FormField>
          <FormField label={t('dashboard.settings.address.fields.line1')} htmlFor="address-line1" required>
            <Input
              id="address-line1"
              value={addressForm.line1}
              onChange={event => handleAddressFieldChange('line1', event.target.value)}
              required
            />
          </FormField>
          <FormField label={t('dashboard.settings.address.fields.line2')} htmlFor="address-line2">
            <Input
              id="address-line2"
              value={addressForm.line2 ?? ''}
              onChange={event => handleAddressFieldChange('line2', event.target.value)}
            />
          </FormField>
          <div className="address-form__row" style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <FormField label={t('dashboard.settings.address.fields.city')} htmlFor="address-city" required>
              <Input
                id="address-city"
                value={addressForm.city}
                onChange={event => handleAddressFieldChange('city', event.target.value)}
                required
              />
            </FormField>
            <FormField label={t('dashboard.settings.address.fields.state')} htmlFor="address-state">
              <Input
                id="address-state"
                value={addressForm.state ?? ''}
                onChange={event => handleAddressFieldChange('state', event.target.value)}
              />
            </FormField>
            <FormField
              label={t('dashboard.settings.address.fields.postalCode')}
              htmlFor="address-postal"
              required
            >
              <Input
                id="address-postal"
                value={addressForm.postalCode}
                onChange={event => handleAddressFieldChange('postalCode', event.target.value)}
                required
              />
            </FormField>
          </div>
          <FormField label={t('dashboard.settings.address.fields.country')} htmlFor="address-country" required>
            <Input
              id="address-country"
              value={addressForm.country}
              onChange={event => handleAddressFieldChange('country', event.target.value)}
              required
            />
          </FormField>
          <FormField
            label={t('dashboard.settings.address.fields.phone')}
            htmlFor="address-phone"
            hint={t('dashboard.settings.address.fields.phoneHint')}
          >
            <Input
              id="address-phone"
              value={addressForm.phone ?? ''}
              onChange={event => handleAddressFieldChange('phone', event.target.value)}
            />
          </FormField>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={Boolean(addressForm.isDefaultShipping)}
                  onChange={event => handleAddressFieldChange('isDefaultShipping', event.target.checked)}
                />
                <span>{t('dashboard.settings.address.defaultShippingLabel')}</span>
              </div>
            </label>
            <label className="form-field form-field--inline">
              <div className="form-field__control">
                <input
                  type="checkbox"
                  checked={Boolean(addressForm.isDefaultBilling)}
                  onChange={event => handleAddressFieldChange('isDefaultBilling', event.target.checked)}
                />
                <span>{t('dashboard.settings.address.defaultBillingLabel')}</span>
              </div>
            </label>
          </div>
          {addressError ? (
            <p className="auth-form__error" role="alert">
              {addressError}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!savingAddress) {
                  setShowAddressModal(false)
                  setEditingAddressId(null)
                  setAddressForm(getEmptyAddressPayload())
                  setAddressError(null)
                }
              }}
            >
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={savingAddress}>
              {savingAddress
                ? t('dashboard.settings.address.modalSaving')
                : editingAddressId
                  ? t('dashboard.settings.address.modalSave')
                  : t('dashboard.settings.address.modalAdd')}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={showDeactivateModal}
        title={t('dashboard.settings.deactivate.modalTitle')}
        description={t('dashboard.settings.deactivate.modalDescription')}
        onClose={() => {
          if (!isDeactivating) {
            setShowDeactivateModal(false)
            setDeactivateReason('')
          }
        }}
        footer={
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowDeactivateModal(false)
                setDeactivateReason('')
              }}
              disabled={isDeactivating}
            >
              {t('actions.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDeactivateAccount} disabled={isDeactivating}>
              {isDeactivating
                ? t('dashboard.settings.deactivate.loading')
                : t('dashboard.settings.deactivate.confirm')}
            </Button>
          </div>
        }
      >
        <p style={{ marginBottom: '12px' }}>
          {t('dashboard.settings.deactivate.modalPrompt')}
        </p>
        <textarea
          className="input"
          rows={4}
          placeholder={t('dashboard.settings.deactivate.placeholder')}
          value={deactivateReason}
          onChange={event => setDeactivateReason(event.target.value)}
          disabled={isDeactivating}
        />
      </Modal>
    </DashboardLayout>
  )
}
