import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { apiGet, apiPatch } from '../../utils/api'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import type { Report, ReportStatus } from '../../types/report'
import type { Paginated } from '../../types/pagination'
import type { AuditEvent } from '../../types/admin'
import { fetchAuditTrail } from '../../utils/admin-api'
import { useExportJob } from '../../hooks/useExportJob'

const buildStatusOptions = (
  t: (key: string, values?: Record<string, string | number>) => string
): Array<{ value: ReportStatus | 'all'; label: string }> => [
  { value: 'all', label: t('admin.reports.filter.all') },
  { value: 'open', label: t('admin.reports.status.open') },
  { value: 'in_review', label: t('admin.reports.status.inReview') },
  { value: 'resolved', label: t('admin.reports.status.resolved') },
  { value: 'dismissed', label: t('admin.reports.status.dismissed') }
]

const buildStatusLabels = (
  t: (key: string, values?: Record<string, string | number>) => string
): Record<ReportStatus, string> => ({
  open: t('admin.reports.status.open'),
  in_review: t('admin.reports.status.inReview'),
  resolved: t('admin.reports.status.resolved'),
  dismissed: t('admin.reports.status.dismissed')
})

const STATUS_BADGE: Record<ReportStatus, string> = {
  open: 'admin-status--pending',
  in_review: 'admin-status--pending',
  resolved: 'admin-status--approved',
  dismissed: 'admin-status--rejected'
}

const PAGE_SIZE = 20

export default function Reports() {
  const { t, locale } = useI18n()
  const localeTag = locale === 'fr' ? 'fr-FR' : 'en-US'
  const statusOptions = useMemo(() => buildStatusOptions(t), [t])
  const statusLabels = useMemo(() => buildStatusLabels(t), [t])
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }),
    [localeTag]
  )
  const [reports, setReports] = useState<Report[]>([])
  const [filter, setFilter] = useState<ReportStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [isAuditLoading, setIsAuditLoading] = useState(false)
  const { addToast } = useToast()
  const { startExport, isRunning: isExportRunning, progress: exportProgress } = useExportJob('reports', {
    onStart: () =>
      addToast({
        variant: 'info',
        title: t('admin.reports.export.startTitle'),
        message: t('admin.reports.export.startMessage')
      }),
    onDownload: filename =>
      addToast({
        variant: 'success',
        title: t('admin.reports.export.doneTitle'),
        message: t('admin.reports.export.doneMessage', { filename })
      }),
    onError: message =>
      addToast({
        variant: 'error',
        title: t('admin.reports.export.errorTitle'),
        message
      })
  })

  const loadReports = useCallback(
    async (status: ReportStatus | 'all', targetPage: number) => {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('page', String(targetPage))
      params.set('limit', String(PAGE_SIZE))
      if (status !== 'all') {
        params.set('status', status)
      }

      try {
        const response = await apiGet<Paginated<Report>>(`/reports?${params.toString()}`)
        setReports(response.data)
        setPage(response.page)
        setTotal(response.total)
      } catch (err) {
        console.error('Unable to load reports', err)
      setError(
        err instanceof Error
          ? err.message
          : t('admin.reports.loadError')
      )
    } finally {
      setIsLoading(false)
    }
  },
    [t]
  )

  useEffect(() => {
    void loadReports(filter, 1)
  }, [filter, loadReports])

  useEffect(() => {
    if (selectedReport && !reports.some(report => report.id === selectedReport.id)) {
      setSelectedReport(null)
      setResolutionNotes('')
    }
  }, [reports, selectedReport])

  const loadAudit = useCallback(async (reportId: string) => {
    setIsAuditLoading(true)
    try {
      const events = await fetchAuditTrail('reports', reportId, 10)
      setAuditEvents(events)
    } catch (err) {
      console.error('Unable to load report audit trail', err)
    } finally {
      setIsAuditLoading(false)
    }
  }, [])

  useEffect(() => {
    const reportId = selectedReport?.id
    if (reportId) {
      void loadAudit(reportId)
    } else {
      setAuditEvents([])
    }
  }, [selectedReport?.id, loadAudit])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSelectReport = (report: Report) => {
    setSelectedReport(report)
    setResolutionNotes(report.resolutionNotes ?? '')
  }

  const handleStatusChange = async (report: Report, status: ReportStatus) => {
    setUpdatingId(report.id)
    try {
      const updated = await apiPatch<Report>(`/reports/${report.id}`, {
        status,
        resolutionNotes: report.resolutionNotes
      })
      setReports(prev => prev.map(item => (item.id === report.id ? updated : item)))
      if (selectedReport?.id === report.id) {
        setSelectedReport(updated)
        setResolutionNotes(updated.resolutionNotes ?? '')
      }
      addToast({
        variant: 'success',
        title: t('admin.reports.toast.statusUpdatedTitle'),
        message: t('admin.reports.toast.statusUpdatedMessage', {
          status: statusLabels[updated.status]
        })
      })
      void loadAudit(report.id)
    } catch (err) {
      console.error('Unable to update report status', err)
      addToast({
        variant: 'error',
        title: t('admin.reports.toast.statusErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('admin.reports.toast.statusErrorMessage')
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleUpdateNotes = async () => {
    if (!selectedReport) {
      return
    }
    setUpdatingId(selectedReport.id)
    try {
      const updated = await apiPatch<Report>(`/reports/${selectedReport.id}`, {
        status: selectedReport.status,
        resolutionNotes: resolutionNotes.trim() || undefined
      })
      setReports(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      setSelectedReport(updated)
      addToast({
        variant: 'success',
        title: t('admin.reports.toast.notesSavedTitle'),
        message: t('admin.reports.toast.notesSavedMessage')
      })
      void loadAudit(updated.id)
    } catch (err) {
      console.error('Unable to update resolution notes', err)
      addToast({
        variant: 'error',
        title: t('admin.reports.toast.notesErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('admin.reports.toast.notesErrorMessage')
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const handlePageChange = (direction: 'prev' | 'next') => {
    const targetPage = direction === 'prev' ? Math.max(1, page - 1) : Math.min(totalPages, page + 1)
    if (targetPage !== page) {
      void loadReports(filter, targetPage)
    }
  }

  const reportList = useMemo(() => reports, [reports])

  return (
    <AdminLayout>
      <div className="admin-page admin-page--two-columns">
        <section className="admin-page__main">
          <header className="dashboard-header">
            <div>
              <h1>{t('admin.reports.title')}</h1>
              <p>{t('admin.reports.subtitle')}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                variant="outline"
                onClick={() => startExport('csv')}
                disabled={isExportRunning}
              >
                {t('admin.reports.export.csv')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => startExport('xlsx')}
                disabled={isExportRunning}
              >
                {t('admin.reports.export.xlsx')}
              </Button>
              {isExportRunning ? (
                <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>
                  {t('admin.reports.export.progress', { progress: exportProgress })}
                </span>
              ) : null}
            </div>
          </header>

          <div className="admin-card">
            <div className="admin-card__meta">
              <strong>
                {total === 1
                  ? t('admin.reports.count.single', { count: total })
                  : t('admin.reports.count.multiple', { count: total })}
              </strong>
              <Select
                value={filter}
                onChange={value => setFilter(value as ReportStatus | 'all')}
                options={statusOptions}
              />
            </div>

            {error ? (
              <p className="auth-form__error" role="alert">
                {error}
              </p>
            ) : null}

            {isLoading ? (
              <p style={{ padding: '1rem', color: '#6c757d' }}>
                {t('admin.reports.loading')}
              </p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('admin.reports.table.id')}</th>
                    <th>{t('admin.reports.table.listing')}</th>
                    <th>{t('admin.reports.table.reason')}</th>
                    <th>{t('admin.reports.table.reporter')}</th>
                    <th>{t('admin.reports.table.date')}</th>
                    <th>{t('admin.reports.table.status')}</th>
                    <th>{t('admin.reports.table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reportList.map(report => (
                    <tr key={report.id}>
                      <td>{report.id}</td>
                      <td>{report.listing?.title ?? report.listingId}</td>
                      <td>{report.reason}</td>
                      <td>
                        {report.reporter
                          ? `${report.reporter.firstName ?? ''} ${report.reporter.lastName ?? ''}`.trim() ||
                            report.reporter.email ||
                            t('admin.reports.reporter.fallback')
                          : report.contactEmail ?? t('admin.reports.reporter.anonymous')}
                      </td>
                      <td>{dateTimeFormatter.format(new Date(report.created_at))}</td>
                      <td>
                        <span className={`admin-status ${STATUS_BADGE[report.status]}`}>
                          {statusLabels[report.status]}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <Select
                            value={report.status}
                            onChange={value => handleStatusChange(report, value as ReportStatus)}
                            options={statusOptions.filter(option => option.value !== 'all') as Array<{
                              value: ReportStatus
                              label: string
                            }>}
                            disabled={updatingId === report.id}
                          />
                          <Button
                            variant="ghost"
                            onClick={() => handleSelectReport(report)}
                          >
                            {t('admin.reports.action.review')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
              <Button
                variant="ghost"
                onClick={() => handlePageChange('prev')}
                disabled={page <= 1 || isLoading}
              >
                {t('admin.reports.pagination.prev')}
              </Button>
              <span style={{ alignSelf: 'center', color: '#6c757d' }}>
                {t('admin.reports.pagination.label', { page, total: totalPages })}
              </span>
              <Button
                variant="ghost"
                onClick={() => handlePageChange('next')}
                disabled={page >= totalPages || isLoading}
              >
                {t('admin.reports.pagination.next')}
              </Button>
            </div>
          </div>
        </section>

        <aside className="admin-page__aside">
          <div className="admin-card">
            <div className="admin-card__meta">
              <strong>{t('admin.reports.details.title')}</strong>
            </div>
            {selectedReport ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <h3>{selectedReport.listing?.title ?? selectedReport.listingId}</h3>
                  <p style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                    {t('admin.reports.details.reportedAt', {
                      date: dateTimeFormatter.format(new Date(selectedReport.created_at))
                    })}
                  </p>
                </div>
                <div>
                  <strong>{t('admin.reports.details.reason')}</strong>
                  <p>{selectedReport.reason}</p>
                </div>
                {selectedReport.details ? (
                  <div>
                    <strong>{t('admin.reports.details.details')}</strong>
                    <p>{selectedReport.details}</p>
                  </div>
                ) : null}
                <div>
                  <strong>{t('admin.reports.details.contact')}</strong>
                  <p>
                    {selectedReport.reporter?.email ??
                      selectedReport.contactEmail ??
                      t('admin.reports.details.contactMissing')}
                    {selectedReport.contactPhone ? ` • ${selectedReport.contactPhone}` : ''}
                  </p>
                </div>
                <div>
                  <strong>{t('admin.reports.details.notes')}</strong>
                  <textarea
                    className="input"
                    rows={4}
                    value={resolutionNotes}
                    onChange={event => setResolutionNotes(event.target.value)}
                    placeholder={t('admin.reports.details.notesPlaceholder')}
                  />
                </div>
                <Button
                  onClick={handleUpdateNotes}
                  disabled={updatingId === selectedReport.id}
                >
                  {updatingId === selectedReport.id
                    ? t('admin.reports.details.notesSaving')
                    : t('actions.save')}
                </Button>
                <div>
                  <strong>{t('admin.reports.history.title')}</strong>
                  {isAuditLoading ? (
                    <p style={{ color: '#6c757d', marginTop: '6px' }}>
                      {t('admin.reports.history.loading')}
                    </p>
                  ) : auditEvents.length ? (
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: '8px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      {auditEvents.map(event => (
                        <li
                          key={event.id}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            padding: '8px'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '8px',
                              fontSize: '0.85rem'
                            }}
                          >
                            <span>{event.action}</span>
                            <span style={{ color: '#6c757d' }}>
                              {dateTimeFormatter.format(new Date(event.created_at))}
                            </span>
                          </div>
                          {event.details ? (
                            <p style={{ marginTop: '4px', color: '#4b5563' }}>{event.details}</p>
                          ) : null}
                          <p style={{ marginTop: '4px', color: '#6c757d', fontSize: '0.8rem' }}>
                            {event.actorName ?? t('admin.reports.history.system')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: '#6c757d', marginTop: '6px' }}>
                      {t('admin.reports.history.empty')}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: '#6c757d' }}>
                {t('admin.reports.details.empty')}
              </p>
            )}
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
