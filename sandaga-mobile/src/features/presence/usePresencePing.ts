import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { presenceApi } from './presence.api'

const PING_INTERVAL_MS = 60000

export const usePresencePing = (enabled: boolean) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const ping = async () => {
      try {
        await presenceApi.ping()
      } catch {
        // ignore network errors, will retry
      }
    }

    const start = () => {
      if (intervalRef.current) return
      intervalRef.current = setInterval(ping, PING_INTERVAL_MS)
    }

    const stop = () => {
      if (!intervalRef.current) return
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const handleStateChange = (state: string) => {
      if (state === 'active') {
        void ping()
        start()
      } else {
        stop()
      }
    }

    const subscription = AppState.addEventListener('change', handleStateChange)

    void ping()
    start()

    return () => {
      subscription.remove()
      stop()
    }
  }, [enabled])
}
