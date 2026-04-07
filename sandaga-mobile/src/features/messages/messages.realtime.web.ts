import { API_BASE_URL } from '@/core/config/env'
import { getAccessToken } from '@/core/auth/token-storage'

export type MessageRealtimeEvent = {
  type: 'message.created' | 'message.read' | 'message.delivered' | 'message.typing' | 'conversation.updated'
  conversationId: string
  messageId?: string
  payload?: unknown
}

export type RealtimeStatus = 'connecting' | 'connected' | 'fallback'

type SubscribeOptions = {
  onEvent: (event: MessageRealtimeEvent) => void
  onFallbackPollingRequired?: () => void
  onStatusChange?: (status: RealtimeStatus) => void
  signal?: AbortSignal
}

const buildUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

const parseEventData = (raw: string): MessageRealtimeEvent | null => {
  const lines = raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const dataLine = lines.find(line => line.startsWith('data:'))
  if (!dataLine) return null

  const payload = dataLine.replace(/^data:\s*/, '')
  try {
    return JSON.parse(payload) as MessageRealtimeEvent
  } catch {
    return null
  }
}

export const subscribeToMessageEvents = async ({
  onEvent,
  onFallbackPollingRequired,
  onStatusChange,
  signal
}: SubscribeOptions): Promise<() => void> => {
  const token = getAccessToken()
  if (!token) {
    onStatusChange?.('fallback')
    onFallbackPollingRequired?.()
    return () => undefined
  }

  let closed = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryAttempt = 0

  const scheduleReconnect = () => {
    if (closed) return
    const delay = Math.min(30000, 2000 * (retryAttempt + 1))
    retryAttempt += 1
    retryTimer = setTimeout(connect, delay)
  }

  const connect = async () => {
    if (closed) return
    onStatusChange?.('connecting')

    let response: Response
    try {
      response = await fetch(buildUrl('/messages/events'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          Cache: 'no-cache'
        },
        signal
      })
    } catch {
      onStatusChange?.('fallback')
      onFallbackPollingRequired?.()
      scheduleReconnect()
      return
    }

    if (!response.ok) {
      onStatusChange?.('fallback')
      onFallbackPollingRequired?.()
      scheduleReconnect()
      return
    }

    const body = response.body
    if (!body || typeof body.getReader !== 'function' || typeof TextDecoder === 'undefined') {
      onStatusChange?.('fallback')
      onFallbackPollingRequired?.()
      scheduleReconnect()
      return
    }

    onStatusChange?.('connected')
    retryAttempt = 0

    const reader = body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    try {
      while (!closed) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const segments = buffer.split('\n\n')
        buffer = segments.pop() ?? ''

        for (const segment of segments) {
          const event = parseEventData(segment)
          if (event) {
            onEvent(event)
          }
        }
      }
    } catch {
      onStatusChange?.('fallback')
      onFallbackPollingRequired?.()
      scheduleReconnect()
      return
    }
  }

  void connect()

  return () => {
    closed = true
    if (retryTimer) {
      clearTimeout(retryTimer)
    }
  }
}
