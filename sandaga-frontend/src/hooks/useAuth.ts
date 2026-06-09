import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../utils/constants'
import { getAuthToken, clearAuthToken, type UserAccount } from '../utils/auth'
import { setUnauthorizedHandler } from '../utils/api'
import { useI18n } from '../contexts/I18nContext'

type AuthUser = UserAccount & {
  role: 'user' | 'pro' | 'admin' | 'moderator'
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

async function pingPresence(signal?: AbortSignal) {
  const token = getAuthToken()
  if (!token) return
  const base = API_BASE_URL.replace(/\/$/, '')
  try {
    await fetch(`${base}/presence/ping`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      signal
    })
  } catch {
    // ignore network errors
  }
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

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuthToken()
      cachedUser = null
      setState({
        user: null,
        loading: false,
        error: null,
        justPromotedPro: false
      })
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    })

    return () => {
      setUnauthorizedHandler(null)
    }
  }, [])

  useEffect(() => {
    if (!state.user) return

    const controller = new AbortController()
    let intervalId: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (intervalId) return
      intervalId = setInterval(() => {
        void pingPresence(controller.signal)
      }, 60000)
    }

    const stop = () => {
      if (!intervalId) return
      clearInterval(intervalId)
      intervalId = null
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void pingPresence(controller.signal)
        start()
      } else {
        stop()
      }
    }

    void pingPresence(controller.signal)
    start()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      controller.abort()
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [state.user])

  return useMemo(
    () => ({
      user: state.user,
      loading: state.loading,
      error: state.error,
      justPromotedPro: state.justPromotedPro,
      isAuthenticated: Boolean(state.user),
      isPro: Boolean(state.user?.role === 'pro' || state.user?.role === 'admin' || state.user?.isPro),
      isAdmin: Boolean(state.user?.role === 'admin'),
      isModerator: Boolean(state.user?.role === 'moderator'),
      // Accès à la console d'administration : admin OU modérateur.
      isStaff: Boolean(state.user?.role === 'admin' || state.user?.role === 'moderator'),
      acknowledgePromotion: () =>
        setState(prev => ({ ...prev, justPromotedPro: false }))
    }),
    [state]
  )
}

export function invalidateAuthCache() {
  cachedUser = undefined
}
