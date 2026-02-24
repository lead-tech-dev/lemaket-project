import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { apiGet, apiPost } from '../../utils/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import type { Listing } from '../../types/listing'
type MapboxMap = import('mapbox-gl').Map
type MapboxMarker = import('mapbox-gl').Marker
import 'mapbox-gl/dist/mapbox-gl.css'

type EscrowInitResponse = {
  paymentId: string
  orderId: string
  paymentUrl?: string
  reference?: string
}

type Courier = {
  id: string
  name: string
  avatarUrl: string | null
  location: string | null
  lastLoginAt: string | null
  lat: number | null
  lng: number | null
  city: string | null
  zipcode: string | null
}

function formatMoney(amount: number, currency: string, locale = 'fr-FR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount)
}

export default function ListingCheckout() {
  const { id } = useParams()
  const listingId = id ?? ''
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { user } = useAuth()
  const [listing, setListing] = useState<Listing | null>(null)
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [loading, setLoading] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState({
    fullName: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '',
    phone: user?.phoneNumber ?? '',
    dropoffAddress: '',
    dropoffNotes: '',
    deliveryBudget: ''
  })
  const [handoverMode, setHandoverMode] = useState<'delivery' | 'pickup'>('delivery')
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'card' | 'wallet'>(
    'mobile_money'
  )
  const [paymentOperator, setPaymentOperator] = useState<'mtn' | 'orange'>('mtn')
  const [walletSummary, setWalletSummary] = useState<{ balance: number; currency: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null)
  const [estimatedDeliveryFee, setEstimatedDeliveryFee] = useState<number | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markersRef = useRef<MapboxMarker[]>([])

  useEffect(() => {
    if (!listingId) {
      setListing(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    apiGet<Listing>(`/listings/${listingId}`, { signal: controller.signal })
      .then(data => setListing(data))
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Unable to load listing', err)
        addToast({
          variant: 'error',
          title: 'Achat',
          message: "Impossible de charger l'annonce."
        })
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [listingId, addToast])

  useEffect(() => {
    apiGet<{ balance: number; currency: string }>('/payments/wallet')
      .then(setWalletSummary)
      .catch(() => {
        setWalletSummary(null)
      })
  }, [])

  const locationData = useMemo(() => {
    if (!listing?.location || typeof listing.location !== 'object') return null
    return listing.location
  }, [listing?.location])

  const availableHandoverModes = useMemo<Array<'delivery' | 'pickup'>>(() => {
    const raw =
      (listing?.attributes as Record<string, unknown> | undefined)?.handover_modes ??
      (listing?.details as Record<string, unknown> | undefined)?.handover_modes
    const normalized = Array.isArray(raw)
      ? raw
          .map(mode => String(mode).toLowerCase())
          .filter(mode => mode === 'delivery' || mode === 'pickup')
      : []
    if (!normalized.length) return ['delivery', 'pickup']
    const unique = Array.from(new Set(normalized)) as Array<'pickup' | 'delivery'>
    return unique.length ? unique : ['delivery', 'pickup']
  }, [listing?.attributes, listing?.details])

  useEffect(() => {
    if (!availableHandoverModes.length) return
    setHandoverMode(prev => (availableHandoverModes.includes(prev) ? prev : availableHandoverModes[0]))
  }, [availableHandoverModes])

  useEffect(() => {
    if (handoverMode !== 'delivery') {
      setSelectedCourierId(null)
      return
    }
    if (!listingId || !listing) {
      setCouriers([])
      return
    }
    const city = locationData?.city ?? ''
    const zipcode = locationData?.zipcode ?? ''
    const query = new URLSearchParams()
    if (city) query.set('city', city)
    if (zipcode) query.set('zipcode', zipcode)
    query.set('limit', '8')
    apiGet<Courier[]>(`/users/couriers?${query.toString()}`)
      .then(setCouriers)
      .catch(err => {
        console.error('Unable to load couriers', err)
        setCouriers([])
      })
  }, [listingId, listing, handoverMode, locationData])

  const referenceCoords = useMemo(() => {
    if (!locationData?.lat || !locationData?.lng) return null
    return { lat: locationData.lat, lng: locationData.lng }
  }, [locationData?.lat, locationData?.lng])

  const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const toRad = (value: number) => (value * Math.PI) / 180
    const r = 6371
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return 2 * r * Math.asin(Math.sqrt(h))
  }

  const courierDistances = useMemo(() => {
    if (!referenceCoords) return new Map<string, number>()
    const distances = new Map<string, number>()
    couriers.forEach(courier => {
      if (courier.lat && courier.lng) {
        distances.set(
          courier.id,
          haversineKm(referenceCoords, { lat: courier.lat, lng: courier.lng })
        )
      }
    })
    return distances
  }, [couriers, referenceCoords])

  const currency = listing?.currency || 'XAF'

  useEffect(() => {
    if (handoverMode !== 'delivery') {
      setDropoffCoords(null)
      return
    }
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    const address = checkoutForm.dropoffAddress.trim()
    if (!token || address.length < 3) {
      setDropoffCoords(null)
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        const encoded = encodeURIComponent(address)
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?limit=1&types=address,place,postcode&access_token=${token}`
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Mapbox ${response.status}`)
        }
        const data = (await response.json()) as {
          features?: Array<{ center?: [number, number] }>
        }
        const center = data.features?.[0]?.center
        if (center && center.length === 2) {
          setDropoffCoords({ lng: center[0], lat: center[1] })
        } else {
          setDropoffCoords(null)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.warn('Unable to geocode dropoff address', err)
        setDropoffCoords(null)
      }
    }, 450)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [checkoutForm.dropoffAddress, handoverMode])

  useEffect(() => {
    if (handoverMode !== 'delivery' || !referenceCoords || !dropoffCoords) {
      setEstimatedDeliveryFee(null)
      return
    }
    const distance = haversineKm(referenceCoords, dropoffCoords)
    const isXaf = currency.toUpperCase() === 'XAF'
    const base = isXaf ? 500 : 3
    const perKm = isXaf ? 150 : 0.4
    const min = isXaf ? 800 : 5
    const estimate = Math.max(min, Math.round(base + distance * perKm))
    setEstimatedDeliveryFee(estimate)
  }, [handoverMode, referenceCoords, dropoffCoords, currency])

  useEffect(() => {
    if (handoverMode !== 'delivery') {
      return
    }
    if (estimatedDeliveryFee === null) {
      setCheckoutForm(prev => (prev.deliveryBudget ? { ...prev, deliveryBudget: '' } : prev))
      return
    }
    const nextBudget = String(estimatedDeliveryFee)
    setCheckoutForm(prev => (prev.deliveryBudget === nextBudget ? prev : { ...prev, deliveryBudget: nextBudget }))
  }, [estimatedDeliveryFee, handoverMode])

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (handoverMode !== 'delivery' || !token || !mapContainerRef.current || !referenceCoords) {
      return
    }
    let map: MapboxMap | null = mapRef.current
    if (!map) {
      import('mapbox-gl')
        .then(mapbox => {
          mapbox.default.accessToken = token
          map = new mapbox.default.Map({
            container: mapContainerRef.current as HTMLElement,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [referenceCoords.lng, referenceCoords.lat],
            zoom: 11
          })
          mapRef.current = map
        })
        .catch(err => console.error('Unable to init mapbox', err))
    }
  }, [referenceCoords, handoverMode])

  useEffect(() => {
    if (handoverMode !== 'delivery') return
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []
    import('mapbox-gl')
      .then(mapbox => {
        if (referenceCoords) {
          const pickupMarker = new mapbox.default.Marker({ color: '#2563eb' })
            .setLngLat([referenceCoords.lng, referenceCoords.lat])
            .addTo(map)
          markersRef.current.push(pickupMarker)
        }
        couriers.forEach(courier => {
          if (!courier.lat || !courier.lng) return
          const isSelected = courier.id === selectedCourierId
          const marker = new mapbox.default.Marker({ color: isSelected ? '#ea580c' : '#0f172a' })
            .setLngLat([courier.lng, courier.lat])
            .addTo(map)
          markersRef.current.push(marker)
        })
      })
      .catch(err => console.error('Unable to update map markers', err))
  }, [couriers, referenceCoords, selectedCourierId, handoverMode])

  const listingPrice = Number(listing?.price ?? 0)
  const deliveryBudget =
    handoverMode === 'delivery' && checkoutForm.deliveryBudget
      ? Number(checkoutForm.deliveryBudget)
      : 0
  const estimatedDistanceKm =
    handoverMode === 'delivery' && referenceCoords && dropoffCoords
      ? haversineKm(referenceCoords, dropoffCoords)
      : null
  const fallbackDeliveryFee =
    handoverMode === 'delivery' && estimatedDeliveryFee !== null ? estimatedDeliveryFee : 0
  const resolvedDeliveryFee =
    Number.isFinite(deliveryBudget) && deliveryBudget > 0 ? deliveryBudget : fallbackDeliveryFee
  const totalPrice = listingPrice + (Number.isFinite(resolvedDeliveryFee) ? resolvedDeliveryFee : 0)

  const canSubmit = useMemo(() => {
    if (!listing) return false
    if (handoverMode === 'delivery') {
      if (!selectedCourierId) return false
      if (!checkoutForm.dropoffAddress.trim()) return false
    }
    if (paymentMethod === 'wallet' && walletSummary) {
      if (walletSummary.currency !== currency) return false
      if (walletSummary.balance < totalPrice) return false
    }
    if (paymentMethod === 'mobile_money' && !paymentOperator) return false
    if (!checkoutForm.fullName.trim()) return false
    if (!checkoutForm.phone.trim()) return false
    return true
  }, [
    checkoutForm,
    listing,
    selectedCourierId,
    handoverMode,
    paymentMethod,
    walletSummary,
    currency,
    totalPrice,
    paymentOperator
  ])

  const handleSubmit = async () => {
    if (!listing || !canSubmit || isSubmitting) return
    setIsSubmitting(true)
    try {
      const response = await apiPost<EscrowInitResponse>(
        '/deliveries/escrow/init',
        {
          listingId: listing.id,
          dropoffAddress:
            handoverMode === 'delivery' ? checkoutForm.dropoffAddress.trim() : undefined,
          dropoffNotes:
            handoverMode === 'delivery' ? checkoutForm.dropoffNotes.trim() || undefined : undefined,
          price:
            handoverMode === 'delivery' && checkoutForm.deliveryBudget
              ? Number(checkoutForm.deliveryBudget)
              : undefined,
          currency,
          preferredCourierId: handoverMode === 'delivery' ? selectedCourierId : undefined,
          handoverMode,
          paymentMethod,
          paymentOperator: paymentMethod === 'mobile_money' ? paymentOperator : undefined,
          paymentPhone: checkoutForm.phone.trim()
        }
      )
      if (response?.paymentUrl) {
        window.open(response.paymentUrl, '_blank', 'noopener,noreferrer')
      }
      addToast({
        variant: 'success',
        title: 'Achat',
        message: 'Paiement sécurisé lancé. Vous recevrez une notification après confirmation.'
      })
      if (response?.reference) {
        navigate(
          `/payment/return?reference=${encodeURIComponent(
            response.reference
          )}&listingId=${encodeURIComponent(listing.id)}`
        )
      } else {
        navigate(`/listing/${listing.id}`)
      }
    } catch (err) {
      console.error('Unable to start checkout', err)
      addToast({
        variant: 'error',
        title: 'Achat',
        message: "Impossible de lancer le paiement."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const mainImage = listing?.images?.find(img => img.isCover)?.url ?? listing?.images?.[0]?.url ?? ''
  const pickupLocationLabel = [
    locationData?.city,
    locationData?.zipcode ? `(${locationData.zipcode})` : null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <MainLayout>
      <div className="listing-checkout">
        <div className="listing-checkout__header">
          <div>
            <h1>Finaliser l’achat</h1>
            <p>Choisissez votre mode de remise et complétez vos informations.</p>
          </div>
          <Link to={`/listing/${listingId}`} className="btn btn--outline">
            Retour à l’annonce
          </Link>
        </div>

        <div className="listing-checkout__grid">
          <div className="listing-checkout__column">
            <section className="checkout-card checkout-card--handover">
              <div className="checkout-card__header">
                <h2>Mode de remise</h2>
                <span>
                  {availableHandoverModes.includes('delivery') && availableHandoverModes.includes('pickup')
                    ? 'Choisissez ce qui vous convient'
                    : availableHandoverModes.includes('delivery')
                      ? 'Livraison uniquement'
                      : 'Remise en main propre'}
                </span>
              </div>
              <div className="handover-mode">
                <button
                  type="button"
                  className={`handover-mode__option ${handoverMode === 'pickup' ? 'is-active' : ''}`}
                  onClick={() => setHandoverMode('pickup')}
                  disabled={!availableHandoverModes.includes('pickup')}
                >
                  Remise en main propre
                </button>
                <button
                  type="button"
                  className={`handover-mode__option ${handoverMode === 'delivery' ? 'is-active' : ''}`}
                  onClick={() => setHandoverMode('delivery')}
                  disabled={!availableHandoverModes.includes('delivery')}
                >
                  Livraison
                </button>
              </div>
            </section>

            {availableHandoverModes.includes('delivery') ? (
              <section className="checkout-card checkout-card--courier">
                <div className="checkout-card__header">
                  <h2>Trouver un livreur</h2>
                  <span>
                    {handoverMode === 'delivery'
                      ? `${couriers.length} livreur(s) à proximité`
                      : 'Non requis en remise en main propre'}
                  </span>
                </div>
                {handoverMode === 'delivery' ? (
                  <>
                    <div className="courier-map" ref={mapContainerRef} />
                    <div className="courier-grid">
                      {couriers.length ? (
                        couriers.map(courier => (
                          <button
                            key={courier.id}
                            type="button"
                            className={`courier-card ${selectedCourierId === courier.id ? 'is-selected' : ''}`}
                            onClick={() => setSelectedCourierId(courier.id)}
                          >
                            <div className="courier-card__avatar">
                              {courier.avatarUrl ? (
                                <img src={courier.avatarUrl} alt={courier.name} />
                              ) : (
                                <span>{courier.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="courier-card__info">
                              <strong>{courier.name}</strong>
                              <span>{courier.location ?? courier.city ?? 'Zone non précisée'}</span>
                              {courierDistances.has(courier.id) ? (
                                <small>{courierDistances.get(courier.id)!.toFixed(1)} km</small>
                              ) : (
                                <small>Distance inconnue</small>
                              )}
                              <small>
                                {courier.lastLoginAt
                                  ? `Actif récemment`
                                  : 'Disponible'}
                              </small>
                            </div>
                            <span className="courier-card__cta">
                              {selectedCourierId === courier.id ? 'Sélectionné' : 'Disponible'}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="courier-empty">
                          <p>Aucun livreur trouvé à proximité.</p>
                          <small>Essayez plus tard ou changez d’adresse.</small>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="pickup-info">
                    <p>La remise se fait directement avec le vendeur.</p>
                    <small>
                      Lieu suggéré : {locationData?.city ?? 'Ville'} {locationData?.zipcode ?? ''}
                    </small>
                  </div>
                )}
              </section>
            ) : null}

            <section className="checkout-card checkout-card--form">
              <div className="checkout-card__header">
                <h2>Informations personnelles</h2>
                <span>
                  {handoverMode === 'delivery' ? 'Obligatoire pour la livraison' : 'Obligatoire pour la remise'}
                </span>
              </div>
              <div className="checkout-form">
                <FormField label="Nom complet" htmlFor="checkout-name" required>
                  <Input
                    id="checkout-name"
                    value={checkoutForm.fullName}
                    onChange={event =>
                      setCheckoutForm(prev => ({ ...prev, fullName: event.target.value }))
                    }
                    placeholder="Nom et prénom"
                  />
                </FormField>
                <FormField label="Téléphone" htmlFor="checkout-phone" required>
                  <Input
                    id="checkout-phone"
                    value={checkoutForm.phone}
                    onChange={event =>
                      setCheckoutForm(prev => ({ ...prev, phone: event.target.value }))
                    }
                    placeholder="Numéro de contact"
                  />
                </FormField>
                {handoverMode === 'delivery' ? (
                  <>
                    <FormField label="Adresse de livraison" htmlFor="checkout-dropoff" required>
                      <Input
                        id="checkout-dropoff"
                        value={checkoutForm.dropoffAddress}
                        onChange={event =>
                          setCheckoutForm(prev => ({ ...prev, dropoffAddress: event.target.value }))
                        }
                        placeholder="Ex: 27 Rue Calon, 93200 Saint-Denis"
                      />
                    </FormField>
                    <FormField label="Précisions (optionnel)" htmlFor="checkout-notes">
                      <Input
                        id="checkout-notes"
                        value={checkoutForm.dropoffNotes}
                        onChange={event =>
                          setCheckoutForm(prev => ({ ...prev, dropoffNotes: event.target.value }))
                        }
                        placeholder="Étage, téléphone, horaires..."
                      />
                    </FormField>
                    <FormField label="Frais de livraison estimés" htmlFor="checkout-estimated">
                      <div
                        id="checkout-estimated"
                        className="input"
                        style={{ display: 'flex', alignItems: 'center', minHeight: '44px' }}
                      >
                        {estimatedDeliveryFee !== null
                          ? formatMoney(estimatedDeliveryFee, currency)
                          : 'Estimation indisponible'}
                      </div>
                    </FormField>
                    {estimatedDistanceKm !== null ? (
                      <p className="form-field__hint" style={{ marginTop: '-6px' }}>
                        Distance estimée : {estimatedDistanceKm.toFixed(1)} km
                      </p>
                    ) : null}
                    {!selectedCourierId ? (
                      <p className="form-field__hint" style={{ margin: 0 }}>
                        Sélectionnez un livreur avant de poursuivre.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="form-field__hint" style={{ margin: 0 }}>
                    Le vendeur vous proposera un lieu de remise après paiement sécurisé.
                  </p>
                )}
                <FormField label="Moyen de paiement" htmlFor="checkout-payment-method">
                  <div className="handover-mode" id="checkout-payment-method">
                    <button
                      type="button"
                      className={`handover-mode__option ${
                        paymentMethod === 'mobile_money' ? 'is-active' : ''
                      }`}
                      onClick={() => setPaymentMethod('mobile_money')}
                    >
                      Mobile Money
                    </button>
                    <button
                      type="button"
                      className={`handover-mode__option ${paymentMethod === 'card' ? 'is-active' : ''}`}
                      onClick={() => setPaymentMethod('card')}
                    >
                      Carte bancaire
                    </button>
                    <button
                      type="button"
                      className={`handover-mode__option ${paymentMethod === 'wallet' ? 'is-active' : ''}`}
                      onClick={() => setPaymentMethod('wallet')}
                    >
                      Wallet interne
                    </button>
                  </div>
                  {paymentMethod === 'mobile_money' ? (
                    <div style={{ marginTop: '10px' }}>
                      <FormField label="Opérateur Mobile Money" htmlFor="checkout-operator">
                        <select
                          id="checkout-operator"
                          className="input"
                          value={paymentOperator}
                          onChange={event =>
                            setPaymentOperator(event.target.value === 'orange' ? 'orange' : 'mtn')
                          }
                        >
                          <option value="mtn">MTN Mobile Money</option>
                          <option value="orange">Orange Money</option>
                        </select>
                      </FormField>
                    </div>
                  ) : null}
                  {walletSummary ? (
                    <p className="form-field__hint" style={{ marginTop: '6px' }}>
                      Solde wallet : {formatMoney(walletSummary.balance, walletSummary.currency)}
                    </p>
                  ) : null}
                  {paymentMethod === 'wallet' && walletSummary ? (
                    walletSummary.currency !== currency ? (
                      <p className="form-field__error" role="alert" style={{ marginTop: '6px' }}>
                        Le wallet est en {walletSummary.currency}, paiement en {currency}.
                      </p>
                    ) : walletSummary.balance < totalPrice ? (
                      <p className="form-field__error" role="alert" style={{ marginTop: '6px' }}>
                        Solde insuffisant pour ce paiement.
                      </p>
                    ) : null
                  ) : null}
                </FormField>
                <div className="checkout-form__actions">
                  <Button
                    className="checkout-submit-btn"
                    onClick={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                  >
                    {isSubmitting ? 'Traitement...' : 'Payer en sécurisé'}
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <aside className="listing-checkout__summary">
            <div className="summary-card">
	              <div className="summary-card__media">
	                {mainImage ? (
	                  <img src={mainImage} alt={listing?.title ?? ''} />
	                ) : (
	                  <div className="summary-card__placeholder" role="img" aria-label="Aucune image" />
	                )}
	              </div>
              <div className="summary-card__body">
                <div className="summary-card__content">
                  <h3>{listing?.title ?? 'Annonce'}</h3>
                  <p className="summary-card__price">
                    {Number.isFinite(listingPrice)
                      ? formatMoney(listingPrice, currency)
                      : '--'}
                  </p>
                </div>
                <div className="summary-card__rows">
                  <div className="summary-card__row">
                  <span>{handoverMode === 'delivery' ? 'Livraison' : 'Remise en main propre'}</span>
                  <strong>
                    {handoverMode === 'delivery'
                      ? Number.isFinite(resolvedDeliveryFee) && resolvedDeliveryFee > 0
                        ? formatMoney(resolvedDeliveryFee, currency)
                        : 'À définir'
                      : formatMoney(0, currency)}
                  </strong>
                </div>
                  {handoverMode === 'pickup' ? (
                    <div className="summary-card__row summary-card__row--note">
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                          <span aria-hidden="true" style={{ color: '#64748b', display: 'inline-flex' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M12 21s6-5.33 6-10a6 6 0 1 0-12 0c0 4.67 6 10 6 10Z"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <circle cx="12" cy="11" r="2.6" stroke="currentColor" strokeWidth="1.6" />
                            </svg>
                          </span>
                          <strong style={{ fontSize: '0.95rem', color: '#475569' }}>
                            {pickupLocationLabel || 'Localisation à confirmer'}
                          </strong>
                        </span>
                        <small style={{ color: '#6b7280', lineHeight: 1.35 }}>
                          Payez en ligne et récupérez votre achat en main propre lors de votre rendez-vous avec le vendeur.
                        </small>
                      </span>
                    </div>
                  ) : null}
                  <div className="summary-card__row summary-card__row--total">
                    <span>Total</span>
                    <strong>
                      {Number.isFinite(totalPrice)
                        ? formatMoney(totalPrice, currency)
                        : '--'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="listing-checkout__mobile-submit">
          <div className="listing-checkout__mobile-total">
            <span>Total</span>
            <strong>{Number.isFinite(totalPrice) ? formatMoney(totalPrice, currency) : '--'}</strong>
          </div>
          <Button
            className="listing-checkout__mobile-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Traitement...' : 'Payer en sécurisé'}
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}
