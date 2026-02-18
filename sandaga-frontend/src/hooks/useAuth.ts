import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../utils/constants'
import { getAuthToken, clearAuthToken, type UserAccount } from '../utils/auth'
import { useI18n } from '../contexts/I18nContext'

type AuthUser = UserAccount & {
  role: 'user' | 'pro' | 'admin'
}

type AuthState = {
  user: AuthUser | null
  loading: boolean
  error: string | null
  justPromotedPro: boolean
}

let cachedUser: AuthUser | null | undefined

async function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser | null> {
  const base = API_BASE_URL.replace(/\/$/, '')
  const token = getAuthToken()
  if (!token) {
    return null
  }
  const response = await fetch(`${base}/users/me`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    signal
  })

  if (response.status === 401 || response.status === 403) {
    clearAuthToken()
    return null
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Unable to load current user (status ${response.status})`)
  }

  return response.json() as Promise<AuthUser>
}

export function useAuth() {
  const { t } = useI18n()
  const [state, setState] = useState<AuthState>(() => ({
    user: cachedUser ?? null,
    loading: cachedUser === undefined,
    error: null,
    justPromotedPro: false
  }))

  useEffect(() => {
    const token = getAuthToken()

    if (!token) {
      cachedUser = null
      setState({ user: null, loading: false, error: null, justPromotedPro: false })
      return
    }

    if (cachedUser !== undefined) {
      return
    }

    let active = true
    const controller = new AbortController()

    fetchCurrentUser(controller.signal)
      .then(user => {
        if (!active) {
          return
        }
        const previous = cachedUser
        cachedUser = user ?? null
        setState({
          user: cachedUser,
          loading: false,
          error: null,
          justPromotedPro: Boolean(
            cachedUser?.isPro && !previous?.isPro
          )
        })
      })
      .catch(error => {
        if (!active) {
          return
        }
        cachedUser = null
        setState({
          user: null,
          loading: false,
          error: error instanceof Error ? error.message : t('auth.login.error'),
          justPromotedPro: false
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  return useMemo(
    () => ({
      user: state.user,
      loading: state.loading,
      error: state.error,
      justPromotedPro: state.justPromotedPro,
      isAuthenticated: Boolean(state.user),
      isPro: Boolean(state.user?.role === 'pro' || state.user?.role === 'admin' || state.user?.isPro),
      isAdmin: Boolean(state.user?.role === 'admin'),
      acknowledgePromotion: () =>
        setState(prev => ({ ...prev, justPromotedPro: false }))
    }),
    [state]
  )
}

export function invalidateAuthCache() {
  cachedUser = undefined
}
