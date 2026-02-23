import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import {
  bulkUpdateListingsStatus,
  fetchModerationListings
} from '../../utils/admin-api'
import type { ModerationListing, ModerationFilterOptions } from '../../types/admin'
import type { ListingStatus } from '../../types/listing-status'

type SelectionMap = Record<string, boolean>

const buildListingStatusLabels = (
  t: (key: string, values?: Record<string, string | number>) => string
): Record<ListingStatus, string> => ({
  draft: t('admin.listingsModeration.status.draft'),
  pending: t('admin.listingsModeration.status.pending'),
  published: t('admin.listingsModeration.status.published'),
  rejected: t('admin.listingsModeration.status.rejected'),
  expired: t('admin.listingsModeration.status.expired'),
  archived: t('admin.listingsModeration.status.archived')
})

const buildBulkActions = (
  t: (key: string, values?: Record<string, string | number>) => string
): Array<{ status: ListingStatus; label: string; variant?: 'outline' | 'ghost' | 'danger' }> => [
  { status: 'published', label: t('admin.listingsModeration.bulk.publish'), variant: 'outline' },
  { status: 'rejected', label: t('admin.listingsModeration.bulk.reject'), variant: 'ghost' },
  { status: 'archived', label: t('admin.listingsModeration.bulk.archive'), variant: 'ghost' }
]

export default function ListingsModeration() {
  const { t, locale } = useI18n()
  const localeTag = locale === 'fr' ? 'fr-FR' : 'en-US'
  const listingStatusLabels = useMemo(() => buildListingStatusLabels(t), [t])
  const bulkActions = useMemo(() => buildBulkActions(t), [t])
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }),
    [localeTag]
  )
  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat(localeTag, {
        style: 'currency',
        currency: 'XAF'
      }),
    [localeTag]
  )
  const [listings, setListings] = useState<ModerationListing[]>([])
  const [options, setOptions] = useState<ModerationFilterOptions | null>(null)
  const [filters, setFilters] = useState<{
    categoryId?: string
    status?: ListingStatus
    flagType?: string
  }>({})
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionMap>({})
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 350)
    return () => clearTimeout(timeout)
  }, [search])

  const loadListings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchModerationListings({
        ...filters,
        search: debouncedSearch || undefined
      })
      setListings(response.items)
      setOptions(response.filters)
      setSelection(prev => {
        const next: SelectionMap = {}
        response.items.forEach(item => {
          if (prev[item.id]) {
            next[item.id] = true
          }
        })
        return next
      })
      if (
        response.items.length &&
        !response.items.some(item => item.id === selectedListingId)
      ) {
        setSelectedListingId(response.items[0].id)
      }
      if (!response.items.length) {
        setSelectedListingId(null)
      }
    } catch (err) {
      console.error('Unable to load moderation queue', err)
      const message =
        err instanceof Error
          ? err.message
          : t('admin.listingsModeration.toast.loadErrorMessage')
      setError(message)
      addToast({
        variant: 'error',
        title: t('admin.listingsModeration.toast.loadErrorTitle'),
        message
      })
    } finally {
      setIsLoading(false)
    }
  }, [filters, debouncedSearch, addToast, selectedListingId, t])

  useEffect(() => {
    void loadListings()
  }, [loadListings])

  const selectedListing = useMemo(
    () => listings.find(item => item.id === selectedListingId) ?? null,
    [listings, selectedListingId]
  )

  const selectedIds = useMemo(
    () => Object.keys(selection).filter(id => selection[id]),
    [selection]
  )

  const toggleSelection = (id: string) => {
    setSelection(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const selectAll = () => {
    if (!listings.length) {
      return
    }
    const allSelected = listings.every(item => selection[item.id])
    if (allSelected) {
      setSelection({})
    } else {
      const next: SelectionMap = {}
      listings.forEach(item => {
        next[item.id] = true
      })
      setSelection(next)
    }
  }

  const applyBulkAction = async (status: ListingStatus) => {
    if (!selectedIds.length) {
      return
    }
    setIsBulkProcessing(true)
    try {
      await bulkUpdateListingsStatus({
        listingIds: selectedIds,
        status,
        note: t('admin.listingsModeration.bulk.note', {
          status: listingStatusLabels[status] ?? status
        })
      })
      setSelection({})
      addToast({
        variant: 'success',
        title: t('admin.listingsModeration.toast.bulkSuccessTitle'),
        message: t('admin.listingsModeration.toast.bulkSuccessMessage', { count: selectedIds.length })
      })
      await loadListings()
    } catch (err) {
      console.error('Unable to apply bulk moderation', err)
      addToast({
        variant: 'error',
        title: t('admin.listingsModeration.toast.bulkErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('admin.listingsModeration.toast.bulkErrorMessage')
      })
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handleSingleUpdate = async (listing: ModerationListing, status: ListingStatus) => {
    setUpdatingId(listing.id)
    try {
      await bulkUpdateListingsStatus({
        listingIds: [listing.id],
        status
      })
      addToast({
        variant: 'success',
        title: t('admin.listingsModeration.toast.updateTitle'),
        message:
          status === 'published'
            ? t('admin.listingsModeration.toast.updatePublished')
            : t('admin.listingsModeration.toast.updateStatus', {
                status: listingStatusLabels[status] ?? status
              })
      })
      await loadListings()
    } catch (err) {
      console.error('Unable to update listing status', err)
      addToast({
        variant: 'error',
        title: t('admin.listingsModeration.toast.updateErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('admin.listingsModeration.toast.updateErrorMessage')
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleFilterChange = <Key extends keyof typeof filters>(
    key: Key,
    value: (typeof filters)[Key] | ''
  ) => {
    setFilters(prev => {
      const next = { ...prev }
      if (value === '' || value === 'all') {
        delete next[key]
      } else {
        next[key] = value as (typeof filters)[Key]
      }
      return next
    })
  }

  const flagOptions = useMemo(() => {
    const values = options?.flagReasons ?? []
    return [
      { value: 'all', label: t('admin.listingsModeration.flags.all') },
      { value: 'any', label: t('admin.listingsModeration.flags.any') },
      { value: 'none', label: t('admin.listingsModeration.flags.none') },
      ...values.map(reason => ({
        value: reason,
        label: reason.charAt(0).toUpperCase() + reason.slice(1)
      }))
    ]
  }, [options, t])

  return (
    <AdminLayout>
      <div className="admin-page admin-page--two-columns">
        <section className="admin-page__main">
          <header className="dashboard-header">
            <div>
              <h1>{t('admin.listingsModeration.title')}</h1>
              <p>{t('admin.listingsModeration.subtitle')}</p>
            </div>
            <Button variant="outline">{t('admin.listingsModeration.guide')}</Button>
          </header>

          <div className="admin-card">
            <div className="admin-card__meta" style={{ gap: '16px' }}>
              <strong>
                {listings.length === 1
                  ? t('admin.listingsModeration.count.single', { count: listings.length })
                  : t('admin.listingsModeration.count.multiple', { count: listings.length })}
              </strong>
              <div className="admin-filter-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span className="form-field__label">{t('admin.listingsModeration.filters.category')}</span>
                  <select
                    className="input"
                    value={filters.categoryId ?? ''}
                    onChange={event => handleFilterChange('categoryId', event.target.value)}
                  >
                    <option value="">{t('admin.listingsModeration.filters.categoryAll')}</option>
                    {(options?.categories ?? []).map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="form-field__label">{t('admin.listingsModeration.filters.status')}</span>
                  <select
                    className="input"
                    value={filters.status ?? ''}
                    onChange={event =>
                      handleFilterChange('status', event.target.value as ListingStatus | '')
                    }
                  >
                    <option value="">{t('admin.listingsModeration.filters.statusAll')}</option>
                    {(options?.statuses ?? []).map(status => (
                      <option key={status} value={status}>
                        {listingStatusLabels[status as ListingStatus] ?? status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="form-field__label">{t('admin.listingsModeration.filters.flags')}</span>
                  <select
                    className="input"
                    value={filters.flagType ?? 'all'}
                    onChange={event =>
                      handleFilterChange('flagType', event.target.value)
                    }
                  >
                    {flagOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="form-field__label">{t('admin.listingsModeration.filters.search')}</span>
                  <input
                    className="input"
                    placeholder={t('admin.listingsModeration.filters.searchPlaceholder')}
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                  />
                </div>
              </div>
            </div>

            {selectedIds.length ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 0',
                  borderBottom: '1px solid #e5e7eb'
                }}
              >
                <strong>
                  {selectedIds.length === 1
                    ? t('admin.listingsModeration.selected.single', { count: selectedIds.length })
                    : t('admin.listingsModeration.selected.multiple', { count: selectedIds.length })}
                </strong>
                {bulkActions.map(action => (
                  <Button
                    key={action.status}
                    variant={action.variant ?? 'ghost'}
                    onClick={() => applyBulkAction(action.status)}
                    disabled={isBulkProcessing}
                  >
                    {isBulkProcessing ? t('admin.listingsModeration.processing') : action.label}
                  </Button>
                ))}
                <Button variant="ghost" onClick={() => setSelection({})} disabled={isBulkProcessing}>
                  {t('admin.listingsModeration.clearSelection')}
                </Button>
              </div>
            ) : null}

            {error ? (
              <p className="auth-form__error" role="alert">
                {error}
              </p>
            ) : null}

            {isLoading ? (
              <p style={{ padding: '1rem', color: '#6c757d' }}>
                {t('admin.listingsModeration.loading')}
              </p>
            ) : listings.length ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={
                          listings.length > 0 &&
                          listings.every(listing => selection[listing.id])
                        }
                        onChange={selectAll}
                        aria-label={t('admin.listingsModeration.table.selectAll')}
                      />
                    </th>
                    <th>{t('admin.listingsModeration.table.listing')}</th>
                    <th>{t('admin.listingsModeration.table.seller')}</th>
                    <th>{t('admin.listingsModeration.table.category')}</th>
                    <th>{t('admin.listingsModeration.table.reports')}</th>
                    <th>{t('admin.listingsModeration.table.createdAt')}</th>
                    <th>{t('admin.listingsModeration.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map(listing => {
                    const isSelected = Boolean(selection[listing.id])
                    return (
                      <tr
                        key={listing.id}
                        onClick={() => setSelectedListingId(listing.id)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#f0f4ff' : undefined
                        }}
                      >
                        <td onClick={event => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(listing.id)}
                            aria-label={t('admin.listingsModeration.table.selectOne', { title: listing.title })}
                          />
                        </td>
                        <td>
                          <strong>{listing.title}</strong>
                          <p style={{ color: '#6c757d', fontSize: '0.85rem' }}>
                            {listingStatusLabels[listing.status as ListingStatus] ?? listing.status}
                          </p>
                        </td>
                        <td>
                          {listing.owner
                            ? `${listing.owner.firstName ?? ''} ${listing.owner.lastName ?? ''}`.trim() ||
                              listing.owner.email ||
                              t('admin.listingsModeration.seller.fallback')
                            : t('admin.listingsModeration.seller.unknown')}
                        </td>
                        <td>{listing.category?.name ?? t('admin.listingsModeration.category.unset')}</td>
                        <td>
                          {listing.reportsCount ?? 0}
                          {listing.latestReportAt ? (
                            <p style={{ color: '#6c757d', fontSize: '0.8rem', margin: 0 }}>
                              {t('admin.listingsModeration.report.latest', {
                                date: dateTimeFormatter.format(new Date(listing.latestReportAt))
                              })}
                            </p>
                          ) : null}
                        </td>
                        <td>{dateTimeFormatter.format(new Date(listing.created_at))}</td>
                        <td onClick={event => event.stopPropagation()}>
                          <div className="auth-form__actions" style={{ gap: '8px' }}>
                            {bulkActions.map(action => (
                              <Button
                                key={action.status}
                                variant={action.variant ?? 'ghost'}
                                onClick={() => handleSingleUpdate(listing, action.status)}
                                disabled={updatingId === listing.id || isBulkProcessing}
                              >
                                {updatingId === listing.id
                                  ? t('admin.listingsModeration.processing')
                                  : action.label}
                              </Button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p style={{ padding: '1rem', color: '#6c757d' }}>
                {t('admin.listingsModeration.empty')}
              </p>
            )}
          </div>
        </section>

        <aside className="admin-page__aside">
          <div className="admin-card">
            <div className="admin-card__meta">
              <strong>{t('admin.listingsModeration.preview.title')}</strong>
            </div>
            {selectedListing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h2 style={{ marginBottom: '8px' }}>{selectedListing.title}</h2>
                  <p style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                    {listingStatusLabels[selectedListing.status as ListingStatus] ?? selectedListing.status} •{' '}
                    {selectedListing.category?.name ?? t('admin.listingsModeration.category.unset')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <strong>{priceFormatter.format(Number(selectedListing.price ?? 0))}</strong>
                  <span style={{ color: '#6c757d' }}>
                    {t('admin.listingsModeration.preview.createdAt', {
                      date: dateTimeFormatter.format(new Date(selectedListing.created_at))
                    })}
                  </span>
                </div>
                {selectedListing.images?.length ? (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                    {selectedListing.images.slice(0, 3).map(image => (
                      <img
                        key={image.id}
                        src={image.url}
                        alt={selectedListing.title}
                        style={{
                          width: '100px',
                          height: '80px',
                          objectFit: 'cover',
                          borderRadius: '6px'
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', color: '#6c757d' }}>
                    {t('admin.listingsModeration.preview.images.empty')}
                  </div>
                )}
                <div>
                  <strong>{t('admin.listingsModeration.preview.seller.title')}</strong>
                  <p style={{ color: '#6c757d' }}>
                    {selectedListing.owner
                      ? `${selectedListing.owner.firstName ?? ''} ${selectedListing.owner.lastName ?? ''}`.trim() ||
                        selectedListing.owner.email ||
                        selectedListing.owner.id
                      : t('admin.listingsModeration.preview.seller.empty')}
                  </p>
                </div>
                <div>
                  <strong>
                    {t('admin.listingsModeration.preview.reports.title', {
                      count: selectedListing.reports.length
                    })}
                  </strong>
                  {selectedListing.reports.length ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {selectedListing.reports.map(report => (
                        <li
                          key={report.id}
                          style={{
                            background: '#f8f9fa',
                            borderRadius: '8px',
                            padding: '12px'
                          }}
                        >
                          <p style={{ margin: 0 }}>
                            <strong>{report.reason}</strong>
                            <span style={{ color: '#6c757d', marginLeft: '6px', fontSize: '0.85rem' }}>
                              {dateTimeFormatter.format(new Date(report.created_at))}
                            </span>
                          </p>
                          {report.details ? (
                            <p style={{ marginTop: '6px', color: '#4b5563', whiteSpace: 'pre-wrap' }}>
                              {report.details}
                            </p>
                          ) : null}
                          <p style={{ marginTop: '6px', color: '#6c757d', fontSize: '0.85rem' }}>
                            {report.reporter?.email ?? t('admin.listingsModeration.preview.reports.anonymous')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: '#6c757d', marginTop: '4px' }}>
                      {t('admin.listingsModeration.preview.reports.empty')}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: '#6c757d' }}>
                {t('admin.listingsModeration.preview.noListing')}
              </p>
            )}
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
