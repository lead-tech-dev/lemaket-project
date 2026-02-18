import { useCallback, useEffect, useMemo, useState } from 'react'
import MainLayout from '../../layouts/MainLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { apiGet } from '../../utils/api'
import type { DashboardOverviewResponse, SellerInsights } from '../../types/dashboard'
import { Skeleton } from '../../components/ui/Skeleton'
import { RetryBanner } from '../../components/ui/RetryBanner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'

export default function DashboardOverview() {
  const [data, setData] = useState<DashboardOverviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { addToast } = useToast()
  const { locale, t } = useI18n()
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const shareFormatter = useMemo(
    () =>
      new Intl.NumberFormat(numberLocale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }),
    [numberLocale]
  )
  const numberFormatter = useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale])

  const loadOverview = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiGet<DashboardOverviewResponse>('/dashboard/overview')
      setData(response)
    } catch (err) {
      console.error('Unable to load dashboard overview', err)
      const fallbackMessage = t('dashboard.overview.loadError')
      const resolvedMessage = err instanceof Error ? err.message : fallbackMessage
      setError(resolvedMessage)
      addToast({
        variant: 'error',
        title: t('dashboard.overview.loadTitle'),
        message: resolvedMessage
      })
    } finally {
      setIsLoading(false)
    }
  }, [addToast, t])

  useEffect(() => {
    loadOverview().catch(() => {
      /* handled in loadOverview */
    })
  }, [loadOverview])

  const sellerInsights = data?.sellerInsights
  const totalListings = sellerInsights
    ? sellerInsights.proListings + sellerInsights.individualListings
    : 0

  return (
    <MainLayout>
      <div className="dashboard-overview">
        <h1>{t('dashboard.overview.title')}</h1>

        {error ? (
          <RetryBanner
            title={t('dashboard.overview.loadTitle')}
            message={error ?? t('dashboard.overview.loadError')}
            accessory="⚠️"
            onRetry={() => loadOverview().catch(() => undefined)}
          />
        ) : null}

        {isLoading && !data ? (
          <section className="dashboard-seller-insights" aria-hidden>
            <h2 style={{ visibility: 'hidden' }}>{t('dashboard.overview.sectionTitle')}</h2>
            <div className="dashboard-seller-insights__cards">
              {Array.from({ length: 2 }).map((_, index) => (
                <Card key={index} className="dashboard-seller-card">
                  <div className="dashboard-seller-card__header">
                    <Skeleton width="140px" height="18px" />
                    <Skeleton width="60px" height="28px" />
                  </div>
                  <Skeleton width="80%" height="16px" />
                  <Skeleton width="100%" height="16px" />
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {sellerInsights ? (
          <section className="dashboard-seller-insights">
            <h2>{t('dashboard.overview.sectionTitle')}</h2>
            <div className="dashboard-seller-insights__cards">
              <Card className="dashboard-seller-card dashboard-seller-card--pro">
                <div className="dashboard-seller-card__header">
                  <span className="dashboard-seller-card__badge">{t('dashboard.overview.proBadge')}</span>
                  <strong>{shareFormatter.format(sellerInsights.proShare)}%</strong>
                </div>
                <p className="dashboard-seller-card__count">
                  {t('dashboard.overview.activeCount', {
                    count: numberFormatter.format(sellerInsights.proListings)
                  })}
                </p>
                <p className="dashboard-seller-card__hint">
                  {t('dashboard.overview.proHint', {
                    share: shareFormatter.format(sellerInsights.proShare)
                  })}
                </p>
              </Card>
              <Card className="dashboard-seller-card dashboard-seller-card--individual">
                <div className="dashboard-seller-card__header">
                  <span className="dashboard-seller-card__badge">{t('dashboard.overview.individualBadge')}</span>
                  <strong>{shareFormatter.format(sellerInsights.individualShare)}%</strong>
                </div>
                <p className="dashboard-seller-card__count">
                  {t('dashboard.overview.activeCount', {
                    count: numberFormatter.format(sellerInsights.individualListings)
                  })}
                </p>
                <p className="dashboard-seller-card__hint">
                  {t('dashboard.overview.individualHint', {
                    share: shareFormatter.format(sellerInsights.individualShare)
                  })}
                </p>
              </Card>
            </div>
            <p className="dashboard-seller-insights__summary">
              {totalListings
                ? t('dashboard.overview.summary', {
                    count: numberFormatter.format(totalListings)
                  })
                : t('dashboard.overview.summaryEmpty')}
            </p>
          </section>
        ) : null}

        {!isLoading && !sellerInsights && !error ? (
          <EmptyState
            icon="📊"
            title={t('dashboard.overview.emptyTitle')}
            description={t('dashboard.overview.emptyDescription')}
            action={
              <Button
                variant="ghost"
                onClick={() => loadOverview().catch(() => undefined)}
              >
                {t('actions.refresh')}
              </Button>
            }
          />
        ) : null}
      </div>
    </MainLayout>
  )
}
