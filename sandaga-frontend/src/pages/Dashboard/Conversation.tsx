
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { apiGet, apiPost } from '../../utils/api'
import { resolveMediaUrl } from '../../utils/media'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import type {
  ConversationDetail,
  ConversationMessage,
  MessageAttachment
} from '../../types/messages'
import type { Delivery } from '../../types/deliveries'
import { API_BASE_URL } from '../../utils/constants'
import { getAuthToken } from '../../utils/auth-token'
import { useI18n } from '../../contexts/I18nContext'

type MessageListResponse = {
  data: ConversationMessage[]
  nextCursor: string | null
}

type QuickReply = {
  id: string
  label: string
  content: string
  isGlobal: boolean
}

type ComposerAttachment = {
  id: string
  file: File
  previewUrl: string
  progress: number
  status: 'uploading' | 'uploaded' | 'error'
  remote?: MessageAttachment
}

const DEFAULT_LIMIT = 40

function buildTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}`
}

function isImage(mime?: string | null) {
  return !!mime && mime.startsWith('image/')
}

function formatDeliveryStatus(status?: string) {
  switch (status) {
    case 'requested':
      return 'Demande envoyée'
    case 'accepted':
      return 'Course acceptée'
    case 'picked_up':
      return 'Colis récupéré'
    case 'delivered':
      return 'Colis livré'
    case 'canceled':
      return 'Annulée'
    default:
      return status ?? '—'
  }
}

function formatEscrowStatus(status?: string) {
  switch (status) {
    case 'none':
      return 'Non initialisé'
    case 'pending':
      return 'En attente'
    case 'held':
      return 'Bloqué'
    case 'released':
      return 'Libéré'
    case 'refunded':
      return 'Remboursé'
    default:
      return status ?? '—'
  }
}

export default function Conversation() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()
  const { user } = useAuth()
  const { locale, t } = useI18n()
  const timeLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isDeliveryActionLoading, setIsDeliveryActionLoading] = useState(false)
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [deliveryInfo, setDeliveryInfo] = useState<Delivery | null>(null)
  const [pickupCode, setPickupCode] = useState<string | null>(null)
  const [showQuickReplyPicker, setShowQuickReplyPicker] = useState(false)
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState<string | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const pollRef = useRef<number | null>(null)

  const counterpartLabel = useMemo(() => {
    if (!conversation || !user) {
      return t('dashboard.conversation.counterpartFallback')
    }
    if (conversation.courier?.id === user.id) {
      const buyerName = `${conversation.buyer.firstName} ${conversation.buyer.lastName}`.trim()
      const sellerName = `${conversation.seller.firstName} ${conversation.seller.lastName}`.trim()
      return `${buyerName || conversation.buyer.firstName} <-> ${sellerName || conversation.seller.firstName}`
    }
    const counterpart = user.id === conversation.buyer.id ? conversation.seller : conversation.buyer
    const fullName = `${counterpart.firstName} ${counterpart.lastName}`.trim()
    return fullName || counterpart.firstName || counterpart.lastName || t('dashboard.conversation.counterpartFallback')
  }, [conversation, t, user])

  const isSeller = useMemo(() => {
    if (!conversation || !user) {
      return false
    }
    return user.id === conversation.seller.id
  }, [conversation, user])

  const isBuyer = useMemo(() => {
    if (!conversation || !user) {
      return false
    }
    return user.id === conversation.buyer.id
  }, [conversation, user])

  const isCourier = useMemo(() => {
    if (!conversation || !user) {
      return false
    }
    return conversation.courier?.id === user.id
  }, [conversation, user])

  const isDeliveryCancelable = useMemo(() => {
    if (!deliveryInfo) return false
    return deliveryInfo.status !== 'delivered' && deliveryInfo.status !== 'canceled'
  }, [deliveryInfo])

  const refreshDelivery = useCallback(
    async (listingId: string) => {
      try {
        const delivery = await apiGet<Delivery | null>(`/deliveries/listing/${listingId}`)
        setDeliveryInfo(delivery)
        if (!delivery || delivery.id !== deliveryInfo?.id) {
          setPickupCode(null)
        }
      } catch {
        setDeliveryInfo(null)
        setPickupCode(null)
      }
    },
    [deliveryInfo?.id]
  )

  const updateMessages = useCallback((incoming: ConversationMessage[]) => {
    setMessages(prev => {
      const map = new Map(prev.map(message => [message.id, message]))
      incoming.forEach(message => {
        map.set(message.id, message)
      })
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    })
  }, [])

  const fetchConversation = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)
    try {
      const [conv, msgs] = await Promise.all([
        apiGet<ConversationDetail>(`/messages/conversations/${id}`),
        apiGet<MessageListResponse>(`/messages/conversations/${id}/messages?limit=${DEFAULT_LIMIT}`)
      ])
      setConversation(conv)
      await refreshDelivery(conv.listing.id)
      updateMessages(msgs.data)
      setNextCursor(msgs.nextCursor)
      await apiPost(`/messages/conversations/${id}/read`)
    } catch (err) {
      console.error('Unable to load conversation', err)
      const message =
        err instanceof Error
          ? err.message
          : t('dashboard.conversation.loadError')
      setError(message)
      addToast({ variant: 'error', title: t('dashboard.conversation.loadTitle'), message })
    } finally {
      setIsLoading(false)
    }
  }, [addToast, id, refreshDelivery, t, updateMessages])

  const fetchOlderMessages = useCallback(async () => {
    if (!id || !nextCursor || isLoadingMore) {
      return
    }
    setIsLoadingMore(true)
    try {
      const response = await apiGet<MessageListResponse>(
        `/messages/conversations/${id}/messages?cursor=${encodeURIComponent(nextCursor)}&limit=${DEFAULT_LIMIT}`
      )
      setNextCursor(response.nextCursor)
      updateMessages(response.data)
    } catch (err) {
      console.error('Unable to load older messages', err)
      addToast({
        variant: 'error',
        title: t('dashboard.conversation.historyLoadTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.conversation.historyLoadError')
      })
    } finally {
      setIsLoadingMore(false)
    }
  }, [addToast, id, isLoadingMore, nextCursor, t, updateMessages])

  const pollLatestMessages = useCallback(async () => {
    if (!id) {
      return
    }
    try {
      const response = await apiGet<MessageListResponse>(
        `/messages/conversations/${id}/messages?limit=${DEFAULT_LIMIT}`
      )
      updateMessages(response.data)
      setNextCursor(response.nextCursor)
      if (conversation?.listing?.id) {
        await refreshDelivery(conversation.listing.id)
      }
      await apiPost(`/messages/conversations/${id}/read`)
    } catch (err) {
      console.error('Unable to refresh messages', err)
    }
  }, [conversation?.listing?.id, id, refreshDelivery, updateMessages])

  useEffect(() => {
    fetchConversation().catch(() => {
      /* handled */
    })
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current)
      }
    }
  }, [fetchConversation])

  useEffect(() => {
    if (!id) {
      return
    }
    pollRef.current = window.setInterval(() => {
      pollLatestMessages().catch(() => {
        /* silent */
      })
    }, 10000)
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current)
      }
    }
  }, [id, pollLatestMessages])

  useEffect(() => {
    if (!id) {
      setQuickReplies([])
      return
    }
    apiGet<QuickReply[]>('/messages/quick-replies')
      .then(data => setQuickReplies(data))
      .catch(err => console.error('Unable to load quick replies', err))
  }, [id])

  const uploadAttachment = useCallback(
    (file: File) => {
      const conversationId = id
      if (!conversationId) {
        return
      }
      const tempId = buildTempId('attachment')
      const previewUrl = URL.createObjectURL(file)
      setAttachments(prev => [
        ...prev,
        {
          id: tempId,
          file,
          previewUrl,
          progress: 0,
          status: 'uploading'
        }
      ])

      const xhr = new XMLHttpRequest()
      const base = API_BASE_URL.replace(/\/$/, '')
      const url = `${base}/messages/conversations/${conversationId}/attachments`
      xhr.open('POST', url)
      const token = getAuthToken()
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }

      xhr.upload.onprogress = event => {
        if (!event.lengthComputable) {
          return
        }
        const progress = Math.round((event.loaded / event.total) * 100)
        setAttachments(prev =>
          prev.map(attachment =>
            attachment.id === tempId
              ? { ...attachment, progress }
              : attachment
          )
        )
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          return
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText) as MessageAttachment
            setAttachments(prev =>
              prev.map(attachment =>
                attachment.id === tempId
                  ? {
                      ...attachment,
                      status: 'uploaded',
                      progress: 100,
                      remote: response
                    }
                  : attachment
              )
            )
          } catch (err) {
            console.error('Unable to parse attachment response', err)
            setAttachments(prev =>
              prev.map(attachment =>
                attachment.id === tempId
                  ? { ...attachment, status: 'error' }
                  : attachment
              )
            )
          }
        } else {
          setAttachments(prev =>
            prev.map(attachment =>
              attachment.id === tempId
                ? { ...attachment, status: 'error' }
                : attachment
            )
          )
        }
      }

      const formData = new FormData()
      formData.append('file', file)
      xhr.send(formData)
    },
    [id]
  )

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) {
      return
    }
    Array.from(files).forEach(file => uploadAttachment(file))
    event.target.value = ''
  }

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(attachment => {
      if (attachment.id === attachmentId) {
        URL.revokeObjectURL(attachment.previewUrl)
      }
      return attachment.id !== attachmentId
    }))
  }

  const handleRetryAttachment = (attachmentId: string) => {
    const attachment = attachments.find(item => item.id === attachmentId)
    if (!attachment) {
      return
    }
    uploadAttachment(attachment.file)
    setAttachments(prev => prev.filter(item => item.id !== attachmentId))
  }

  useEffect(() => {
    return () => {
      attachments.forEach(item => URL.revokeObjectURL(item.previewUrl))
    }
  }, [attachments])

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const textContent = newMessage.trim()
    if (!id || !user || (!textContent && !attachments.some(a => a.status === 'uploaded'))) {
      return
    }
    if (isSending) {
      return
    }

    const readyAttachments = attachments.filter(item => item.status === 'uploaded' && item.remote)
    if (attachments.some(item => item.status === 'uploading')) {
      addToast({
        variant: 'info',
        title: t('dashboard.conversation.uploadTitle'),
        message: t('dashboard.conversation.uploadMessage')
      })
      return
    }

    const tempId = buildTempId('message')
    const optimisticMessage: ConversationMessage = {
      id: tempId,
      content: textContent || t('dashboard.conversation.attachmentsFallback'),
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: undefined,
        isPro: user.isPro
      },
      deliveryStatus: 'sent',
      readAt: null,
      deliveredAt: null,
      attachments: readyAttachments.map(item => item.remote as MessageAttachment)
    }

    setMessages(prev => [...prev, optimisticMessage])
    setNewMessage('')
    setAttachments(prev => {
      prev.forEach(item => URL.revokeObjectURL(item.previewUrl))
      return []
    })
    setIsSending(true)

    try {
      const payload = {
        content: textContent || t('dashboard.conversation.attachmentsFallback'),
        attachmentIds: readyAttachments.map(item => (item.remote as MessageAttachment).id)
      }
      const sentMessage = await apiPost<ConversationMessage>(
        `/messages/conversations/${id}/messages`,
        payload
      )
      setMessages(prev =>
        prev.map(message => (message.id === tempId ? sentMessage : message))
      )
      await apiPost(`/messages/conversations/${id}/read`)
    } catch (err) {
      console.error('Unable to send message', err)
      setMessages(prev =>
        prev.map(message =>
          message.id === tempId
            ? { ...message, deliveryStatus: 'sent', content: `${message.content}
(${t('dashboard.conversation.sendFailedSuffix')})` }
            : message
        )
      )
      addToast({
        variant: 'error',
        title: t('dashboard.conversation.sendErrorTitle'),
        message:
          err instanceof Error ? err.message : t('dashboard.conversation.sendErrorMessage')
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleQuickReply = () => {
    if (!quickReplies.length) {
      addToast({
        variant: 'info',
        title: t('dashboard.conversation.quickReply.noneTitle'),
        message: t('dashboard.conversation.quickReply.noneMessage')
      })
      return
    }
    setSelectedQuickReplyId(quickReplies[0]?.id ?? null)
    setShowQuickReplyPicker(true)
  }

  const handleCloseQuickReplyPicker = () => {
    setShowQuickReplyPicker(false)
    setSelectedQuickReplyId(null)
  }

  const handleInsertQuickReply = () => {
    if (!selectedQuickReplyId) {
      addToast({
        variant: 'error',
        title: t('dashboard.conversation.quickReply.selectTitle'),
        message: t('dashboard.conversation.quickReply.selectMessage')
      })
      return
    }
    const reply = quickReplies.find(item => item.id === selectedQuickReplyId)
    if (!reply) {
      addToast({
        variant: 'error',
        title: t('dashboard.conversation.quickReply.invalidTitle'),
        message: t('dashboard.conversation.quickReply.invalidMessage')
      })
      return
    }
    setNewMessage(prev => `${prev ? `${prev}\n` : ''}${reply.content}`)
    handleCloseQuickReplyPicker()
  }

  const handleAiSuggest = async () => {
    if (!id) {
      return
    }
    try {
      setIsAiLoading(true)
      const response = await apiPost<{ suggestion: string }>(
        `/messages/conversations/${id}/ai-reply`
      )
      if (response?.suggestion) {
        setNewMessage(prev => `${prev ? `${prev}\n` : ''}${response.suggestion}`)
      }
    } catch (err) {
      console.error('Unable to generate AI reply', err)
      addToast({
        variant: 'error',
        title: 'IA indisponible',
        message: "Impossible de générer une réponse pour l'instant."
      })
    } finally {
      setIsAiLoading(false)
    }
  }

  const isOwnMessage = useCallback(
    (senderId: string) => {
      if (!user) {
        return false
      }
      return senderId === user.id
    },
    [user]
  )

  const handleDeliveryActionError = useCallback(
    (err: unknown) => {
      addToast({
        variant: 'error',
        title: 'Livraison',
        message:
          err instanceof Error ? err.message : "Impossible d'exécuter cette action pour le moment."
      })
    },
    [addToast]
  )

  const runDeliveryAction = useCallback(
    async (action: () => Promise<void>, successMessage?: string) => {
      if (!conversation?.listing?.id) {
        return
      }
      try {
        setIsDeliveryActionLoading(true)
        await action()
        await Promise.all([pollLatestMessages(), refreshDelivery(conversation.listing.id)])
        if (successMessage) {
          addToast({ variant: 'success', title: 'Livraison', message: successMessage })
        }
      } catch (err) {
        console.error('Unable to execute delivery action', err)
        handleDeliveryActionError(err)
      } finally {
        setIsDeliveryActionLoading(false)
      }
    },
    [addToast, conversation?.listing?.id, handleDeliveryActionError, pollLatestMessages, refreshDelivery]
  )

  const handleGetPickupCode = useCallback(() => {
    if (!deliveryInfo) return
    void runDeliveryAction(async () => {
      const response = await apiGet<{ code: string }>(`/deliveries/${deliveryInfo.id}/pickup/code`)
      setPickupCode(response.code)
    })
  }, [deliveryInfo, runDeliveryAction])

  const handleResendDeliveryCode = useCallback(() => {
    if (!deliveryInfo) return
    void runDeliveryAction(
      async () => {
        await apiGet<{ sent: boolean }>(`/deliveries/${deliveryInfo.id}/delivery/code`)
      },
      'Le code de réception a été renvoyé par SMS.'
    )
  }, [deliveryInfo, runDeliveryAction])

  const handleConfirmPickupCode = useCallback(() => {
    if (!deliveryInfo) return
    const code = window.prompt('Entrez le code de remise fourni par le vendeur')
    if (!code?.trim()) return
    void runDeliveryAction(
      async () => {
        await apiPost(`/deliveries/${deliveryInfo.id}/pickup/confirm`, { code: code.trim() })
      },
      'Retrait confirmé. La livraison est maintenant en cours.'
    )
  }, [deliveryInfo, runDeliveryAction])

  const handleConfirmDeliveryCode = useCallback(() => {
    if (!deliveryInfo) return
    const code = window.prompt("Entrez le code de réception fourni par l'acheteur")
    if (!code?.trim()) return
    void runDeliveryAction(
      async () => {
        await apiPost(`/deliveries/${deliveryInfo.id}/delivery/confirm`, { code: code.trim() })
      },
      'Livraison confirmée.'
    )
  }, [deliveryInfo, runDeliveryAction])

  const handleReleaseEscrow = useCallback(() => {
    if (!deliveryInfo) return
    void runDeliveryAction(
      async () => {
        await apiPost(`/deliveries/${deliveryInfo.id}/escrow/release`)
      },
      'Réception confirmée. Le paiement sécurisé est en cours de libération.'
    )
  }, [deliveryInfo, runDeliveryAction])

  const handleCancelDelivery = useCallback(() => {
    if (!deliveryInfo) return
    const reason = window.prompt("Motif d'annulation (optionnel)") ?? ''
    void runDeliveryAction(
      async () => {
        await apiPost(`/deliveries/${deliveryInfo.id}/cancel`, {
          reason: reason.trim() || undefined
        })
      },
      'La livraison a été annulée.'
    )
  }, [deliveryInfo, runDeliveryAction])

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{conversation?.listing.title ?? t('dashboard.conversation.titleFallback')}</h1>
            <p>{t('dashboard.conversation.subtitle', { name: counterpartLabel })}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isSeller ? (
              <Button variant="outline" onClick={handleAiSuggest} disabled={isAiLoading}>
                {isAiLoading ? 'Génération...' : 'Réponse IA'}
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleQuickReply} disabled={!quickReplies.length}>
              {t('dashboard.conversation.quickReply.insert')}
            </Button>
          </div>
        </header>

        <section className="dashboard-section">
          {deliveryInfo ? (
            <div
              style={{
                marginBottom: '16px',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid rgba(148,163,184,0.3)',
                background: '#f8fafc'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>Actions livraison</strong>
                  <p style={{ margin: 0, color: '#64748b' }}>
                    Statut: {formatDeliveryStatus(deliveryInfo.status)} · Paiement sécurisé:{' '}
                    {formatEscrowStatus(deliveryInfo.escrowStatus)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {isSeller && deliveryInfo.status === 'accepted' ? (
                    <Button variant="outline" onClick={handleGetPickupCode} disabled={isDeliveryActionLoading}>
                      Remettre le colis
                    </Button>
                  ) : null}
                  {isBuyer && deliveryInfo.status === 'picked_up' ? (
                    <Button variant="outline" onClick={handleResendDeliveryCode} disabled={isDeliveryActionLoading}>
                      Renvoyer le code SMS
                    </Button>
                  ) : null}
                  {isCourier &&
                  deliveryInfo.status === 'accepted' &&
                  deliveryInfo.escrowStatus === 'held' ? (
                    <Button variant="outline" onClick={handleConfirmPickupCode} disabled={isDeliveryActionLoading}>
                      Confirmer le retrait
                    </Button>
                  ) : null}
                  {isCourier && deliveryInfo.status === 'picked_up' ? (
                    <Button variant="outline" onClick={handleConfirmDeliveryCode} disabled={isDeliveryActionLoading}>
                      Confirmer la livraison
                    </Button>
                  ) : null}
                  {isBuyer &&
                  deliveryInfo.escrowStatus === 'held' &&
                  (deliveryInfo.status === 'delivered' || deliveryInfo.handoverMode === 'pickup') ? (
                    <Button onClick={handleReleaseEscrow} disabled={isDeliveryActionLoading}>
                      Confirmer la réception
                    </Button>
                  ) : null}
                  {isDeliveryCancelable ? (
                    <Button variant="ghost" onClick={handleCancelDelivery} disabled={isDeliveryActionLoading}>
                      Annuler
                    </Button>
                  ) : null}
                </div>
              </div>
              {pickupCode ? (
                <p style={{ margin: '10px 0 0', color: '#0f172a' }}>
                  Code de remise: <strong>{pickupCode}</strong>
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}
          {isLoading ? (
            <p style={{ padding: '1.5rem 0', color: '#6c757d' }}>
              {t('dashboard.conversation.loading')}
            </p>
          ) : (
            <div className="conversation-view">
              <div className="message-history">
                {nextCursor ? (
                  <Button
                    variant="outline"
                    onClick={fetchOlderMessages}
                    disabled={isLoadingMore}
                    style={{ alignSelf: 'center', marginBottom: '12px' }}
                  >
                    {isLoadingMore ? t('dashboard.conversation.loadingMore') : t('dashboard.conversation.loadPrevious')}
                  </Button>
                ) : null}
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`message-bubble ${isOwnMessage(msg.sender.id) ? 'seller' : 'buyer'}`}
                  >
                    <div className="message-bubble__content">
                      {msg.content ? <p>{msg.content}</p> : null}
                      {msg.attachments?.length ? (
                        <div className="message-attachments">
                          {msg.attachments.map(attachment =>
                            isImage(attachment.mimeType) ? (
                              <a
                                key={attachment.id}
                                href={resolveMediaUrl(attachment.url)}
                                target="_blank"
                                rel="noreferrer"
                                className="message-attachment message-attachment--image"
                              >
                                <img src={resolveMediaUrl(attachment.url)} alt={attachment.fileName} />
                              </a>
                            ) : (
                              <a
                                key={attachment.id}
                                href={resolveMediaUrl(attachment.url)}
                                target="_blank"
                                rel="noreferrer"
                                className="message-attachment"
                              >
                                📎 {attachment.fileName}
                              </a>
                            )
                          )}
                        </div>
                      ) : null}
                    </div>
                    <span className="message-timestamp">
                      {new Date(msg.created_at).toLocaleTimeString(timeLocale, {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {isOwnMessage(msg.sender.id) ? (
                      <span className="message-delivery">
                        {msg.deliveryStatus === 'read'
                          ? '✔✔'
                          : msg.deliveryStatus === 'delivered'
                          ? '✔✔'
                          : '✔'}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              <form className="message-composer" onSubmit={handleSendMessage}>
                <textarea
                  value={newMessage}
                  onChange={event => setNewMessage(event.target.value)}
                  placeholder={t('dashboard.conversation.composer.placeholder')}
                  disabled={isSending}
                  rows={3}
                  className="input"
                />
                <div className="composer-attachments">
                  <label className="btn btn--outline" style={{ cursor: 'pointer' }}>
                    {t('dashboard.conversation.composer.attach')}
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <div className="composer-attachments__list">
                    {attachments.map(attachment => (
                      <div key={attachment.id} className={`composer-attachment composer-attachment--${attachment.status}`}>
                        <span>{attachment.file.name}</span>
                        {attachment.status === 'uploading' ? (
                          <span>{attachment.progress}%</span>
                        ) : null}
                        {attachment.status === 'error' ? (
                          <Button variant="outline" onClick={() => handleRetryAttachment(attachment.id)}>
                            {t('dashboard.conversation.composer.retry')}
                          </Button>
                        ) : null}
                        <Button variant="ghost" onClick={() => handleRemoveAttachment(attachment.id)}>
                          {t('dashboard.conversation.composer.remove')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="composer-actions">
                  <Button type="submit" disabled={isSending || (!newMessage.trim() && !attachments.length)}>
                    {isSending ? t('dashboard.conversation.composer.sending') : t('dashboard.conversation.composer.send')}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={showQuickReplyPicker}
        title={t('dashboard.conversation.quickReply.modalTitle')}
        description={t('dashboard.conversation.quickReply.modalDescription')}
        onClose={handleCloseQuickReplyPicker}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Button variant="ghost" onClick={handleCloseQuickReplyPicker}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleInsertQuickReply}>{t('dashboard.conversation.quickReply.insertButton')}</Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          {quickReplies.map(reply => (
            <label
              key={reply.id}
              className="form-field form-field--inline"
              style={{ alignItems: 'flex-start' }}
            >
              <div className="form-field__control" style={{ alignItems: 'flex-start', gap: '12px' }}>
                <input
                  type="radio"
                  name="quick-reply"
                  checked={selectedQuickReplyId === reply.id}
                  onChange={() => setSelectedQuickReplyId(reply.id)}
                />
                <div style={{ display: 'grid', gap: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{reply.label}</span>
                  <p className="form-field__hint">{reply.content}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </Modal>
    </DashboardLayout>
  )
}
