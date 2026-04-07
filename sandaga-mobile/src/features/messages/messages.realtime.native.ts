import { API_BASE_URL } from '@/core/config/env'
import { getAccessToken } from '@/core/auth/token-storage'
import EventSource from 'react-native-sse'

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
  if (!raw) return null
  try {
    return JSON.parse(raw) as MessageRealtimeEvent
  } catch {
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
  let eventSource: EventSource | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryAttempt = 0

  const handleMessage = (event: { data?: string }) => {
    const payload = parseEventData(event?.data ?? '')
    if (payload) {
      onEvent(payload)
    }
  }

  const cleanupEventSource = () => {
    try {
      eventSource?.removeEventListener('message', handleMessage)
      eventSource?.removeEventListener('open', handleOpen)
      eventSource?.removeEventListener('error', handleError)
      eventSource?.close()
    } catch {
      // noop
    }
    eventSource = null
  }

  const scheduleReconnect = () => {
    if (closed) return
    const delay = Math.min(30000, 2000 * (retryAttempt + 1))
    retryAttempt += 1
    retryTimer = setTimeout(connect, delay)
  }

  const handleOpen = () => {
    retryAttempt = 0
    onStatusChange?.('connected')
  }

  const handleError = () => {
    if (closed) return
    cleanupEventSource()
    onStatusChange?.('fallback')
    onFallbackPollingRequired?.()
    scheduleReconnect()
  }

  const connect = () => {
    if (closed) return
    onStatusChange?.('connecting')
    try {
      eventSource = new EventSource(buildUrl('/messages/events'), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
    } catch {
      onStatusChange?.('fallback')
      onFallbackPollingRequired?.()
      scheduleReconnect()
      return
    }

    eventSource.addEventListener('message', handleMessage)
    eventSource.addEventListener('open', handleOpen)
    eventSource.addEventListener('error', handleError)
  }

  connect()

  if (signal) {
    if (signal.aborted) {
      handleError()
    } else {
      signal.addEventListener('abort', handleError)
    }
  }

  return () => {
    closed = true
    if (retryTimer) {
      clearTimeout(retryTimer)
    }
    try {
      signal?.removeEventListener('abort', handleError)
      cleanupEventSource()
    } catch {
      // noop
    }
  }
}
