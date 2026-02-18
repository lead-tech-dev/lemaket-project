import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { FormField } from '../../components/ui/FormField'
import { Select } from '../../components/ui/Select'
import { apiGet, apiPost } from '../../utils/api'
import type { Listing } from '../../types/listing'
import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentMethod,
  PaymentPromotionOption
} from '../../types/payment'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import {
  getPromotionCategoryPreference,
  setPromotionCategoryPreference,
  getPromotionCheckoutSelection,
  setPromotionCheckoutSelection,
  clearPromotionCheckoutSelection,
  type PromotionCheckoutSelection
} from '../../utils/preferences'

function formatCurrency(amount: number, currency: string, locale: string): string {
  try {
    const options: Intl.NumberFormatOptions = { style: 'currency', currency }
    if (currency === 'XOF' || currency === 'XAF') {
      options.minimumFractionDigits = 0
      options.maximumFractionDigits = 0
    }
    return new Intl.NumberFormat(locale, options).format(amount)
  } catch {
    return `${amount.toLocaleString(locale)} ${currency}`
  }
}

function formatCategory(category: string): string {
  if (!category) {
    return category
  }
  return category.charAt(0).toUpperCase() + category.slice(1)
}

type CheckoutModalProps = {
  open: boolean
  promotion: PaymentPromotionOption | null
  listings: Listing[]
  paymentMethods: PaymentMethod[]
  isLoading: boolean
  isProcessing: boolean
  cachedSelection: PromotionCheckoutSelection | null
  onClose: () => void
  onSelectionChange: (changes: Partial<PromotionCheckoutSelection>) => void
  onSubmit: (payload: { listingId: string; paymentMethodId?: string }) => void
}

function CheckoutModal({
  open,
  promotion,
  listings,
  paymentMethods,
  isLoading,
  isProcessing,
  cachedSelection,
  onClose,
  onSelectionChange,
  onSubmit
}: CheckoutModalProps) {
  const { t, locale } = useI18n()
  const [selectedListing, setSelectedListing] = useState<string>('')
  const [selectedMethod, setSelectedMethod] = useState<string>('')

  useEffect(() => {
    if (!open) {
      setSelectedListing('')
      setSelectedMethod('')
      return
    }

    const preferredListing =
      (cachedSelection?.listingId &&
      listings.some(listing => listing.id === cachedSelection.listingId)
        ? cachedSelection.listingId
        : undefined) ?? listings[0]?.id ?? ''

    const preferredMethod =
      (cachedSelection?.paymentMethodId &&
      paymentMethods.some(method => method.id === cachedSelection.paymentMethodId)
        ? cachedSelection.paymentMethodId
        : undefined) ??
      paymentMethods.find(method => method.isDefault)?.id ??
      paymentMethods[0]?.id ??
      ''

    setSelectedListing(preferredListing)
    setSelectedMethod(preferredMethod)

    if (preferredListing) {
      onSelectionChange({ listingId: preferredListing })
    }
    if (preferredMethod) {
      onSelectionChange({ paymentMethodId: preferredMethod })
    }
  }, [open, cachedSelection, listings, paymentMethods, onSelectionChange])

  const listingOptions = useMemo(
    () => [
      { value: '', label: t('dashboard.promotions.checkout.listingPlaceholder') },
      ...listings.map(listing => ({ value: listing.id, label: listing.title }))
    ],
    [listings, t]
  )

  const methodOptions = useMemo(
    () => [
      { value: '', label: t('dashboard.promotions.checkout.paymentPlaceholder') },
      ...paymentMethods.map(method => {
        const baseLabel =
          method.label ??
          (method.type === 'card'
            ? `${method.brand ?? t('dashboard.promotions.payment.card')} ${
                method.last4 ? `**** ${method.last4}` : ''
              }`.trim()
            : method.type === 'wallet'
              ? t('dashboard.promotions.payment.wallet')
              : method.type === 'transfer'
                ? t('dashboard.promotions.payment.transfer')
                : method.type === 'cash'
                  ? t('dashboard.promotions.payment.cash')
                  : method.type)
        const suffix = method.isDefault ? t('dashboard.promotions.payment.defaultSuffix') : ''
        return {
          value: method.id,
          label: `${baseLabel}${suffix}`.trim()
        }
      })
    ],
    [paymentMethods, t]
  )

  const disableSubmit =
    !promotion ||
    !selectedListing ||
    isLoading ||
    isProcessing ||
    listings.length === 0 ||
    (promotion.price > 0 && !selectedMethod) ||
    (promotion.price > 0 && paymentMethods.length === 0)

  const handleListingChange = (value: string | number) => {
    const next = String(value)
    setSelectedListing(next)
    onSelectionChange({ listingId: next })
  }

  const handleMethodChange = (value: string | number) => {
    const next = String(value)
    setSelectedMethod(next)
    onSelectionChange({ paymentMethodId: next })
  }

  const formattedPrice = promotion
    ? promotion.isIncluded || promotion.price <= 0
      ? t('dashboard.promotions.included')
      : formatCurrency(promotion.price, promotion.currency, locale)
    : null

  return (
    <Modal
      open={open}
      title={t('dashboard.promotions.checkout.title')}
      description={
        promotion && formattedPrice
          ? t('dashboard.promotions.checkout.selectedOption', {
              title: promotion.title,
              price: formattedPrice
            })
          : undefined
      }
      onClose={onClose}
      footer={
        <div className="auth-form__actions" style={{ justifyContent: 'flex-end', gap: '12px' }}>
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
            {t('actions.cancel')}
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                listingId: selectedListing,
                ...(promotion && promotion.price > 0 && selectedMethod
                  ? { paymentMethodId: selectedMethod }
                  : {})
              })
            }
            disabled={disableSubmit}
          >
            {isProcessing
              ? t('dashboard.promotions.checkout.processing')
              : t('dashboard.promotions.checkout.confirm')}
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <p style={{ padding: '1rem', color: '#6c757d' }}>
          {t('dashboard.promotions.checkout.loading')}
        </p>
      ) : (
        <>
          <FormField label={t('dashboard.promotions.checkout.listingLabel')}>
            {listings.length ? (
              <Select
                value={selectedListing}
                onChange={handleListingChange}
                options={listingOptions}
              />
            ) : (
              <div className="card" style={{ padding: '12px' }}>
                <p style={{ marginBottom: '12px' }}>
                  {promotion
                    ? t('dashboard.promotions.checkout.listingEmptyWithCategories', {
                        categories: promotion.categories.map(formatCategory).join(', ')
                      })
                    : t('dashboard.promotions.checkout.listingEmpty')}
                </p>
                <Button variant="outline" onClick={() => window.location.assign('/listings/new')}>
                  {t('dashboard.promotions.checkout.listingCreate')}
                </Button>
              </div>
            )}
          </FormField>

          {promotion && promotion.price > 0 ? (
            <FormField label={t('dashboard.promotions.checkout.paymentLabel')}>
              {paymentMethods.length ? (
                <Select
                  value={selectedMethod}
                  onChange={handleMethodChange}
                  options={methodOptions}
                />
              ) : (
                <div className="card" style={{ padding: '12px' }}>
                  <p style={{ marginBottom: '12px' }}>
                    {t('dashboard.promotions.checkout.paymentEmpty')}
                  </p>
                  <Button variant="outline" onClick={() => window.location.assign('/dashboard/payments')}>
                    {t('dashboard.promotions.checkout.paymentManage')}
                  </Button>
                </div>
              )}
            </FormField>
          ) : null}
        </>
      )}
    </Modal>
  )
}

export default function PromotionsPage() {
  const { t, locale } = useI18n()
  const [promotionOptions, setPromotionOptions] = useState<PaymentPromotionOption[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>(
    () => getPromotionCategoryPreference() ?? 'all'
  )
  const [listings, setListings] = useState<Listing[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [selectedPromotion, setSelectedPromotion] = useState<PaymentPromotionOption | null>(null)
  const [isLoadingCheckoutData, setIsLoadingCheckoutData] = useState(false)
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false)
  const [checkoutSelection, setCheckoutSelection] = useState<PromotionCheckoutSelection | null>(() =>
    getPromotionCheckoutSelection()
  )
  const { addToast } = useToast()

  const persistSelection = useCallback(
    (changes: Partial<PromotionCheckoutSelection>) => {
      setCheckoutSelection(prevState => {
        const base = prevState ?? {}
        const merged = { ...base, ...changes }
        const sanitizedEntries = Object.entries(merged).filter(([, value]) => {
          if (typeof value !== 'string') {
            return false
          }
          return value.trim().length > 0
        })
        const sanitized =
          sanitizedEntries.length > 0
            ? (Object.fromEntries(sanitizedEntries) as PromotionCheckoutSelection)
            : null

        if (sanitized) {
          const sameAsPrev =
            prevState &&
            Object.keys(sanitized).length === Object.keys(prevState).length &&
            Object.entries(sanitized).every(
              ([key, value]) => prevState?.[key as keyof PromotionCheckoutSelection] === value
            )
          if (!sameAsPrev) {
            setPromotionCheckoutSelection(sanitized)
          }
          return sanitized
        }

        if (prevState) {
          clearPromotionCheckoutSelection()
        }
        return null
      })
    },
    [clearPromotionCheckoutSelection, setPromotionCheckoutSelection]
  )

  const fetchPromotionOptions = useCallback(async () => {
    setIsLoadingOptions(true)
    setOptionsError(null)
    try {
      const data = await apiGet<PaymentPromotionOption[]>('/payments/options')
      setPromotionOptions(data)
    } catch (err) {
      console.error('Unable to load promotion options', err)
      const message =
        err instanceof Error
          ? err.message
          : t('dashboard.promotions.toast.loadErrorMessage')
      setOptionsError(message)
      addToast({
        variant: 'error',
        title: t('dashboard.promotions.toast.loadErrorTitle'),
        message
      })
    } finally {
      setIsLoadingOptions(false)
    }
  }, [addToast, t])

  useEffect(() => {
    fetchPromotionOptions()
  }, [fetchPromotionOptions])

  const availableCategories = useMemo(() => {
    const values = new Set<string>()
    promotionOptions.forEach(option => {
      option.categories.forEach(category => {
        if (category.toLowerCase() !== 'all') {
          values.add(category)
        }
      })
    })
    return Array.from(values).sort()
  }, [promotionOptions])

  const filteredPromotions = useMemo(() => {
    if (categoryFilter === 'all') {
      return promotionOptions
    }
    const normalized = categoryFilter.toLowerCase()
    return promotionOptions.filter(option =>
      option.categories.some(category => category.toLowerCase() === 'all') ||
      option.categories.some(category => category.toLowerCase() === normalized)
    )
  }, [promotionOptions, categoryFilter])

  const handleCategoryChange = useCallback((value: string | number) => {
    const next = String(value)
    setCategoryFilter(next)
    setPromotionCategoryPreference(next)
  }, [])

  const handleResetCategory = () => {
    setCategoryFilter('all')
    setPromotionCategoryPreference('all')
  }

  const loadCheckoutData = useCallback(
    async (promotionOverride?: PaymentPromotionOption) => {
      const targetPromotion = promotionOverride ?? selectedPromotion
      setIsLoadingCheckoutData(true)
      try {
        const [listingsData, methodsData] = await Promise.all([
          apiGet<Listing[]>('/listings/me'),
          apiGet<PaymentMethod[]>('/payments/methods')
        ])

        const normalizedCategories =
          targetPromotion?.categories.map(category => category.toLowerCase()) ?? null

        const eligibleListings = normalizedCategories
          ? listingsData.filter(listing =>
              normalizedCategories.includes(listing.category.slug.toLowerCase())
            )
          : listingsData

        setListings(eligibleListings)
        setPaymentMethods(methodsData)

        if (targetPromotion && normalizedCategories && eligibleListings.length === 0) {
          addToast({
            variant: 'info',
            title: t('dashboard.promotions.toast.noEligibleTitle'),
            message: t('dashboard.promotions.toast.noEligibleMessage')
          })
        }

        if (eligibleListings.length > 0) {
          const cachedListingId = checkoutSelection?.listingId
          const listingMatches =
            cachedListingId && eligibleListings.some(listing => listing.id === cachedListingId)
          if (!listingMatches) {
            persistSelection({ listingId: eligibleListings[0].id })
          }
        } else if (checkoutSelection?.listingId) {
          persistSelection({ listingId: '' })
        }

        if (methodsData.length > 0) {
          const cachedMethodId = checkoutSelection?.paymentMethodId
          const methodMatches =
            cachedMethodId && methodsData.some(method => method.id === cachedMethodId)
          if (!methodMatches) {
            const defaultMethod = methodsData.find(method => method.isDefault) ?? methodsData[0]
            if (defaultMethod) {
              persistSelection({ paymentMethodId: defaultMethod.id })
            }
          }
        } else if (checkoutSelection?.paymentMethodId) {
          persistSelection({ paymentMethodId: '' })
        }
      } catch (err) {
        console.error('Unable to prepare checkout data', err)
        const message =
          err instanceof Error
            ? err.message
            : t('dashboard.promotions.toast.checkoutLoadErrorMessage')
        addToast({
          variant: 'error',
          title: t('dashboard.promotions.toast.checkoutLoadErrorTitle'),
          message
        })
      } finally {
        setIsLoadingCheckoutData(false)
      }
    },
    [selectedPromotion, addToast, checkoutSelection, persistSelection, t]
  )

  const handleOpenCheckout = (promotion: PaymentPromotionOption) => {
    setSelectedPromotion(promotion)
    persistSelection({ optionId: promotion.id })
    setIsCheckoutOpen(true)
    loadCheckoutData(promotion)
  }

  const handleCheckoutSubmit = async (payload: { listingId: string; paymentMethodId?: string }) => {
    if (!selectedPromotion) {
      return
    }
    setIsProcessingCheckout(true)
    try {
      const checkoutPayload: CheckoutRequest = {
        listingId: payload.listingId,
        optionId: selectedPromotion.id,
        ...(payload.paymentMethodId ? { paymentMethodId: payload.paymentMethodId } : {})
      }
      const response = await apiPost<CheckoutResult>('/payments/checkout', checkoutPayload)
      persistSelection({
        optionId: selectedPromotion.id,
        listingId: payload.listingId,
        ...(payload.paymentMethodId ? { paymentMethodId: payload.paymentMethodId } : {})
      })
      setIsCheckoutOpen(false)
      if (response?.redirectUrl) {
        addToast({
          variant: 'info',
          title: t('dashboard.promotions.toast.redirectTitle'),
          message: t('dashboard.promotions.toast.redirectMessage')
        })
        window.location.assign(response.redirectUrl)
        return
      }
      addToast({
        variant: 'success',
        title: t('dashboard.promotions.toast.successTitle'),
        message: t('dashboard.promotions.toast.successMessage')
      })
    } catch (err) {
      console.error('Unable to complete checkout', err)
      addToast({
        variant: 'error',
        title: t('dashboard.promotions.toast.checkoutErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.promotions.toast.checkoutErrorMessage')
      })
    } finally {
      setIsProcessingCheckout(false)
    }
  }

  const categorySelectOptions = useMemo(
    () => [
      { value: 'all', label: t('dashboard.promotions.filter.all') },
      ...availableCategories.map(category => ({
        value: category,
        label: formatCategory(category)
      }))
    ],
    [availableCategories, t]
  )

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('dashboard.promotions.title')}</h1>
            <p>{t('dashboard.promotions.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Select
              value={categoryFilter}
              onChange={handleCategoryChange}
              options={categorySelectOptions}
            />
            <Button variant="outline" onClick={fetchPromotionOptions} disabled={isLoadingOptions}>
              {isLoadingOptions ? t('dashboard.promotions.refreshing') : t('actions.refresh')}
            </Button>
          </div>
        </header>

        {optionsError ? (
          <p className="auth-form__error" role="alert">
            {optionsError}
          </p>
        ) : null}

        <div className="dashboard-promotions">
          {optionsError ? (
            <Card className="dashboard-promotion-card">
              <h3>{t('dashboard.promotions.errorTitle')}</h3>
              <p>{optionsError}</p>
              <Button variant="outline" onClick={fetchPromotionOptions} disabled={isLoadingOptions}>
                {t('actions.retry')}
              </Button>
            </Card>
          ) : isLoadingOptions ? (
            <Card className="dashboard-promotion-card">
              <p>{t('dashboard.promotions.loading')}</p>
            </Card>
          ) : filteredPromotions.length === 0 ? (
            <Card className="dashboard-promotion-card">
              <h3>{t('dashboard.promotions.empty.title')}</h3>
              <p>
                {t('dashboard.promotions.empty.description')}
              </p>
              {categoryFilter !== 'all' ? (
                <Button variant="ghost" onClick={handleResetCategory}>
                  {t('dashboard.promotions.empty.resetFilter')}
                </Button>
              ) : (
                <Button variant="outline" onClick={fetchPromotionOptions}>
                  {t('dashboard.promotions.empty.searchAgain')}
                </Button>
              )}
            </Card>
          ) : (
            filteredPromotions.map(promotion => {
              const isLastSelected = checkoutSelection?.optionId === promotion.id
              const categoryLabel = promotion.categories.some(category => category.toLowerCase() === 'all')
                ? t('dashboard.promotions.filter.all')
                : promotion.categories.map(category => formatCategory(category)).join(', ')
              return (
                <Card
                  key={promotion.id}
                  className="dashboard-promotion-card"
                  style={
                    isLastSelected
                      ? {
                          borderColor: '#0d6efd',
                          boxShadow: '0 0 0 2px rgba(13, 110, 253, 0.15)'
                        }
                      : undefined
                  }
                >
                  {isLastSelected ? (
                    <span
                      style={{
                        color: '#0d6efd',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        textTransform: 'uppercase'
                      }}
                    >
                      {t('dashboard.promotions.lastSelected')}
                    </span>
                  ) : null}
                  <h3>{promotion.title}</h3>
                  <p>{promotion.description}</p>
                  <p style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                    {t('dashboard.promotions.eligibleCategories')} {categoryLabel}
                  </p>
                  <strong>
                    {promotion.isIncluded || promotion.price <= 0
                      ? t('dashboard.promotions.included')
                      : formatCurrency(promotion.price, promotion.currency, locale)}
                  </strong>
                  <Button
                    className="dashboard-promotion-card__action"
                    onClick={() => handleOpenCheckout(promotion)}
                  >
                    {t('dashboard.promotions.cta')}
                  </Button>
                </Card>
              )
            })
          )}
        </div>
      </div>
      <CheckoutModal
        open={isCheckoutOpen}
        promotion={selectedPromotion}
        listings={listings}
        paymentMethods={paymentMethods}
        isLoading={isLoadingCheckoutData}
        isProcessing={isProcessingCheckout}
        cachedSelection={checkoutSelection}
        onClose={() => setIsCheckoutOpen(false)}
        onSelectionChange={persistSelection}
        onSubmit={handleCheckoutSubmit}
      />
    </DashboardLayout>
  )
}
