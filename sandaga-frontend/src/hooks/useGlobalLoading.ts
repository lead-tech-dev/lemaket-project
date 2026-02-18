import { useEffect, useState } from 'react'
import { subscribeGlobalLoading } from '../state/globalLoading'

export function useGlobalLoading() {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const unsubscribe = subscribeGlobalLoading((count: number) => setPendingCount(count))
    return () => {
      unsubscribe()
    }
  }, [])

  return {
    pendingCount,
    isGlobalLoading: pendingCount > 0
  }
}
