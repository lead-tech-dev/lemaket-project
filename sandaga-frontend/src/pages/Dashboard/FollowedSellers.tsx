import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { apiGet } from '../../utils/api'
import { resolveMediaUrl } from '../../utils/media'
import { useI18n } from '../../contexts/I18nContext'
import { useFollowedSellers } from '../../hooks/useFollowedSellers'

type FollowedSeller = {
  id: string
  name: string
  storefrontSlug?: string | null
  avatarUrl?: string | null
  location?: string | null
  listingCount: number
  followersCount: number
}

export default function FollowedSellers() {
  const { locale } = useI18n()
  const navigate = useNavigate()
  const { setFollowed, unfollowSeller } = useFollowedSellers()
  const [items, setItems] = useState<FollowedSeller[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US'),
    [locale]
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    apiGet<FollowedSeller[]>('/users/me/follows/list', { signal: controller.signal })
      .then(data => setItems(data ?? []))
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('Unable to load followed sellers', err)
        setError('Impossible de charger vos suivis pour le moment.')
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
      })

    return () => controller.abort()
  }, [])

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>Mes suivis</h1>
            <p>Suivez vos vendeurs pro favoris pour ne rien rater.</p>
          </div>
        </header>

        {loading ? (
          <div className="lbc-storefronts">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="lbc-storefront-card is-loading">
                <Skeleton className="lbc-storefront-card__cover" />
                <div className="lbc-storefront-card__body">
                  <Skeleton height="18px" width="80%" />
                  <Skeleton height="14px" width="60%" />
                  <Skeleton height="16px" width="40%" />
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <p style={{ color: '#b91c1c' }}>{error}</p>
        ) : items.length ? (
          <div className="lbc-storefronts">
            {items.map(item => (
              <Card key={item.id} className="lbc-storefront-card">
                <div className="lbc-storefront-card__cover" />
                <div className="lbc-storefront-card__body">
                  <div className="lbc-storefront-card__header">
                    <div className="lbc-storefront-card__avatar">
                      {item.avatarUrl ? (
                        <img src={resolveMediaUrl(item.avatarUrl)} alt={item.name} />
                      ) : (
                        <span>{item.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="lbc-storefront-card__identity">
                      <h3>{item.name}</h3>
                      <p>{item.location || '—'}</p>
                    </div>
                  </div>
                  <div className="lbc-storefront-card__meta">
                    <span>{numberFormatter.format(item.listingCount)} annonces</span>
                    <span>{numberFormatter.format(item.followersCount)} abonnés</span>
                  </div>
                  <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (item.storefrontSlug) {
                          navigate(`/store/${item.storefrontSlug}`)
                        } else {
                          navigate(`/search?owner=${item.id}`)
                        }
                      }}
                    >
                      Voir la boutique
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        await unfollowSeller(item.id)
                        setFollowed(item.id, false)
                        setItems(prev => prev.filter(entry => entry.id !== item.id))
                      }}
                    >
                      Ne plus suivre
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: '24px' }}>
            <h2>Aucun vendeur suivi</h2>
            <p>Ajoutez des vendeurs pro à vos suivis pour ne rien rater.</p>
            <Link to="/search" className="btn btn--primary">
              Explorer les annonces
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
