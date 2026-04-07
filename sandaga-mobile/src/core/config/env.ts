import Constants from 'expo-constants'

const DEFAULT_API_PORT = '3000'

const isLoopbackHost = (value: string): boolean =>
  /localhost|127\.0\.0\.1|\[::1\]/i.test(value)

const extractHost = (candidate: string | undefined): string | null => {
  if (!candidate) {
    return null
  }

  const cleaned = candidate
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .trim()

  return cleaned || null
}

const getExpoHost = (): string | null => {
  const expoAny = Constants as unknown as {
    expoConfig?: { hostUri?: string }
    expoGoConfig?: { debuggerHost?: string; hostUri?: string }
    manifest?: { debuggerHost?: string }
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } }
  }

  const candidates = [
    expoAny.expoConfig?.hostUri,
    expoAny.expoGoConfig?.hostUri,
    expoAny.expoGoConfig?.debuggerHost,
    expoAny.manifest?.debuggerHost,
    expoAny.manifest2?.extra?.expoClient?.hostUri
  ]

  for (const candidate of candidates) {
    const host = extractHost(candidate)
    if (host) {
      return host
    }
  }

  return null
}

const normalizeBaseUrl = (value: string | undefined): string => {
  const raw = (value ?? '').trim()
  const expoHost = getExpoHost()

  if (!raw) {
    return expoHost ? `http://${expoHost}:${DEFAULT_API_PORT}` : `http://localhost:${DEFAULT_API_PORT}`
  }

  if (isLoopbackHost(raw) && expoHost) {
    return raw
      .replace(/localhost|127\.0\.0\.1|\[::1\]/gi, expoHost)
      .replace(/\/+$/, '')
  }

  return raw.replace(/\/+$/, '')
}

export const API_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL)
