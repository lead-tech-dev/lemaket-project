import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import { apiGet } from '../../utils/api'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

type VerifyResponse = {
  ok?: boolean
  status?: string
}

const normalizeStatus = (value?: string) => (value || '').toLowerCase()

export default function PaymentReturn() {
  const location = useLocation()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const reference = params.get('reference') || params.get('tx_ref') || params.get('txRef') || ''
  const statusParam = params.get('status') || ''
  const listingId = params.get('listingId') || ''
  const [status, setStatus] = useState<'pending' | 'success' | 'failed' | 'unknown'>('pending')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const attemptsRef = useRef(0)
  const pollTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (statusParam.toLowerCase() === 'cancel') {
      setStatus('failed')
      return
    }
    if (!reference) {
      setStatus('unknown')
      return
    }

    let active = true
    const maxAttempts = 10

    const clearPoll = () => {
      if (pollTimeoutRef.current) {
        window.clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }

    const verify = async () => {
      setIsVerifying(true)
      try {
        const response = await apiGet<VerifyResponse>(
          `/payments/zikopay/verify?reference=${encodeURIComponent(reference)}`
        )
        if (!active) return
        const normalized = normalizeStatus(response?.status)
        if (['completed', 'success', 'successful', 'paid'].includes(normalized)) {
          setStatus('success')
          setIsPolling(false)
          clearPoll()
          return
        }
        if (['failed', 'cancelled', 'canceled'].includes(normalized)) {
          setStatus('failed')
          setIsPolling(false)
          clearPoll()
          return
        }
        setStatus('pending')
        attemptsRef.current += 1
        setAttempts(attemptsRef.current)
        if (attemptsRef.current < maxAttempts) {
          pollTimeoutRef.current = window.setTimeout(verify, 4000)
        } else {
          setIsPolling(false)
        }
      } catch (err) {
        if (!active) return
        console.error('Unable to verify zikopay payment', err)
        setStatus('pending')
      } finally {
        if (active) {
          setIsVerifying(false)
        }
      }
    }

    attemptsRef.current = 0
    setAttempts(0)
    setIsPolling(true)
    clearPoll()
    verify()
    return () => {
      active = false
      clearPoll()
    }
  }, [reference, statusParam, retryKey])

  useEffect(() => {
    if (status === 'success') {
      addToast({
        variant: 'success',
        title: 'Paiement confirmé',
        message: 'Votre paiement est confirmé. Vous pouvez suivre la commande.'
      })
    } else if (status === 'failed') {
      addToast({
        variant: 'error',
        title: 'Paiement échoué',
        message: 'Le paiement n’a pas abouti. Vous pouvez réessayer.'
      })
    }
  }, [status, addToast])

  const handleRetry = () => {
    setStatus('pending')
    setIsPolling(true)
    setRetryKey(prev => prev + 1)
  }

  return (
    <MainLayout>
      <div className="dashboard-section" style={{ maxWidth: '760px', margin: '0 auto' }}>
        <div className="dashboard-section__head">
          <h2>Paiement sécurisé</h2>
        </div>
        <div className="card">
          <div className="card__body" style={{ display: 'grid', gap: '12px' }}>
            {status === 'pending' ? (
              <>
                <h3 style={{ margin: 0 }}>Paiement en cours de validation</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Nous confirmons votre paiement. Cette étape peut prendre quelques instants.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isPolling ? <div className="spinner" aria-hidden /> : null}
                  <p style={{ margin: 0, color: '#6b7280' }}>
                    {isVerifying ? 'Vérification en cours…' : 'En attente de confirmation.'}
                    {attempts > 0 ? ` (tentative ${attempts})` : ''}
                  </p>
                </div>
                {!isPolling && status === 'pending' ? (
                  <p style={{ margin: 0, color: '#6b7280' }}>
                    Toujours en attente. Vous pouvez réessayer la vérification.
                  </p>
                ) : null}
              </>
            ) : null}
            {status === 'success' ? (
              <>
                <h3 style={{ margin: 0 }}>Paiement confirmé</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Votre paiement est validé. Vous recevrez une notification pour la suite.
                </p>
              </>
            ) : null}
            {status === 'failed' ? (
              <>
                <h3 style={{ margin: 0 }}>Paiement échoué</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Le paiement n’a pas pu être confirmé. Vous pouvez réessayer depuis l’annonce.
                </p>
              </>
            ) : null}
            {status === 'unknown' ? (
              <>
                <h3 style={{ margin: 0 }}>Référence de paiement introuvable</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Nous ne trouvons pas la référence de paiement. Retournez à l’annonce.
                </p>
              </>
            ) : null}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {status !== 'success' ? (
                <Button onClick={handleRetry} variant="outline" disabled={isVerifying}>
                  Réessayer
                </Button>
              ) : null}
              {listingId ? (
                <Button onClick={() => navigate(`/listing/${listingId}`)} variant="primary">
                  Retour à l’annonce
                </Button>
              ) : null}
              <Button onClick={() => navigate('/dashboard/orders')} variant="outline">
                Voir mes commandes
              </Button>
              <Link to="/" className="btn btn--outline">
                Accueil
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
