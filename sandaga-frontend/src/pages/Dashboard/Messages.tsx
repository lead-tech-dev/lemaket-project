
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { apiDelete, apiGet, apiPost } from '../../utils/api'
import { updateSettings, type PreferredContactChannel } from '../../utils/auth'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import { Skeleton } from '../../components/ui/Skeleton'
import { RetryBanner } from '../../components/ui/RetryBanner'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import type { ConversationSummary } from '../../types/messages'
import { useI18n } from '../../contexts/I18nContext'

type ConversationsResponse = {
  data: ConversationSummary[]
  nextCursor: string | null
  unreadTotal: number
}

type QuickReply = {
  id: string
  label: string
  content: string
  isGlobal: boolean
}

const DEFAULT_CONTACT_CHANNELS: PreferredContactChannel[] = ['email', 'in_app']

type MessagingSettingKey = 'emailAlerts' | 'importantSmsNotifications' | 'marketingOptIn'
type AiSettingKey = 'aiAutoReplyEnabled' | 'aiAutoReplyCooldownMinutes' | 'aiAutoReplyDailyLimit'

const DEFAULT_MESSAGING_SETTINGS: Record<MessagingSettingKey, boolean> = {
  emailAlerts: true,
  importantSmsNotifications: false,
  marketingOptIn: false
}

const DEFAULT_AI_SETTINGS: Record<AiSettingKey, boolean | number> = {
  aiAutoReplyEnabled: true,
  aiAutoReplyCooldownMinutes: 60,
  aiAutoReplyDailyLimit: 1
}

const getContactChannelOptions = (
  t: (key: string, values?: Record<string, string | number>) => string
): Array<{
  value: PreferredContactChannel
  label: string
  description: string
  locked?: boolean
}> => [
  {
    value: 'email',
    label: t('dashboard.messages.channels.email.label'),
    description: t('dashboard.messages.channels.email.description')
  },
  {
    value: 'sms',
    label: t('dashboard.messages.channels.sms.label'),
    description: t('dashboard.messages.channels.sms.description')
  },
  {
    value: 'phone',
    label: t('dashboard.messages.channels.phone.label'),
    description: t('dashboard.messages.channels.phone.description')
  },
  {
    value: 'whatsapp',
    label: t('dashboard.messages.channels.whatsapp.label'),
    description: t('dashboard.messages.channels.whatsapp.description')
  },
  {
    value: 'in_app',
    label: t('dashboard.messages.channels.inApp.label'),
    description: t('dashboard.messages.channels.inApp.description'),
    locked: true
  }
]

const normalizeChannels = (value: unknown): PreferredContactChannel[] => {
  if (!Array.isArray(value)) {
    return DEFAULT_CONTACT_CHANNELS
  }
  const normalized = Array.from(new Set(value.filter(Boolean))) as PreferredContactChannel[]
  if (!normalized.includes('in_app')) {
    normalized.push('in_app')
  }
  return normalized.length ? normalized : DEFAULT_CONTACT_CHANNELS
}

function formatRelativeDate(
  value: string | null | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
  locale: string
): string {
  if (!value) {
    return t('dashboard.messages.relative.empty')
  }
  try {
    const date = new Date(value)
    const diff = Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return t('dashboard.messages.relative.today')
    if (diff === 1) return t('dashboard.messages.relative.yesterday')
    return t('dashboard.messages.relative.daysAgo', {
      count: new Intl.NumberFormat(locale).format(diff)
    })
  } catch {
    return value ?? t('dashboard.messages.relative.empty')
  }
}

function formatParticipantName(participant?: { firstName: string; lastName: string } | null): string {
  if (!participant) {
    return '—'
  }
  const full = `${participant.firstName} ${participant.lastName}`.trim()
  return full || participant.firstName || participant.lastName || '—'
}

function getConversationUnreadForUser(
  conversation: ConversationSummary,
  userId?: string
): number {
  if (!userId) {
    return 0
  }
  if (conversation.buyer.id === userId) {
    return conversation.unreadCountBuyer
  }
  if (conversation.seller.id === userId) {
    return conversation.unreadCountSeller
  }
  if (conversation.courier?.id === userId) {
    return conversation.unreadCountCourier ?? 0
  }
  return 0
}

function getConversationPartnerLabel(
  conversation: ConversationSummary,
  userId?: string
): string {
  if (!userId) {
    return formatParticipantName(conversation.seller)
  }
  if (conversation.buyer.id === userId) {
    return formatParticipantName(conversation.seller)
  }
  if (conversation.seller.id === userId) {
    return formatParticipantName(conversation.buyer)
  }
  if (conversation.courier?.id === userId) {
    return `${formatParticipantName(conversation.buyer)} <-> ${formatParticipantName(conversation.seller)}`
  }
  return formatParticipantName(conversation.seller)
}

export default function Messages() {
  const { user, isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const { locale, t } = useI18n()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const contactChannelOptions = useMemo(() => getContactChannelOptions(t), [t])
  const numberFormatter = useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const latestMapRef = useRef<Map<string, string | null>>(new Map())
  const [showMessagingSettings, setShowMessagingSettings] = useState(false)
  const [showQuickReplyPicker, setShowQuickReplyPicker] = useState(false)
  const [showQuickReplyManager, setShowQuickReplyManager] = useState(false)
  const [quickReplyTargetId, setQuickReplyTargetId] = useState<string | null>(null)
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState<string | null>(null)
  const [quickReplyDraft, setQuickReplyDraft] = useState({ label: '', content: '' })
  const [quickReplySaving, setQuickReplySaving] = useState(false)
  const [quickReplySending, setQuickReplySending] = useState(false)
  const [quickReplyDeletingId, setQuickReplyDeletingId] = useState<string | null>(null)
  const [preferredChannels, setPreferredChannels] = useState<PreferredContactChannel[]>(
    normalizeChannels((user?.settings as Record<string, unknown> | undefined)?.preferredContactChannels)
  )
  const [channelUpdating, setChannelUpdating] = useState<PreferredContactChannel | null>(null)
  const [messagingSettings, setMessagingSettings] = useState<Record<MessagingSettingKey, boolean>>(
    DEFAULT_MESSAGING_SETTINGS
  )
  const [settingUpdating, setSettingUpdating] = useState<MessagingSettingKey | null>(null)
  const [aiSettings, setAiSettings] = useState<Record<AiSettingKey, boolean | number>>(
    DEFAULT_AI_SETTINGS
  )
  const [aiSettingUpdating, setAiSettingUpdating] = useState<AiSettingKey | null>(null)

  const fetchConversations = useCallback(
    async (cursor?: string, append = false, silent = false) => {
      if (!user) {
        setConversations([])
        setNextCursor(null)
        setUnreadTotal(0)
        return
      }
      if (!silent && !append) {
        setIsLoading(true)
        setError(null)
      }
      if (append) {
        setIsLoadingMore(true)
      }

      try {
        const params = new URLSearchParams()
        if (cursor) {
          params.set('cursor', cursor)
        }
        const response = await apiGet<ConversationsResponse>(
          params.size ? `/messages/conversations?${params.toString()}` : '/messages/conversations'
        )

        setNextCursor(response.nextCursor)
        setUnreadTotal(response.unreadTotal)

        setConversations(prev => {
          if (append) {
            const map = new Map(prev.map(item => [item.id, item]))
            response.data.forEach(item => map.set(item.id, item))
            return Array.from(map.values()).sort((a, b) =>
              new Date(b.lastMessageAt ?? '').getTime() -
              new Date(a.lastMessageAt ?? '').getTime()
            )
          }
          return response.data
        })

        if (!silent) {
          response.data.forEach(conversation => {
            const lastValue = conversation.lastMessageAt ?? null
            const previous = latestMapRef.current.get(conversation.id)
            const isUnread = getConversationUnreadForUser(conversation, user.id) > 0

            if (
              isUnread &&
              lastValue &&
              previous &&
              lastValue !== previous
            ) {
              const counterpartLabel = getConversationPartnerLabel(conversation, user.id)
              addToast({
                variant: 'info',
                title: t('dashboard.messages.toast.newTitle'),
                message: t('dashboard.messages.toast.newMessage', {
                  name: counterpartLabel,
                  listing: conversation.listing.title
                })
              })
            }

            latestMapRef.current.set(conversation.id, lastValue)
          })
        } else {
          response.data.forEach(conversation => {
            latestMapRef.current.set(conversation.id, conversation.lastMessageAt ?? null)
          })
        }
      } catch (err) {
        console.error('Unable to load conversations', err)
        if (!silent) {
          setError(
            err instanceof Error
              ? err.message
              : t('dashboard.messages.loadError')
          )
          addToast({
            variant: 'error',
            title: t('dashboard.messages.loadTitle'),
            message:
              err instanceof Error
                ? err.message
                : t('dashboard.messages.loadError')
          })
        }
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [addToast, t, user]
  )

  useEffect(() => {
    fetchConversations().catch(() => {
      /* handled via state */
    })
  }, [fetchConversations])

  useEffect(() => {
    if (!user) {
      return
    }
    const interval = window.setInterval(() => {
      fetchConversations(undefined, false, true).catch(() => {
        /* silent */
      })
    }, 15000)
    return () => window.clearInterval(interval)
  }, [fetchConversations, user])

  useEffect(() => {
    if (!user) {
      setQuickReplies([])
      return
    }
    apiGet<QuickReply[]>('/messages/quick-replies')
      .then(data => setQuickReplies(data))
      .catch(err => console.error('Unable to load quick replies', err))
  }, [user])

  useEffect(() => {
    setPreferredChannels(
      normalizeChannels((user?.settings as Record<string, unknown> | undefined)?.preferredContactChannels)
    )
    const rawSettings = (user?.settings ?? {}) as Record<string, unknown>
    setMessagingSettings({
      emailAlerts:
        typeof rawSettings.emailAlerts === 'boolean'
          ? rawSettings.emailAlerts
          : DEFAULT_MESSAGING_SETTINGS.emailAlerts,
      importantSmsNotifications:
        typeof rawSettings.importantSmsNotifications === 'boolean'
          ? rawSettings.importantSmsNotifications
          : DEFAULT_MESSAGING_SETTINGS.importantSmsNotifications,
      marketingOptIn:
        typeof rawSettings.marketingOptIn === 'boolean'
          ? rawSettings.marketingOptIn
          : DEFAULT_MESSAGING_SETTINGS.marketingOptIn
    })
    setAiSettings({
      aiAutoReplyEnabled:
        typeof rawSettings.aiAutoReplyEnabled === 'boolean'
          ? rawSettings.aiAutoReplyEnabled
          : (DEFAULT_AI_SETTINGS.aiAutoReplyEnabled as boolean),
      aiAutoReplyCooldownMinutes:
        typeof rawSettings.aiAutoReplyCooldownMinutes === 'number'
          ? rawSettings.aiAutoReplyCooldownMinutes
          : (DEFAULT_AI_SETTINGS.aiAutoReplyCooldownMinutes as number),
      aiAutoReplyDailyLimit:
        typeof rawSettings.aiAutoReplyDailyLimit === 'number'
          ? rawSettings.aiAutoReplyDailyLimit
          : (DEFAULT_AI_SETTINGS.aiAutoReplyDailyLimit as number)
    })
  }, [user])

  const handleSettingToggle = (key: MessagingSettingKey) => async (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked
    const previousValue = messagingSettings[key]
    setMessagingSettings(prev => ({ ...prev, [key]: nextValue }))
    setSettingUpdating(key)

    try {
      await updateSettings({ [key]: nextValue })
      addToast({
        variant: 'success',
        title: t('dashboard.messages.settings.savedTitle'),
        message: t('dashboard.messages.settings.savedMessage')
      })
    } catch (error) {
      console.error('Unable to update messaging setting', error)
      const message =
        error instanceof Error
          ? error.message
          : t('dashboard.messages.settings.errorMessage')
      setMessagingSettings(prev => ({ ...prev, [key]: previousValue }))
      addToast({
        variant: 'error',
        title: t('dashboard.messages.settings.errorTitle'),
        message
      })
    } finally {
      setSettingUpdating(null)
    }
  }

  const handleAiToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked
    const previousValue = aiSettings.aiAutoReplyEnabled as boolean
    setAiSettings(prev => ({ ...prev, aiAutoReplyEnabled: nextValue }))
    setAiSettingUpdating('aiAutoReplyEnabled')

    updateSettings({ aiAutoReplyEnabled: nextValue })
      .then(() => {
        addToast({
          variant: 'success',
          title: t('dashboard.messages.settings.savedTitle'),
          message: t('dashboard.messages.settings.savedMessage')
        })
      })
      .catch(error => {
        console.error('Unable to update AI setting', error)
        setAiSettings(prev => ({ ...prev, aiAutoReplyEnabled: previousValue }))
        const message =
          error instanceof Error
            ? error.message
            : t('dashboard.messages.settings.errorMessage')
        addToast({
          variant: 'error',
          title: t('dashboard.messages.settings.errorTitle'),
          message
        })
      })
      .finally(() => setAiSettingUpdating(null))
  }

  const handleAiNumberUpdate = (key: AiSettingKey, min: number, max: number) => async () => {
    const rawValue = Number(aiSettings[key])
    const nextValue = Number.isFinite(rawValue) ? Math.min(Math.max(rawValue, min), max) : min
    const previousValue = aiSettings[key]
    setAiSettings(prev => ({ ...prev, [key]: nextValue }))
    setAiSettingUpdating(key)
    try {
      await updateSettings({ [key]: nextValue } as Record<string, number>)
      addToast({
        variant: 'success',
        title: t('dashboard.messages.settings.savedTitle'),
        message: t('dashboard.messages.settings.savedMessage')
      })
    } catch (error) {
      console.error('Unable to update AI setting', error)
      setAiSettings(prev => ({ ...prev, [key]: previousValue }))
      const message =
        error instanceof Error
          ? error.message
          : t('dashboard.messages.settings.errorMessage')
      addToast({
        variant: 'error',
        title: t('dashboard.messages.settings.errorTitle'),
        message
      })
    } finally {
      setAiSettingUpdating(null)
    }
  }

  const handleChannelToggle = (channel: PreferredContactChannel) => async (event: ChangeEvent<HTMLInputElement>) => {
    const nextChecked = event.target.checked
    const previousChannels = preferredChannels

    if (!nextChecked && channel === 'in_app') {
      addToast({
        variant: 'info',
        title: t('dashboard.messages.channels.requiredTitle'),
        message: t('dashboard.messages.channels.requiredMessage')
      })
      return
    }

    let nextChannels = previousChannels
    if (nextChecked) {
      if (!previousChannels.includes(channel)) {
        nextChannels = [...previousChannels, channel]
      }
    } else {
      nextChannels = previousChannels.filter(item => item !== channel)
      if (!nextChannels.length) {
        addToast({
          variant: 'info',
          title: t('dashboard.messages.channels.minimumTitle'),
          message: t('dashboard.messages.channels.minimumMessage')
        })
        return
      }
    }

    setPreferredChannels(nextChannels)
    setChannelUpdating(channel)

    try {
      await updateSettings({ preferredContactChannels: nextChannels })
      addToast({
        variant: 'success',
        title: t('dashboard.messages.settings.savedTitle'),
        message: t('dashboard.messages.settings.savedMessage')
      })
    } catch (error) {
      console.error('Unable to update preferred channels', error)
      const message =
        error instanceof Error
          ? error.message
          : t('dashboard.messages.channels.errorMessage')
      setPreferredChannels(previousChannels)
      addToast({
        variant: 'error',
        title: t('dashboard.messages.settings.errorTitle'),
        message
      })
    } finally {
      setChannelUpdating(null)
    }
  }

  const unreadCount = useMemo(() => {
    if (!user) {
      return 0
    }
    return conversations.reduce((acc, conv) => {
      const pending = getConversationUnreadForUser(conv, user.id)
      return acc + (pending > 0 ? 1 : 0)
    }, 0)
  }, [conversations, user])

  const unreadNotice = useMemo(() => {
    if (!unreadTotal) {
      return ''
    }
    return unreadTotal === 1
      ? t('dashboard.messages.unread.single', {
          count: numberFormatter.format(unreadTotal)
        })
      : t('dashboard.messages.unread.multiple', {
          count: numberFormatter.format(unreadTotal)
        })
  }, [numberFormatter, t, unreadTotal])

  const handleLoadMore = () => {
    if (!nextCursor || isLoadingMore) {
      return
    }
    fetchConversations(nextCursor, true).catch(() => {
      /* handled in fetch */
    })
  }

  const handleManualRefresh = useCallback(() => {
    fetchConversations(undefined, false).catch(() => {
      /* handled in fetch */
    })
  }, [fetchConversations])

  const handleQuickReply = (conversationId: string) => {
    if (!quickReplies.length) {
      addToast({
        variant: 'info',
        title: t('dashboard.messages.quickReply.noneTitle'),
        message: t('dashboard.messages.quickReply.noneMessage')
      })
      return
    }

    setQuickReplyTargetId(conversationId)
    setSelectedQuickReplyId(quickReplies[0]?.id ?? null)
    setShowQuickReplyPicker(true)
  }

  const handleManageQuickReplies = () => {
    setShowQuickReplyManager(true)
  }

  const handleCloseQuickReplyPicker = () => {
    if (quickReplySending) {
      return
    }
    setShowQuickReplyPicker(false)
    setQuickReplyTargetId(null)
    setSelectedQuickReplyId(null)
  }

  const handleSendQuickReply = async () => {
    if (!quickReplyTargetId || !selectedQuickReplyId) {
      addToast({
        variant: 'error',
        title: t('dashboard.messages.quickReply.selectTitle'),
        message: t('dashboard.messages.quickReply.selectMessage')
      })
      return
    }
    const reply = quickReplies.find(item => item.id === selectedQuickReplyId)
    if (!reply) {
      addToast({
        variant: 'error',
        title: t('dashboard.messages.quickReply.invalidTitle'),
        message: t('dashboard.messages.quickReply.invalidMessage')
      })
      return
    }

    setQuickReplySending(true)
    try {
      await apiPost(`/messages/conversations/${quickReplyTargetId}/messages`, {
        content: reply.content,
        replyTemplateId: reply.id
      })
      addToast({
        variant: 'success',
        title: t('dashboard.messages.quickReply.sentTitle'),
        message: t('dashboard.messages.quickReply.sentMessage')
      })
      await fetchConversations(undefined, false, true)
      handleCloseQuickReplyPicker()
    } catch (err) {
      console.error('Unable to send quick reply', err)
      addToast({
        variant: 'error',
        title: t('dashboard.messages.quickReply.sendErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.messages.quickReply.sendErrorMessage')
      })
    } finally {
      setQuickReplySending(false)
    }
  }

  const handleCloseQuickReplyManager = () => {
    if (quickReplySaving) {
      return
    }
    setShowQuickReplyManager(false)
    setQuickReplyDraft({ label: '', content: '' })
  }

  const handleCreateQuickReply = async () => {
    const label = quickReplyDraft.label.trim()
    const content = quickReplyDraft.content.trim()
    if (!label || !content) {
      addToast({
        variant: 'error',
        title: t('dashboard.messages.quickReply.createRequiredTitle'),
        message: t('dashboard.messages.quickReply.createRequiredMessage')
      })
      return
    }

    setQuickReplySaving(true)
    try {
      const created = await apiPost<QuickReply>('/messages/quick-replies', {
        label,
        content
      })
      setQuickReplies(prev => [...prev, created])
      setQuickReplyDraft({ label: '', content: '' })
      addToast({
        variant: 'success',
        title: t('dashboard.messages.quickReply.createdTitle'),
        message: t('dashboard.messages.quickReply.createdMessage')
      })
    } catch (err) {
      console.error('Unable to create quick reply', err)
      addToast({
        variant: 'error',
        title: t('dashboard.messages.quickReply.createErrorTitle'),
        message: err instanceof Error ? err.message : t('dashboard.messages.quickReply.createErrorMessage')
      })
    } finally {
      setQuickReplySaving(false)
    }
  }

  const handleDeleteQuickReply = async (id: string) => {
    setQuickReplyDeletingId(id)
    try {
      await apiDelete(`/messages/quick-replies/${id}`)
      setQuickReplies(prev => prev.filter(item => item.id !== id))
      addToast({
        variant: 'success',
        title: t('dashboard.messages.quickReply.deletedTitle'),
        message: t('dashboard.messages.quickReply.deletedMessage')
      })
    } catch (err) {
      console.error('Unable to delete quick reply', err)
      addToast({
        variant: 'error',
        title: t('dashboard.messages.quickReply.deleteErrorTitle'),
        message: err instanceof Error ? err.message : t('dashboard.messages.quickReply.deleteErrorMessage')
      })
    } finally {
      setQuickReplyDeletingId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('dashboard.messages.title')}</h1>
            <p>
              {t('dashboard.messages.subtitle')}
              {unreadNotice ? ` ${unreadNotice}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="outline" onClick={handleManageQuickReplies}>
              {t('dashboard.messages.quickReply.manage')}
            </Button>
            <Button variant="outline" onClick={() => setShowMessagingSettings(true)}>
              {t('dashboard.messages.settings.title')}
            </Button>
          </div>
        </header>

        <section className="dashboard-section">
          {conversations.length > 0 && (
            <div className="dashboard-section__head">
              <h2>{t('dashboard.messages.section.recent')}</h2>
              {unreadCount > 0 && (
                <span>
                  {unreadCount === 1
                    ? t('dashboard.messages.unreadConversations.single', {
                        count: numberFormatter.format(unreadCount)
                      })
                    : t('dashboard.messages.unreadConversations.multiple', {
                        count: numberFormatter.format(unreadCount)
                      })}
                </span>
              )}
            </div>
          )}
          {error ? (
            <RetryBanner
              title={t('dashboard.messages.retryTitle')}
              message={error}
              accessory="⚠️"
              onRetry={handleManualRefresh}
            />
          ) : null}
          {isLoading && !conversations.length ? (
            <div className="message-list" aria-hidden>
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="message-item">
                  <div>
                    <Skeleton width="180px" height="18px" />
                    <Skeleton width="220px" height="16px" />
                  </div>
                  <Skeleton width="100%" height="18px" />
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      alignItems: 'flex-end'
                    }}
                  >
                    <Skeleton width="120px" height="14px" />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <Skeleton width="110px" height="32px" />
                      <Skeleton width="70px" height="18px" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {!isLoading && conversations.length === 0 ? (
            <EmptyState
              icon="💬"
              title={t('dashboard.messages.empty.title')}
              description={t('dashboard.messages.empty.description')}
              action={
                <Button variant="ghost" onClick={handleManualRefresh}>
                  {t('dashboard.messages.empty.action')}
                </Button>
              }
            />
          ) : null}

          {conversations.length ? (
            <div className="message-list">
              {conversations.map(conv => {
                const participantLabel = getConversationPartnerLabel(conv, user?.id)
                const unreadCountForUser = getConversationUnreadForUser(conv, user?.id)

                return (
                  <div key={conv.id} className="message-item">
                    <div>
                      <span className="message-item__title">{participantLabel}</span>
                      <span className="message-item__snippet">{conv.listing.title}</span>
                    </div>
                    <span className="message-item__snippet">
                      {conv.lastMessagePreview || t('dashboard.messages.previewFallback')}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        alignItems: 'flex-end'
                      }}
                    >
                      <span className="message-item__snippet">
                        {formatRelativeDate(conv.lastMessageAt, t, numberLocale)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {unreadCountForUser > 0 ? (
                          <span style={{ fontWeight: 600 }}>
                            {unreadCountForUser === 1
                              ? t('dashboard.messages.unreadBadge.single', {
                                  count: numberFormatter.format(unreadCountForUser)
                                })
                              : t('dashboard.messages.unreadBadge.multiple', {
                                  count: numberFormatter.format(unreadCountForUser)
                                })}
                          </span>
                        ) : null}
                        <Button variant="outline" onClick={() => handleQuickReply(conv.id)}>
                          {t('dashboard.messages.quickReply.cta')}
                        </Button>
                        <Link to={`/dashboard/messages/${conv.id}`} className="lbc-link">
                          {t('dashboard.messages.open')}
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {nextCursor ? (
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
              <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? t('dashboard.messages.loadingMore') : t('dashboard.messages.loadMore')}
              </Button>
            </div>
          ) : null}
        </section>
      </div>

      <Modal
        open={showMessagingSettings}
        title={t('dashboard.messages.settings.modalTitle')}
        description={t('dashboard.messages.settings.modalDescription')}
        onClose={() => setShowMessagingSettings(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setShowMessagingSettings(false)}>
              {t('dashboard.messages.settings.close')}
            </Button>
          </div>
        }
      >
        <div
          className="settings-form settings-form--stack"
          style={{ display: 'grid', gap: '12px' }}
        >
          {contactChannelOptions.map(option => {
            const checked = preferredChannels.includes(option.value)
            return (
              <label
                key={option.value}
                className="form-field form-field--inline settings-contact-option"
                style={{ alignItems: 'flex-start', gap: '12px' }}
              >
                <div className="form-field__control" style={{ alignItems: 'flex-start', gap: '12px' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={handleChannelToggle(option.value)}
                    disabled={channelUpdating === option.value || option.locked}
                  />
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{option.label}</span>
                    <p className="form-field__hint">{option.description}</p>
                  </div>
                </div>
                {option.locked ? (
                  <span className="badge badge--muted">
                    {t('dashboard.messages.channels.alwaysActive')}
                  </span>
                ) : null}
              </label>
            )
          })}
        </div>

        <div className="settings-form" style={{ marginTop: '20px', display: 'grid', gap: '12px' }}>
          <label className="form-field form-field--inline">
            <div className="form-field__control">
              <input
                type="checkbox"
                checked={messagingSettings.emailAlerts}
                onChange={handleSettingToggle('emailAlerts')}
                disabled={settingUpdating === 'emailAlerts'}
              />
              <span>{t('dashboard.messages.settings.emailAlerts')}</span>
            </div>
          </label>
          <label className="form-field form-field--inline">
            <div className="form-field__control">
              <input
                type="checkbox"
                checked={messagingSettings.importantSmsNotifications}
                onChange={handleSettingToggle('importantSmsNotifications')}
                disabled={settingUpdating === 'importantSmsNotifications'}
              />
              <span>{t('dashboard.messages.settings.smsAlerts')}</span>
            </div>
          </label>
          <label className="form-field form-field--inline">
            <div className="form-field__control">
              <input
                type="checkbox"
                checked={messagingSettings.marketingOptIn}
                onChange={handleSettingToggle('marketingOptIn')}
                disabled={settingUpdating === 'marketingOptIn'}
              />
              <span>{t('dashboard.messages.settings.marketingOptIn')}</span>
            </div>
          </label>
        </div>

        <div
          className="settings-form settings-form--stack"
          style={{ marginTop: '20px', display: 'grid', gap: '12px' }}
        >
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>
            Réponses automatiques IA
          </h3>
          <label className="form-field form-field--inline">
            <div className="form-field__control">
              <input
                type="checkbox"
                checked={Boolean(aiSettings.aiAutoReplyEnabled)}
                onChange={handleAiToggle}
                disabled={aiSettingUpdating === 'aiAutoReplyEnabled'}
              />
              <span>Activer les réponses automatiques</span>
            </div>
          </label>
          <div style={{ display: 'grid', gap: '10px' }}>
            <label className="form-field">
              <span style={{ fontWeight: 600 }}>Délai minimum avant auto‑réponse (minutes)</span>
              <Input
                type="number"
                min={5}
                max={720}
                value={Number(aiSettings.aiAutoReplyCooldownMinutes)}
                onChange={event =>
                  setAiSettings(prev => ({
                    ...prev,
                    aiAutoReplyCooldownMinutes: Number(event.target.value)
                  }))
                }
                onBlur={handleAiNumberUpdate('aiAutoReplyCooldownMinutes', 5, 720)}
                disabled={!aiSettings.aiAutoReplyEnabled || aiSettingUpdating === 'aiAutoReplyCooldownMinutes'}
              />
              <span className="form-field__hint">5 à 720 minutes (par défaut 60).</span>
            </label>
            <label className="form-field">
              <span style={{ fontWeight: 600 }}>Limite d’auto‑réponses par 24h</span>
              <Input
                type="number"
                min={1}
                max={10}
                value={Number(aiSettings.aiAutoReplyDailyLimit)}
                onChange={event =>
                  setAiSettings(prev => ({
                    ...prev,
                    aiAutoReplyDailyLimit: Number(event.target.value)
                  }))
                }
                onBlur={handleAiNumberUpdate('aiAutoReplyDailyLimit', 1, 10)}
                disabled={!aiSettings.aiAutoReplyEnabled || aiSettingUpdating === 'aiAutoReplyDailyLimit'}
              />
              <span className="form-field__hint">1 à 10 réponses (par défaut 1).</span>
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        open={showQuickReplyPicker}
        title={t('dashboard.messages.quickReply.modalTitle')}
        description={t('dashboard.messages.quickReply.modalDescription')}
        onClose={handleCloseQuickReplyPicker}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Button variant="ghost" onClick={handleCloseQuickReplyPicker} disabled={quickReplySending}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleSendQuickReply} disabled={quickReplySending}>
              {quickReplySending ? t('dashboard.messages.quickReply.sending') : t('dashboard.messages.quickReply.send')}
            </Button>
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

      <Modal
        open={showQuickReplyManager}
        title={t('dashboard.messages.quickReply.manageTitle')}
        description={t('dashboard.messages.quickReply.manageDescription')}
        onClose={handleCloseQuickReplyManager}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={handleCloseQuickReplyManager} disabled={quickReplySaving}>
              {t('dashboard.messages.quickReply.manageClose')}
            </Button>
          </div>
        }
      >
        <div className="settings-form settings-form--stack" style={{ display: 'grid', gap: '12px' }}>
          <label className="form-field">
            <span className="form-field__label">{t('dashboard.messages.quickReply.label')}</span>
            <Input
              value={quickReplyDraft.label}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setQuickReplyDraft(current => ({ ...current, label: event.target.value }))
              }
              placeholder={t('dashboard.messages.quickReply.labelPlaceholder')}
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('dashboard.messages.quickReply.content')}</span>
            <textarea
              className="input"
              rows={4}
              value={quickReplyDraft.content}
              onChange={event =>
                setQuickReplyDraft(current => ({ ...current, content: event.target.value }))
              }
              placeholder={t('dashboard.messages.quickReply.contentPlaceholder')}
            />
          </label>
          <Button onClick={handleCreateQuickReply} disabled={quickReplySaving}>
            {quickReplySaving
              ? t('dashboard.messages.quickReply.creating')
              : t('dashboard.messages.quickReply.create')}
          </Button>
        </div>

        <div style={{ marginTop: '20px', display: 'grid', gap: '12px' }}>
          <h4 style={{ margin: 0 }}>{t('dashboard.messages.quickReply.existingTitle')}</h4>
          {quickReplies.length ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {quickReplies.map(reply => (
                <div
                  key={reply.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <strong>{reply.label}</strong>
                    <span className="form-field__hint">{reply.content}</span>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => handleDeleteQuickReply(reply.id)}
                    disabled={quickReplyDeletingId === reply.id}
                  >
                    {quickReplyDeletingId === reply.id
                      ? t('dashboard.messages.quickReply.deleting')
                      : t('dashboard.messages.quickReply.delete')}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="form-field__hint" style={{ margin: 0 }}>
              {t('dashboard.messages.quickReply.empty')}
            </p>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  )
}
