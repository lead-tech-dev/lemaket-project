import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiGet } from '../utils/api'
import { useAuth } from './useAuth'
import { useToast } from '../components/ui/Toast'
import type { ConversationSummary } from '../types/messages'
import { useI18n } from '../contexts/I18nContext'

type ConversationsResponse = {
  data: ConversationSummary[]
  nextCursor: string | null
  unreadTotal: number
}

const POLL_INTERVAL = 15000

export function useMessageNotifications() {
  const { t } = useI18n()
  const { user, isPro } = useAuth()
  const { addToast } = useToast()
  const location = useLocation()
  const [unreadTotal, setUnreadTotal] = useState(0)
  const latestMapRef = useRef<Map<string, string | null>>(new Map())

  const fetchSnapshot = useCallback(
    async (signal?: AbortSignal, silent = false) => {
      if (!user || !isPro) {
        setUnreadTotal(0)
        latestMapRef.current.clear()
        return
      }

      try {
        const response = await apiGet<ConversationsResponse>(
          '/messages/conversations?limit=10',
          { signal }
        )
        setUnreadTotal(response.unreadTotal)

        response.data.forEach(conversation => {
          const lastValue = conversation.lastMessageAt ?? null
          const previous = latestMapRef.current.get(conversation.id)
          const isUnread =
            conversation.buyer.id === user.id
              ? conversation.unreadCountBuyer > 0
              : conversation.unreadCountSeller > 0

          if (
            !silent &&
            isUnread &&
            lastValue &&
            previous &&
            lastValue !== previous &&
            !location.pathname.includes(`/dashboard/messages/${conversation.id}`)
          ) {
            const counterpart =
              user.id === conversation.buyer.id
                ? conversation.seller
                : conversation.buyer
            addToast({
              variant: 'info',
              title: t('dashboard.messages.toast.newTitle'),
              message: t('dashboard.messages.toast.newMessage', {
                name: counterpart.firstName ?? '',
                listing: conversation.listing.title ?? ''
              }),
              action: {
                label: t('dashboard.messages.open'),
                onClick: () => {
                  window.location.assign(`/dashboard/messages/${conversation.id}`)
                }
              }
            })
          }

          latestMapRef.current.set(conversation.id, lastValue)
        })
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        if (!silent) {
          console.error('Unable to refresh conversations snapshot', err)
        }
      }
    },
    [addToast, isPro, location.pathname, user]
  )

  useEffect(() => {
    if (!user || !isPro) {
      setUnreadTotal(0)
      latestMapRef.current.clear()
      return
    }
    const controllers = new Set<AbortController>()

    const runFetch = (silent = false) => {
      const controller = new AbortController()
      controllers.add(controller)
      fetchSnapshot(controller.signal, silent)
        .catch(() => {
        /* handled */
      })
        .finally(() => {
          controllers.delete(controller)
        })
    }

    runFetch(false)

    const interval = window.setInterval(() => {
      runFetch(true)
    }, POLL_INTERVAL)

    return () => {
      controllers.forEach(controller => controller.abort())
      window.clearInterval(interval)
    }
  }, [fetchSnapshot, isPro, user])

  return unreadTotal
}
