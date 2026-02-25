import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { RetryBanner } from '../../components/ui/RetryBanner'
import { FavoriteButton } from '../../components/ui/FavoriteButton'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { apiGet, apiPost } from '../../utils/api'
import { resolveMediaUrl } from '../../utils/media'
import { formatListingLocation } from '../../utils/location'
import type { Listing } from '../../types/listing'
import type { Paginated } from '../../types/pagination'
import { LocationPinIcon } from '../../components/ui/LocationPinIcon'

type PublicUserProfile = {
  id: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  location?: string | null
  createdAt: string
  lastLoginAt?: string | null
  hasPhoneNumber?: boolean
  averageRating?: number
  reviewsCount?: number
  responseTimeHours?: number | null
  responseRate?: number | null
  listingCount: number
  proFollowsCount?: number
}

const LISTINGS_LIMIT = 12

const formatDate = (value: string | null | undefined, locale: string): string => {
  if (!value) return ''
  try {
    const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
    return new Date(value).toLocaleDateString(dateLocale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return ''
  }
}

const formatMemberSinceDate = (value: string, locale: string): string => {
  if (!value) return ''
  try {
    const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
    return new Date(value).toLocaleDateString(dateLocale, {
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return ''
  }
}

const formatLastActive = (value: string | null | undefined, locale: string): string => {
  if (!value) return locale === 'fr' ? 'Activité récente indisponible' : 'Recent activity unavailable'
  try {
    const last = new Date(value).getTime()
    const now = Date.now()
    const diff = Math.max(0, now - last)
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 24) {
      return locale === 'fr'
        ? `Dernière activité il y a ${Math.max(1, hours)} heures`
        : `Last active ${Math.max(1, hours)} hours ago`
    }
    const days = Math.floor(hours / 24)
    return locale === 'fr'
      ? `Dernière activité il y a ${days} jours`
      : `Last active ${days} days ago`
  } catch {
    return locale === 'fr' ? 'Activité récente indisponible' : 'Recent activity unavailable'
  }
}

const formatResponseTime = (hours: number | null | undefined): string => {
  if (!hours || hours <= 0) return 'Réponse moyenne indisponible'
  if (hours < 1) return 'Répond en moyenne en moins d’1 heure'
  if (hours <= 2) return 'Répond en moyenne en 1–2 heures'
  if (hours <= 4) return 'Répond en moyenne en 2–4 heures'
  if (hours <= 8) return 'Répond en moyenne en 4–8 heures'
  if (hours <= 24) return 'Répond en moyenne en 8–24 heures'
  return 'Répond en moyenne en plus de 24 heures'
}

const formatResponseRate = (rate: number | null | undefined): string => {
  if (rate === null || rate === undefined) return 'Taux de réponse indisponible'
  const rounded = Math.round(rate / 5) * 5
  return `Taux de réponse à ${Math.min(100, Math.max(0, rounded))} %`
}

const formatListingPrice = (listing: Listing, locale: string): string => {
  const formatter = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US')
  const numeric = Number(listing.price ?? 0)
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${formatter.format(numeric)} ${listing.currency ?? ''}`.trim()
  }
  return [listing.price, listing.currency].filter(Boolean).join(' ')
}

const getListingLocation = (listing: Listing, fallback: string) => {
  return formatListingLocation(listing.location as any, listing.city || fallback)
}

export default function PublicUserProfile() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>()
  const identifier = slug ?? id
  const locale = document.documentElement.lang || 'fr'

  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [sectionTab, setSectionTab] = useState<'listings' | 'reviews'>('listings')
  const [tab, setTab] = useState<'published' | 'archived'>('published')
  const [listings, setListings] = useState<Listing[]>([])
  const [listingsTotal, setListingsTotal] = useState(0)
  const [listingsLoading, setListingsLoading] = useState(false)
  const [listingsError, setListingsError] = useState<string | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<
    Array<{ id: string; rating: number; comment: string; createdAt: string; reviewer: { name: string } }>
  >([])
  const [reviewSummary, setReviewSummary] = useState<{
    averageRating: number
    totalReviews: number
  } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showResponsiveModal, setShowResponsiveModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLocation, setReviewLocation] = useState('')
  const [reviewAsTestimonial, setReviewAsTestimonial] = useState(false)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportEmail, setReportEmail] = useState('')
  const [isReporting, setIsReporting] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { addToast } = useToast()

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US'),
    [locale]
  )

  const isUuid = useMemo(
    () => Boolean(identifier && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)),
    [identifier]
  )

  useEffect(() => {
    if (!identifier) return
    const controller = new AbortController()
    setProfileLoading(true)
    setProfileError(null)
    setProfile(null)

    const endpoint = isUuid
      ? `/users/public/${identifier}`
      : `/users/public/slug/${identifier}`

    apiGet<PublicUserProfile>(endpoint, { signal: controller.signal })
      .then(data => {
        setProfile(data)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('Unable to load public profile', err)
        setProfileError(err instanceof Error ? err.message : 'Impossible de charger le profil.')
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setProfileLoading(false)
      })

    return () => controller.abort()
  }, [identifier, isUuid])

  useEffect(() => {
    const ownerId = profile?.id ?? (isUuid ? identifier : undefined)
    if (!ownerId) return
    const controller = new AbortController()
    const params = new URLSearchParams()
    params.set('ownerId', ownerId)
    params.set('limit', String(LISTINGS_LIMIT))
    params.set('status', tab)

    setListingsLoading(true)
    setListingsError(null)

    apiGet<Paginated<Listing>>(`/listings?${params.toString()}`, {
      signal: controller.signal
    })
      .then(data => {
        setListings(data.data ?? [])
        setListingsTotal(data.total ?? 0)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('Unable to load user listings', err)
        setListingsError(err instanceof Error ? err.message : 'Impossible de charger les annonces.')
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setListingsLoading(false)
      })

    return () => controller.abort()
  }, [identifier, isUuid, profile?.id, tab])

  useEffect(() => {
    const ownerId = profile?.id ?? (isUuid ? identifier : undefined)
    if (!ownerId) return
    const controller = new AbortController()
    setReviewsLoading(true)
    setReviewsError(null)

    apiGet<{ items: typeof reviews; summary: { averageRating: number; totalReviews: number } }>(
      `/reviews/sellers/${ownerId}`,
      { signal: controller.signal }
    )
      .then(data => {
        setReviews(data.items ?? [])
        setReviewSummary(data.summary ?? null)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('Unable to load reviews', err)
        setReviewsError(err instanceof Error ? err.message : 'Impossible de charger les avis.')
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setReviewsLoading(false)
      })

    return () => controller.abort()
  }, [identifier, isUuid, profile?.id])

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (event.target instanceof Node && menuRef.current.contains(event.target)) {
        return
      }
      setMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleShare = async () => {
    try {
      const url = window.location.href
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim(),
          url
        })
        return
      }
      await navigator.clipboard.writeText(url)
      addToast({
        variant: 'success',
        title: 'Lien copié',
        message: 'Le lien du profil a été copié.'
      })
    } catch (err) {
      console.error('Unable to share profile', err)
      addToast({
        variant: 'error',
        title: 'Erreur',
        message: 'Impossible de partager ce profil.'
      })
    }
  }

  const handleReportSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile?.id || !reportReason.trim() || isReporting) return
    setIsReporting(true)
    try {
      await apiPost('/reports', {
        reportedUserId: profile.id,
        reason: reportReason.trim(),
        details: reportDetails.trim() || undefined,
        contactEmail: reportEmail.trim() || undefined
      })
      addToast({
        variant: 'success',
        title: 'Signalement envoyé',
        message: 'Merci, votre signalement a bien été enregistré.'
      })
      setShowReportModal(false)
      setReportReason('')
      setReportDetails('')
      setReportEmail('')
    } catch (err) {
      console.error('Unable to submit user report', err)
      addToast({
        variant: 'error',
        title: 'Erreur',
        message: err instanceof Error ? err.message : "Impossible d'envoyer le signalement."
      })
    } finally {
      setIsReporting(false)
    }
  }

  const handleSubmitUserReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile?.id || !reviewComment.trim() || isSubmittingReview) return
    setIsSubmittingReview(true)
    try {
      await apiPost('/reviews/users', {
        sellerId: profile.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
        location: reviewLocation.trim() || undefined,
        isTestimonial: reviewAsTestimonial
      })
      addToast({
        variant: 'success',
        title: 'Avis envoyé',
        message: 'Merci pour votre avis.'
      })
      setShowReviewModal(false)
      setReviewComment('')
      setReviewLocation('')
      setReviewRating(5)
      setReviewAsTestimonial(false)
      setSectionTab('reviews')
      // refresh reviews
      if (profile.id) {
        apiGet<{ items: typeof reviews; summary: { averageRating: number; totalReviews: number } }>(
          `/reviews/sellers/${profile.id}`
        ).then(data => {
          setReviews(data.items ?? [])
          setReviewSummary(data.summary ?? null)
        })
      }
    } catch (err) {
      console.error('Unable to submit user review', err)
      addToast({
        variant: 'error',
        title: 'Erreur',
        message: err instanceof Error ? err.message : "Impossible d'envoyer l'avis."
      })
    } finally {
      setIsSubmittingReview(false)
    }
  }

  if (!identifier) {
    return (
      <MainLayout>
        <RetryBanner
          title="Profil introuvable"
          message="Identifiant manquant."
          accessory="⚠️"
          onRetry={() => window.location.assign('/')}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="user-public user-public--reworked">
        {profileLoading ? (
          <Card className="user-public__header">
            <div className="user-public__hero">
              <Skeleton width="64px" height="64px" />
              <div className="user-public__identity">
                <Skeleton width="200px" height="22px" />
                <Skeleton width="160px" height="16px" />
                <Skeleton width="120px" height="14px" />
              </div>
            </div>
            <Skeleton width="140px" height="36px" />
          </Card>
        ) : profileError ? (
          <RetryBanner
            title="Profil indisponible"
            message={profileError}
            accessory="⚠️"
            onRetry={() => window.location.reload()}
          />
        ) : profile ? (
          <Card className="user-public__header">
            <div className="user-public__hero">
              <div className="user-public__identity">
                <div className="user-public__avatar">
                  {profile.avatarUrl ? (
                    <img src={resolveMediaUrl(profile.avatarUrl)} alt={profile.firstName} />
                  ) : (
                    <span>
                      {(profile.firstName?.[0] ?? '').toUpperCase()}
                      {(profile.lastName?.[0] ?? '').toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="user-public__info">
                  <h1>
                    {profile.firstName} {profile.lastName}
                  </h1>
                  {profile.reviewsCount ? (
                    <div className="user-public__rating">
                      <span>★</span>
                      <strong>{profile.averageRating?.toFixed(1) ?? '0.0'}</strong>
                      <span>({profile.reviewsCount} avis)</span>
                    </div>
                  ) : (
                    <div className="user-public__rating user-public__rating--empty">
                      <span>★</span>
                      <span>0 avis</span>
                    </div>
                  )}
                  <ul className="user-public__facts">
                    <li>👥 {numberFormatter.format(profile.proFollowsCount ?? 0)} Pro suivis</li>
                    <li>📅 Membre depuis {formatMemberSinceDate(profile.createdAt, locale)}</li>
                    <li>
                      <span className="user-public__fact-icon" aria-hidden>
                        <LocationPinIcon />
                      </span>
                      {profile.location ?? '—'}
                    </li>
                    <li>⏱ {formatLastActive(profile.lastLoginAt, locale)}</li>
                  </ul>
                </div>
              </div>
              <div className="user-public__actions" ref={menuRef}>
                <button
                  type="button"
                  className="user-public__menu"
                  aria-label="Menu"
                  onClick={() => setMenuOpen(prev => !prev)}
                >
                  ⋮
                </button>
                {menuOpen ? (
                  <div className="user-public__menu-dropdown">
                    <div className="user-public__menu-header">
                      <span>Plus d&apos;options</span>
                      <button
                        type="button"
                        className="user-public__menu-close"
                        onClick={() => setMenuOpen(false)}
                        aria-label="Fermer"
                      >
                        ✕
                      </button>
                    </div>
                    <button
                      type="button"
                      className="user-public__menu-item"
                      onClick={() => {
                        setShowReportModal(true)
                        setMenuOpen(false)
                      }}
                    >
                      🚩 Signaler cet utilisateur
                    </button>
                    <button
                      type="button"
                      className="user-public__menu-item"
                      onClick={() => {
                        setMenuOpen(false)
                        void handleShare()
                      }}
                    >
                      🔗 Partager
                    </button>
                  </div>
                ) : null}
                <Button className="user-public__follow" variant="outline" disabled>
                  Suivre
                </Button>
              </div>
            </div>
            <div className="user-public__badges">
              <button
                type="button"
                className="user-public__badge user-public__badge--interactive"
                onClick={() => setShowResponsiveModal(true)}
              >
                <span className="user-public__badge-icon">💬</span>
                <span className="user-public__badge-label">Réactif</span>
              </button>
              {profile.hasPhoneNumber ? (
                <div className="user-public__badge">
                  <span className="user-public__badge-icon">📞</span>
                  <span className="user-public__badge-label">Numéro vérifié</span>
                </div>
              ) : null}
              <div className="user-public__review-cta">
                <Button onClick={() => setShowReviewModal(true)}>
                  Laisser un avis
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="user-public__tabs user-public__tabs--main">
          <button
            type="button"
            className={sectionTab === 'listings' ? 'is-active' : ''}
            onClick={() => setSectionTab('listings')}
          >
            Annonces ({numberFormatter.format(profile?.listingCount ?? 0)})
          </button>
          <button
            type="button"
            className={sectionTab === 'reviews' ? 'is-active' : ''}
            onClick={() => setSectionTab('reviews')}
          >
            Avis ({numberFormatter.format(profile?.reviewsCount ?? 0)})
          </button>
        </div>

        {sectionTab === 'listings' && (
          <div className="user-public__tabs">
            <button
              type="button"
              className={tab === 'published' ? 'is-active' : ''}
              onClick={() => setTab('published')}
            >
              En vente
            </button>
            <button
              type="button"
              className={tab === 'archived' ? 'is-active' : ''}
              onClick={() => setTab('archived')}
            >
              Vendu
            </button>
          </div>
        )}

        {sectionTab === 'listings' && listingsLoading ? (
          <div className="lbc-listings lbc-listings--grid">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={index} className="lbc-listing-card is-loading">
                <Skeleton className="lbc-listing-card__image" />
                <div className="lbc-listing-card__body">
                  <Skeleton height="18px" width="80%" />
                  <Skeleton height="14px" width="70%" />
                  <Skeleton height="18px" width="40%" />
                </div>
              </Card>
            ))}
          </div>
        ) : sectionTab === 'listings' && listingsError ? (
          <p style={{ color: '#b91c1c' }}>{listingsError}</p>
        ) : sectionTab === 'listings' && listings.length ? (
          <div className="lbc-listings lbc-listings--grid">
	            {listings.map(listing => {
	              const cover = listing.images?.find(image => image.isCover) ?? listing.images?.[0]
	              const coverUrl = cover?.url?.trim() ?? ''
	              const hasCover = Boolean(coverUrl)
	              return (
	                <Link key={listing.id} to={`/listing/${listing.id}`} className="lbc-listing-card-link">
	                  <Card className="lbc-listing-card">
	                    <div
	                      className={`lbc-listing-card__image${hasCover ? '' : ' is-placeholder'}`}
	                      style={hasCover ? { backgroundImage: `url(${coverUrl})` } : undefined}
	                    >
                      <FavoriteButton listingId={listing.id} className="favorite-toggle--overlay" />
                    </div>
                    <div className="lbc-listing-card__body">
                      <h3>{listing.title}</h3>
                      {listing.publishedAt ? (
                        <p className="lbc-listing-card__meta">
                          {formatDate(listing.publishedAt, locale)}
                        </p>
                      ) : null}
                      <p>
                        {getListingLocation(listing, 'Localisation indisponible')}
                      </p>
                      <p className="lbc-listing-card__price">{formatListingPrice(listing, locale)}</p>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : sectionTab === 'listings' ? (
          <p style={{ color: '#6c757d' }}>
            {tab === 'published'
              ? 'Aucune annonce en vente pour le moment.'
              : 'Aucune annonce vendue pour le moment.'}
          </p>
        ) : null}

        {sectionTab === 'listings' && listingsTotal > LISTINGS_LIMIT ? (
          <div className="user-public__more">
            <Link to={`/search?owner=${profile?.id ?? id}`} className="btn btn--outline">
              Voir toutes les annonces
            </Link>
          </div>
        ) : null}

        {sectionTab === 'reviews' ? (
          <Card className="user-public__reviews">
            {reviewsLoading ? (
              <Skeleton width="220px" height="20px" />
            ) : reviewsError ? (
              <p style={{ color: '#6c757d' }}>{reviewsError}</p>
            ) : (
              <>
                <div className="user-public__reviews-summary">
                  <div className="user-public__rating-score">
                    <span>★</span>
                    <strong>{reviewSummary?.averageRating?.toFixed(1) ?? '0.0'}</strong>
                    <span>/5</span>
                  </div>
                  <p>
                    {reviewSummary?.totalReviews
                      ? `${reviewSummary.totalReviews} avis`
                      : 'Aucun avis pour le moment.'}
                  </p>
                </div>
                <div className="user-public__reviews-list">
                  {reviews.length ? (
                    reviews.map(review => (
                      <div key={review.id} className="user-public__review-item">
                        <div>
                          <strong>{review.reviewer?.name}</strong> ★ {review.rating}
                        </div>
                        <p>{review.comment}</p>
                        <span>{formatDate(review.createdAt, locale)}</span>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#6c757d' }}>Aucun avis publié.</p>
                  )}
                </div>
              </>
            )}
          </Card>
        ) : null}
      </div>

      <Modal
        open={showReportModal}
        title="Signaler cet utilisateur"
        description="Merci de préciser la raison du signalement."
        onClose={() => {
          if (!isReporting) setShowReportModal(false)
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowReportModal(false)}
              disabled={isReporting}
            >
              Annuler
            </Button>
            <Button type="submit" form="user-report-form" disabled={isReporting || !reportReason.trim()}>
              {isReporting ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        }
      >
        <form id="user-report-form" onSubmit={handleReportSubmit} className="listing-report-form">
          <label className="form-field">
            <span className="form-field__label">Raison</span>
            <input
              className="input"
              value={reportReason}
              onChange={event => setReportReason(event.target.value)}
              placeholder="Ex: arnaque, contenu inapproprié..."
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">Détails (optionnel)</span>
            <textarea
              className="input"
              rows={4}
              value={reportDetails}
              onChange={event => setReportDetails(event.target.value)}
              placeholder="Expliquez brièvement le problème."
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">Email de contact (optionnel)</span>
            <input
              className="input"
              type="email"
              value={reportEmail}
              onChange={event => setReportEmail(event.target.value)}
              placeholder="email@exemple.com"
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={showReviewModal}
        title="Laisser un avis"
        description="Votre avis concerne uniquement cet utilisateur."
        onClose={() => {
          if (!isSubmittingReview) setShowReviewModal(false)
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowReviewModal(false)}
              disabled={isSubmittingReview}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="user-review-form"
              disabled={isSubmittingReview || !reviewComment.trim()}
            >
              {isSubmittingReview ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        }
      >
        <form id="user-review-form" onSubmit={handleSubmitUserReview} className="listing-review-form">
          <label className="form-field">
            <span className="form-field__label">Note</span>
            <select
              className="input"
              value={reviewRating}
              onChange={event => setReviewRating(Number(event.target.value))}
            >
              {[5, 4, 3, 2, 1].map(value => (
                <option key={value} value={value}>
                  {value} / 5
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-field__label">Commentaire</span>
            <textarea
              className="input"
              rows={4}
              value={reviewComment}
              onChange={event => setReviewComment(event.target.value)}
              placeholder="Votre avis..."
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">Localisation (optionnel)</span>
            <input
              className="input"
              value={reviewLocation}
              onChange={event => setReviewLocation(event.target.value)}
              placeholder="Ex: Douala"
            />
          </label>
          <label className="switch-toggle">
            <input
              type="checkbox"
              checked={reviewAsTestimonial}
              onChange={event => setReviewAsTestimonial(event.target.checked)}
            />
            <span>Autoriser l’affichage de mon avis dans les témoignages de la page d’accueil</span>
          </label>
        </form>
      </Modal>

      <Modal
        open={showResponsiveModal}
        title="Réactif"
        description="Ce membre est facile à joindre et répond aux messages, mais à son propre rythme."
        onClose={() => setShowResponsiveModal(false)}
      >
        <div className="user-public__responsive-modal">
          <div className="user-public__responsive-icon">💬</div>
          <div className="user-public__responsive-stats">
            <div>
              <span>⏱</span>
              <p>{formatResponseTime(profile?.responseTimeHours ?? null)}</p>
            </div>
            <div>
              <span>📊</span>
              <p>{formatResponseRate(profile?.responseRate ?? null)}</p>
            </div>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}
