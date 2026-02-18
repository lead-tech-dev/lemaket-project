import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPost } from '../utils/api'
import { useAuth } from './useAuth'

type FollowListResponse = {
  sellerIds: string[]
}

export function useFollowedSellers() {
  const { isAuthenticated } = useAuth()
  const [sellerIds, setSellerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setSellerIds([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    apiGet<FollowListResponse>('/users/me/follows', { signal: controller.signal })
      .then(data => {
        setSellerIds(data.sellerIds ?? [])
      })
      .catch(err => {
        if (controller.signal.aborted) return
        console.error('Unable to load followed sellers', err)
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
      })

    return () => controller.abort()
  }, [isAuthenticated])

  const isFollowing = useMemo(() => {
    const set = new Set(sellerIds)
    return (sellerId?: string | null) => {
      if (!sellerId) return false
      return set.has(sellerId)
    }
  }, [sellerIds])

  const followSeller = async (sellerId: string) => {
    await apiPost(`/users/${sellerId}/follow`)
    setSellerIds(prev => (prev.includes(sellerId) ? prev : [...prev, sellerId]))
  }

  const unfollowSeller = async (sellerId: string) => {
    await apiDelete(`/users/${sellerId}/follow`)
    setSellerIds(prev => prev.filter(id => id !== sellerId))
  }

  const setFollowed = (sellerId: string, next: boolean) => {
    setSellerIds(prev => {
      if (next) {
        return prev.includes(sellerId) ? prev : [...prev, sellerId]
      }
      return prev.filter(id => id !== sellerId)
    })
  }

  return {
    sellerIds,
    isFollowing,
    followSeller,
    unfollowSeller,
    setFollowed,
    loading
  }
}
