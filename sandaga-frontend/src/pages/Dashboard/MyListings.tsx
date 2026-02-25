import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { apiGet, apiPatch, apiPost } from '../../utils/api'
import type { Listing } from '../../types/listing'
import type { ListingStatus } from '../../types/listing-status'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../contexts/I18nContext'
import { formatListingLocation } from '../../utils/location'

type ListingWithMeta = Listing & {
  lastUpdatedLabel?: string
  favoritesCount?: number
  scheduledAt?: string | null
}

type SortOption =
  | 'updated_desc'
  | 'updated_asc'
  | 'price_asc'
  | 'price_desc'
  | 'views_desc'
  | 'messages_desc'

const STATUS_BADGE: Record<string, string> = {
  published: 'admin-status--approved',
  pending: 'admin-status--pending',
  draft: 'admin-status--pending',
  expired: 'admin-status--rejected',
  rejected: 'admin-status--rejected',
  archived: 'admin-status--rejected'
}

type ActionChipKind = 'renew' | 'archive' | 'promote' | 'duplicate' | 'schedule'

const ACTION_CHIP_STYLES: Record<ActionChipKind, { background: string; shadow: string }> = {
  renew: {
    background: 'linear-gradient(135deg, #10b981, #34d399)',
    shadow: '0 8px 18px rgba(16, 185, 129, 0.25)'
  },
  archive: {
    background: 'linear-gradient(135deg, #64748b, #94a3b8)',
    shadow: '0 8px 18px rgba(100, 116, 139, 0.25)'
  },
  promote: {
    background: 'linear-gradient(135deg, #f97316, #fb923c)',
    shadow: '0 10px 20px rgba(249, 115, 22, 0.35)'
  },
  duplicate: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    shadow: '0 10px 20px rgba(99, 102, 241, 0.35)'
  },
  schedule: {
    background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    shadow: '0 10px 20px rgba(14, 165, 233, 0.35)'
  }
}

type ActionChipButtonProps = {
  kind: ActionChipKind
  icon: string
  label: string
  disabled?: boolean
  onClick: () => void
  size?: 'default' | 'small'
}

const actionChipBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  color: '#ffffff',
  fontWeight: 600,
  border: 'none',
  borderRadius: '999px',
  padding: '8px 18px',
  cursor: 'pointer',
  transition: 'transform 0.18s ease, box-shadow 0.2s ease, opacity 0.18s ease',
  fontSize: '0.92rem',
  letterSpacing: '0.01em'
}

const ActionChipButton = ({ kind, icon, label, disabled, onClick, size = 'default' }: ActionChipButtonProps) => {
  const palette = ACTION_CHIP_STYLES[kind]
  const sizeStyles = size === 'small'
    ? { padding: '6px 14px', fontSize: '0.85rem' }
    : null

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...actionChipBaseStyle,
        ...sizeStyles,
        background: palette.background,
        boxShadow: palette.shadow,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      <span aria-hidden style={{ fontSize: size === 'small' ? '0.95rem' : '1.05rem' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function formatRelativeDate(
  value: string | null | undefined,
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  if (!value) {
    return t('dashboard.listings.date.empty')
  }
  try {
    const date = new Date(value)
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return value
  }
}

function formatDateTime(
  value: string | null | undefined,
  locale: string
) {
  if (!value) {
    return null
  }
  try {
    return new Date(value).toLocaleString(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return value
  }
}

function isValidCameroonMobileNumber(value: string) {
  const normalized = value.replace(/[\s().-]/g, '')
  return /^(\+237|237)?6\d{8}$/.test(normalized)
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function parsePrice(value: string): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function extractFavoritesCount(listing: Listing): number {
  const details = (listing.details ?? {}) as Record<string, unknown>
  if (typeof details.favoritesCount === 'number') {
    return details.favoritesCount
  }
  if (Array.isArray((listing as unknown as { favorites?: unknown[] }).favorites)) {
    return ((listing as unknown as { favorites?: unknown[] }).favorites ?? []).length
  }
  return 0
}

function formatLocationDisplay(
  listing: Listing,
  fallbackLabel: string
): string {
  return formatListingLocation(
    listing.location as any,
    listing.city || fallbackLabel
  )
}

export default function MyListings() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isPro, user } = useAuth()
  const { locale, t } = useI18n()
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const numberFormatter = useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale])

  const [listings, setListings] = useState<ListingWithMeta[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('updated_desc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [scheduleModalListing, setScheduleModalListing] = useState<ListingWithMeta | null>(null)
  const [scheduleModalValue, setScheduleModalValue] = useState('')
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)

  const payoutMissing = useMemo(() => {
    if (!isPro) return false
    const settings = (user?.settings ?? {}) as Record<string, unknown>
    const network = typeof settings.payoutMobileNetwork === 'string' ? settings.payoutMobileNetwork : ''
    const number = typeof settings.payoutMobileNumber === 'string' ? settings.payoutMobileNumber : ''
    return !network || !number.trim() || !isValidCameroonMobileNumber(number)
  }, [isPro, user?.settings])

  const pendingUpdatesRef = useRef<Record<string, number>>({})
  const originalValuesRef = useRef<Record<string, ListingWithMeta>>({})

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiGet<Listing[]>('/listings/me', { signal: controller.signal })
      .then(data => {
        if (!active) return
        setListings(
          data.map(listing => ({
            ...listing,
            lastUpdatedLabel: formatRelativeDate(listing.updatedAt, numberLocale, t),
            favoritesCount: extractFavoritesCount(listing),
            scheduledAt:
              typeof (listing.details as Record<string, unknown> | undefined)?.scheduledAt === 'string'
                ? ((listing.details as Record<string, unknown>)?.scheduledAt as string)
                : null
          }))
        )
      })
      .catch(err => {
        if (!active) return
        console.error('Unable to load listings', err)
        setError(
          err instanceof Error
            ? err.message
            : t('dashboard.listings.loadError')
        )
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [numberLocale, t])

  const summary = useMemo(() => {
    const total = listings.length
    const published = listings.filter(listing => listing.status === 'published').length
    const pending = listings.filter(listing => listing.status === 'pending').length
    const drafts = listings.filter(listing => listing.status === 'draft').length

    return { total, published, pending, drafts }
  }, [listings])

  const statusOptions = useMemo(
    () => [
      { value: 'draft', label: t('dashboard.listings.status.draft') },
      { value: 'pending', label: t('dashboard.listings.status.pending') },
      { value: 'published', label: t('dashboard.listings.status.published') },
      { value: 'archived', label: t('dashboard.listings.status.archived') },
      { value: 'expired', label: t('dashboard.listings.status.expired') },
      { value: 'rejected', label: t('dashboard.listings.status.rejected') }
    ],
    [t]
  )

  const statusLabels = useMemo(
    () => ({
      draft: t('dashboard.listings.status.draft'),
      pending: t('dashboard.listings.status.pending'),
      published: t('dashboard.listings.status.published'),
      rejected: t('dashboard.listings.status.rejected'),
      expired: t('dashboard.listings.status.expired'),
      archived: t('dashboard.listings.status.archived')
    }),
    [t]
  )

  const sortOptions = useMemo(() => {
    const base = [
      { value: 'updated_desc', label: t('dashboard.listings.sort.updatedDesc') },
      { value: 'updated_asc', label: t('dashboard.listings.sort.updatedAsc') },
      { value: 'price_asc', label: t('dashboard.listings.sort.priceAsc') },
      { value: 'price_desc', label: t('dashboard.listings.sort.priceDesc') }
    ]

    if (isPro) {
      base.push(
        { value: 'views_desc', label: t('dashboard.listings.sort.viewsDesc') },
        { value: 'messages_desc', label: t('dashboard.listings.sort.messagesDesc') }
      )
    }

    return base
  }, [t, isPro])

  useEffect(() => {
    if (!isPro && (sortOption === 'views_desc' || sortOption === 'messages_desc')) {
      setSortOption('updated_desc')
    }
  }, [isPro, sortOption])

  const filteredListings = useMemo(() => {
    if (!search.trim()) {
      return listings
    }
    const value = search.trim().toLowerCase()
    return listings.filter(listing => {
      const loc = listing.location as any
      const city = loc && typeof loc === 'object' && typeof loc.city === 'string' ? loc.city : listing.city
      const zipcode = loc && typeof loc === 'object' && typeof loc.zipcode === 'string' ? loc.zipcode : ''
      const address = loc && typeof loc === 'object' && typeof loc.address === 'string' ? loc.address : ''
      const locString = [address, city, zipcode].filter(Boolean).join(' ')
      return [listing.title, city, locString, listing.category?.name]
        .filter(Boolean)
        .some(item => item!.toString().toLowerCase().includes(value))
    })
  }, [listings, search])

  const sortedListings = useMemo(() => {
    const next = [...filteredListings]
    switch (sortOption) {
      case 'updated_asc':
        next.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        break
      case 'price_asc':
        next.sort((a, b) => parsePrice(a.price) - parsePrice(b.price))
        break
      case 'price_desc':
        next.sort((a, b) => parsePrice(b.price) - parsePrice(a.price))
        break
      case 'views_desc':
        next.sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
        break
      case 'messages_desc':
        next.sort((a, b) => (b.messagesCount ?? 0) - (a.messagesCount ?? 0))
        break
      case 'updated_desc':
      default:
        next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
    }
    return next
  }, [filteredListings, sortOption])

  const isAllSelected = sortedListings.length > 0 && selectedIds.length === sortedListings.length

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(sortedListings.map(listing => listing.id))
    } else {
      setSelectedIds([])
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const queueUpdate = useCallback(
    (id: string, updates: Partial<Listing>) => {
      setListings(prev => {
        const current = prev.find(item => item.id === id)
        if (current && !originalValuesRef.current[id]) {
          originalValuesRef.current[id] = { ...current }
        }
        return prev.map(item =>
          item.id === id
            ? {
                ...item,
                ...updates,
                lastUpdatedLabel: formatRelativeDate(new Date().toISOString(), numberLocale, t)
              }
            : item
        )
      })

      if (pendingUpdatesRef.current[id]) {
        window.clearTimeout(pendingUpdatesRef.current[id])
      }

      pendingUpdatesRef.current[id] = window.setTimeout(async () => {
        try {
          await apiPatch(`/listings/${id}`, updates)
        } catch (err) {
          console.error('Unable to save inline edit', err)
          const fallback = originalValuesRef.current[id]
          if (fallback) {
            setListings(prev =>
              prev.map(item => (item.id === id ? fallback : item))
            )
          }
          addToast({
            variant: 'error',
            title: t('dashboard.listings.inlineSaveTitle'),
            message:
              err instanceof Error
                ? err.message
                : t('dashboard.listings.inlineSaveError')
          })
        } finally {
          delete pendingUpdatesRef.current[id]
          delete originalValuesRef.current[id]
        }
      }, 600)
    },
    [addToast, numberLocale, t]
  )

  const handleInlineFieldChange = (
    listingId: string,
    field: keyof Listing,
    value: string
  ) => {
    queueUpdate(listingId, { [field]: value } as Partial<Listing>)
  }

  const handleStatusChange = async (listingId: string, nextStatus: ListingStatus) => {
    setUpdatingStatusId(listingId)
    try {
      await apiPatch(`/listings/${listingId}`, { status: nextStatus })
      setListings(prev =>
        prev.map(item =>
          item.id === listingId
            ? {
                ...item,
                status: nextStatus,
                lastUpdatedLabel: formatRelativeDate(new Date().toISOString(), numberLocale, t)
              }
            : item
        )
      )
      addToast({
        variant: 'success',
        title: t('dashboard.listings.statusUpdatedTitle'),
        message: t('dashboard.listings.statusUpdatedMessage', {
          status: statusLabels[nextStatus] ?? nextStatus
        })
      })
    } catch (err) {
      console.error('Unable to update status', err)
      addToast({
        variant: 'error',
        title: t('dashboard.listings.statusUpdateErrorTitle'),
        message:
          err instanceof Error ? err.message : t('dashboard.listings.statusUpdateErrorMessage')
      })
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const performBulkStatusUpdate = async (
    status: ListingStatus,
    successMessage: string
  ) => {
    if (!selectedIds.length) {
      return
    }

    setBulkLoading(true)
    try {
      await Promise.all(
        selectedIds.map(id => apiPatch(`/listings/${id}`, { status }))
      )
      setListings(prev =>
        prev.map(item =>
          selectedIds.includes(item.id)
            ? {
                ...item,
                status,
                lastUpdatedLabel: formatRelativeDate(new Date().toISOString(), numberLocale, t)
              }
            : item
        )
      )
      addToast({
        variant: 'success',
        title: t('dashboard.listings.bulkUpdatedTitle'),
        message: successMessage
      })
      setSelectedIds([])
    } catch (err) {
      console.error('Unable to update listings', err)
      addToast({
        variant: 'error',
        title: t('dashboard.listings.bulkErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.listings.bulkErrorMessage')
      })
    } finally {
      setBulkLoading(false)
    }
  }

  const handleDuplicateListing = async (listingId: string) => {
    try {
      const details = await apiGet<Listing>(`/listings/${listingId}`)
      const payload = {
        categoryId: details.category?.id,
        title: `Copie de ${details.title}`.slice(0, 255),
        description: details.description,
        price: details.price,
        currency: details.currency,
        city: details.city,
        location: details.location,
        tag: details.tag ?? undefined,
        surface: details.surface ?? undefined,
        rooms: details.rooms ?? undefined,
        highlights: details.highlights ?? [],
        equipments: details.equipments ?? [],
        details: details.details ?? {},
        status: 'draft' as ListingStatus,
        images: (details.images ?? []).slice(0, 8).map((image, index) => ({
          url: image.url,
          position: index,
          isCover: image.isCover ?? index === 0
        }))
      }

      const duplicate = await apiPost<Listing>('/listings', payload)
      addToast({
        variant: 'success',
        title: t('dashboard.listings.duplicateTitle'),
        message: t('dashboard.listings.duplicateMessage')
      })
      navigate(`/listings/edit/${duplicate.id}`)
    } catch (err) {
      console.error('Unable to duplicate listing', err)
      addToast({
        variant: 'error',
        title: t('dashboard.listings.duplicateErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.listings.duplicateErrorMessage')
      })
    }
  }

  const openScheduleModal = (listing: ListingWithMeta) => {
    setScheduleModalListing(listing)
    setScheduleModalValue(toDateTimeLocalValue(listing.scheduledAt))
  }

  const closeScheduleModal = (force = false) => {
    if (isSavingSchedule && !force) {
      return
    }
    setScheduleModalListing(null)
    setScheduleModalValue('')
  }

  const handleScheduleListing = async () => {
    if (!scheduleModalListing || isSavingSchedule) {
      return
    }

    const trimmed = scheduleModalValue.trim()
    const listing = scheduleModalListing
    const details = { ...(listing.details ?? {}) } as Record<string, unknown>
    let scheduledAt: string | null = null

    if (trimmed) {
      const normalized = trimmed.replace(' ', 'T')
      const date = new Date(normalized)
      if (Number.isNaN(date.getTime())) {
        addToast({
          variant: 'error',
          title: t('dashboard.listings.schedule.invalidTitle'),
          message: t('dashboard.listings.schedule.invalidMessage')
        })
        return
      }
      scheduledAt = date.toISOString()
      details.scheduledAt = scheduledAt
    } else {
      delete details.scheduledAt
    }

    setIsSavingSchedule(true)
    try {
      await apiPatch(`/listings/${listing.id}`, { details })
      setListings(prev =>
        prev.map(item =>
          item.id === listing.id
            ? { ...item, details, scheduledAt }
            : item
        )
      )
      addToast({
        variant: 'success',
        title: t('dashboard.listings.schedule.updatedTitle'),
        message: scheduledAt
          ? t('dashboard.listings.schedule.updatedMessageScheduled')
          : t('dashboard.listings.schedule.updatedMessageRemoved')
      })
      closeScheduleModal(true)
    } catch (err) {
      console.error('Unable to schedule listing', err)
      addToast({
        variant: 'error',
        title: t('dashboard.listings.schedule.errorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.listings.schedule.errorMessage')
      })
    } finally {
      setIsSavingSchedule(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('dashboard.listings.title')}</h1>
            <p>
              {t('dashboard.listings.subtitle')}
              {summary.total
                ? ` ${summary.published === 1
                    ? t('dashboard.listings.summary.single', {
                        count: numberFormatter.format(summary.published)
                      })
                    : t('dashboard.listings.summary.multiple', {
                        count: numberFormatter.format(summary.published)
                      })}`
                : ''}
            </p>
          </div>
          <Button
            onClick={() => {
              navigate('/listings/new')
            }}
          >
            {t('dashboard.listings.cta.publish')}
          </Button>
        </header>

        <section className="dashboard-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <input
              className="input"
              placeholder={t('dashboard.listings.search.placeholder')}
              value={search}
              onChange={event => setSearch(event.target.value)}
              style={{ flex: '1 1 260px' }}
            />
            <Select
              value={sortOption}
              onChange={value => setSortOption(value as SortOption)}
              options={sortOptions}
              label={t('dashboard.listings.sort.label')}
            />
          </div>

          {!isPro ? (
            <div
              className="card"
              style={{
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <strong>{t('dashboard.listings.proCallout.title')}</strong>
                <p style={{ margin: '6px 0 0', color: '#6c757d' }}>
                  {t('dashboard.listings.proCallout.body')}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  navigate('/dashboard/pro')
                }}
              >
                {t('dashboard.listings.proCallout.cta')}
              </Button>
            </div>
          ) : null}

          {selectedIds.length ? (
            <div
              className="card"
              style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                justifyContent: 'space-between'
              }}
            >
              <span>
                {selectedIds.length === 1
                  ? t('dashboard.listings.bulk.selectedSingle', {
                      count: numberFormatter.format(selectedIds.length)
                    })
                  : t('dashboard.listings.bulk.selectedMultiple', {
                      count: numberFormatter.format(selectedIds.length)
                    })}
              </span>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <ActionChipButton
                  kind="renew"
                  icon="↻"
                  label={t('dashboard.listings.bulk.renew')}
                  disabled={bulkLoading}
                  onClick={() =>
                    performBulkStatusUpdate(
                      'published',
                      t('dashboard.listings.bulk.renewSuccess')
                    )
                  }
                />
                <ActionChipButton
                  kind="archive"
                  icon="🗃️"
                  label={t('dashboard.listings.bulk.archive')}
                  disabled={bulkLoading}
                  onClick={() =>
                    performBulkStatusUpdate(
                      'archived',
                      t('dashboard.listings.bulk.archiveSuccess')
                    )
                  }
                />
                {isPro ? (
                  <ActionChipButton
                    kind="promote"
                    icon="🚀"
                    label={t('dashboard.listings.bulk.promote')}
                    disabled={bulkLoading || selectedIds.length !== 1}
                    onClick={() => {
                      if (selectedIds.length === 1) {
                        navigate(`/dashboard/promotions?listingId=${selectedIds[0]}`)
                      } else {
                        addToast({
                          variant: 'info',
                          title: t('dashboard.listings.bulk.promoteTitle'),
                          message: t('dashboard.listings.bulk.promoteMessage')
                        })
                      }
                    }}
                  />
                ) : null}
                <ActionChipButton
                  kind="duplicate"
                  icon="⎘"
                  label={t('dashboard.listings.bulk.duplicate')}
                  disabled={bulkLoading || selectedIds.length !== 1}
                  onClick={() => {
                    if (selectedIds.length === 1) {
                      void handleDuplicateListing(selectedIds[0])
                    }
                  }}
                />
              </div>
            </div>
          ) : null}
        </section>

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p style={{ padding: '1.5rem 0', color: '#6c757d' }}>
            {t('dashboard.listings.loading')}
          </p>
        ) : null}

        {!isLoading && listings.length === 0 ? (
          <section className="dashboard-section">
            <div className="card" style={{ padding: '24px' }}>
              <h2>{t('dashboard.listings.empty.title')}</h2>
              <p>
                {t('dashboard.listings.empty.description')}
              </p>
              <Button
                onClick={() => {
                  navigate('/listings/new')
                }}
              >
                {t('dashboard.listings.empty.cta')}
              </Button>
            </div>
          </section>
        ) : null}

        {sortedListings.length ? (
          <section className="dashboard-section">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={t('dashboard.listings.table.selectAll')}
                      checked={isAllSelected}
                      onChange={event => toggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <th>{t('dashboard.listings.table.listing')}</th>
                  <th>{t('dashboard.listings.table.status')}</th>
                  <th>
                    {isPro
                      ? t('dashboard.listings.table.performance')
                      : t('dashboard.listings.table.price')}
                  </th>
                  <th>{t('dashboard.listings.table.schedule')}</th>
                  <th>{t('dashboard.listings.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedListings.map(listing => {
                  const statusLabel = statusLabels[listing.status] ?? listing.status
                  const badgeClass = STATUS_BADGE[listing.status] ?? 'admin-status--pending'
                  const scheduledLabel = formatDateTime(listing.scheduledAt, numberLocale)
                  return (
                    <tr key={listing.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={t('dashboard.listings.table.selectOne', { title: listing.title })}
                          checked={selectedIds.includes(listing.id)}
                          onChange={() => toggleSelect(listing.id)}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input
                            className="input"
                            value={listing.title}
                            onChange={event =>
                              handleInlineFieldChange(listing.id, 'title', event.target.value.slice(0, 255))
                            }
                          />
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                              {formatLocationDisplay(listing, t('dashboard.listings.locationUnavailable'))} · {listing.category?.name ?? t('dashboard.listings.categoryUnknown')}
                            </span>
                            {payoutMissing ? (
                              <span className="lbc-header__badge lbc-header__badge--alert">
                                {t('dashboard.listings.payoutRequired')}
                              </span>
                            ) : null}
                            <ActionChipButton
                              kind="duplicate"
                              icon="⎘"
                              label={t('dashboard.listings.action.duplicate')}
                              size="small"
                              onClick={() => void handleDuplicateListing(listing.id)}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span className={`admin-status ${badgeClass}`}>{statusLabel}</span>
                          <Select
                            value={listing.status}
                            onChange={value => handleStatusChange(listing.id, value as ListingStatus)}
                            options={statusOptions}
                            disabled={updatingStatusId === listing.id}
                          />
                        </div>
                      </td>
                      <td>
                        {isPro ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.9rem' }}>
                            <span>
                              <strong>{numberFormatter.format(listing.views ?? 0)}</strong> {t('dashboard.listings.performance.views')}
                            </span>
                            <span>
                              <strong>{numberFormatter.format(listing.messagesCount ?? 0)}</strong> {t('dashboard.listings.performance.messages')}
                            </span>
                            <span>
                              <strong>{numberFormatter.format(listing.favoritesCount ?? 0)}</strong> {t('dashboard.listings.performance.favorites')}
                            </span>
                            <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span>{t('dashboard.listings.performance.priceLabel')}</span>
                              <input
                                className="input"
                                style={{ width: '120px' }}
                                value={listing.price}
                                onChange={event =>
                                  handleInlineFieldChange(listing.id, 'price', event.target.value.replace(/[^\d.,]/g, ''))
                                }
                              />
                            </label>
                          </div>
                        ) : (
                          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span>{t('dashboard.listings.performance.priceLabel')}</span>
                            <input
                              className="input"
                              style={{ width: '140px' }}
                              value={listing.price}
                              onChange={event =>
                                handleInlineFieldChange(listing.id, 'price', event.target.value.replace(/[^\d.,]/g, ''))
                              }
                            />
                          </label>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {scheduledLabel ? (
                            <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                              {t('dashboard.listings.schedule.scheduled', { date: scheduledLabel })}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                              {t('dashboard.listings.schedule.notScheduled')}
                            </span>
                          )}
                          <ActionChipButton
                            kind="schedule"
                            icon="🗓️"
                            label={scheduledLabel ? t('dashboard.listings.schedule.edit') : t('dashboard.listings.schedule.set')}
                            size="small"
                            onClick={() => openScheduleModal(listing)}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="auth-form__actions" style={{ gap: '12px', flexWrap: 'wrap' }}>
                          <Link
                            to={`/listing/${listing.id}`}
                            className="lbc-link"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <span aria-hidden style={{ fontSize: '1rem' }}>👁️</span>
                            <span>Voir</span>
                          </Link>
                          <Link
                            to={`/listings/edit/${listing.id}`}
                            className="lbc-link"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <span aria-hidden style={{ fontSize: '1rem' }}>✏️</span>
                            <span>{t('dashboard.listings.action.edit')}</span>
                          </Link>
                          {isPro ? (
                            <ActionChipButton
                              kind="promote"
                              icon="🚀"
                              label={t('dashboard.listings.action.promote')}
                              size="small"
                              onClick={() => navigate(`/dashboard/promotions?listingId=${listing.id}`)}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        ) : !isLoading ? (
          <p style={{ padding: '1rem', color: '#6c757d' }}>
            {t('dashboard.listings.search.empty')}
          </p>
        ) : null}

        <Modal
          open={Boolean(scheduleModalListing)}
          onClose={() => closeScheduleModal()}
          title={t('dashboard.listings.schedule.modalTitle')}
          description={t('dashboard.listings.schedule.modalDescription')}
          footer={
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setScheduleModalValue('')}
                disabled={isSavingSchedule}
              >
                {t('actions.remove')}
              </Button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button type="button" variant="ghost" onClick={() => closeScheduleModal()} disabled={isSavingSchedule}>
                  {t('actions.cancel')}
                </Button>
                <Button type="button" onClick={() => void handleScheduleListing()} disabled={isSavingSchedule}>
                  {isSavingSchedule ? t('actions.saving') : t('actions.save')}
                </Button>
              </div>
            </div>
          }
        >
          <label htmlFor="schedule-date-time" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontWeight: 600 }}>{t('dashboard.listings.schedule.fieldLabel')}</span>
            <input
              id="schedule-date-time"
              type="datetime-local"
              className="input"
              value={scheduleModalValue}
              onChange={event => setScheduleModalValue(event.target.value)}
              disabled={isSavingSchedule}
            />
          </label>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
