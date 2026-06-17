import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useRouter } from 'expo-router'
import { authApi, type LoginPayload } from './auth.api'
import type { AuthUser } from './auth.types'
import { hydrateAccessToken, persistAccessToken } from './token-storage'
import { setUnauthorizedHandler } from '@/core/api/http'
import { usePresencePing } from '@/features/presence/usePresencePing'

type SessionContextValue = {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (payload: LoginPayload) => Promise<void>
  signOut: () => Promise<void>
  refreshMe: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined)

export function SessionProvider({ children }: PropsWithChildren) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)

  usePresencePing(Boolean(token && user))

  const refreshMe = useCallback(async () => {
    const me = await authApi.me()
    setUser(me)
  }, [])

  useEffect(() => {
    let mounted = true

    const boot = async () => {
      try {
        const storedToken = await hydrateAccessToken()
        if (!mounted) return

        setToken(storedToken)

        if (storedToken) {
          try {
            const me = await authApi.me()
            if (!mounted) return
            setUser(me)
          } catch {
            await persistAccessToken(null)
            if (!mounted) return
            setToken(null)
            setUser(null)
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void boot()

    return () => {
      mounted = false
    }
  }, [])

  const signIn = useCallback(async (payload: LoginPayload) => {
    const response = await authApi.login(payload)
    await persistAccessToken(response.accessToken)
    setToken(response.accessToken)
    setUser(response.user)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // local logout always wins
    }
    await persistAccessToken(null)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await persistAccessToken(null)
      setToken(null)
      setUser(null)
      router.replace('/(auth)/login')
    })

    return () => {
      setUnauthorizedHandler(null)
    }
  }, [router])

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(token && user),
      signIn,
      signOut,
      refreshMe
    }),
    [user, token, isLoading, signIn, signOut, refreshMe]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used inside SessionProvider')
  }
  return context
}
