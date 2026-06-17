import { API_BASE_URL } from './constants'
import { getAuthToken, clearAuthToken } from './auth-token'
import { beginGlobalLoading, endGlobalLoading } from '../state/globalLoading'

type RequestOptions = {
  signal?: AbortSignal
  body?: unknown
  headers?: Record<string, string>
  silent?: boolean
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

let preferredLocale: string | undefined
let unauthorizedHandler: (() => void) | null = null

export function setApiLocale(locale: string) {
  preferredLocale = locale
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

function buildUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/+$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function getApiUrl(path: string): string {
  return buildUrl(path)
}

async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = buildUrl(path)
  const token = getAuthToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(preferredLocale ? { 'Accept-Language': preferredLocale } : {}),
    ...(options.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }

  let body: string | undefined
  if (options.body !== undefined) {
    body = JSON.stringify(options.body)
  } else if (method !== 'GET') {
    delete headers['Content-Type']
  }

  const useGlobalLoading = !options.silent
  if (useGlobalLoading) {
    beginGlobalLoading()
  }
  try {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      signal: options.signal,
      headers,
      body
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAuthToken()
        unauthorizedHandler?.()
      }
      const rawText = await response.text().catch(() => '')
      let resolvedMessage = rawText

      if (rawText) {
        try {
          const parsed = JSON.parse(rawText)
          if (typeof parsed === 'string') {
            resolvedMessage = parsed
          } else if (Array.isArray(parsed?.message)) {
            resolvedMessage = parsed.message.join('\n')
          } else if (parsed?.message) {
            resolvedMessage = String(parsed.message)
          } else if (parsed?.error) {
            resolvedMessage = String(parsed.error)
          }
        } catch {
          // ignore JSON parse errors
        }
      }

      throw new Error(
        resolvedMessage || `Request failed with status ${response.status}`
      )
    }

    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return undefined as T
    }

    const contentType = response.headers.get('Content-Type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return (await response.text()) as unknown as T
    }

    return response.json() as Promise<T>
  } finally {
    if (useGlobalLoading) {
      endGlobalLoading()
    }
  }
}

export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>('GET', path, options)
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>
): Promise<T> {
  return apiRequest<T>('POST', path, { ...options, body })
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>
): Promise<T> {
  return apiRequest<T>('PATCH', path, { ...options, body })
}

export function apiDelete<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>
): Promise<T> {
  return apiRequest<T>('DELETE', path, { ...options, body })
}

export async function apiPostFormData<T>(
  path: string,
  body: FormData,
  options?: Omit<RequestOptions, 'body'>
): Promise<T> {
  const url = buildUrl(path)
  const token = getAuthToken()

  const headers: Record<string, string> = {
    ...(preferredLocale ? { 'Accept-Language': preferredLocale } : {}),
    ...(options?.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }

  const useGlobalLoading = !(options?.silent ?? false)
  if (useGlobalLoading) {
    beginGlobalLoading()
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      signal: options?.signal,
      headers,
      body
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAuthToken()
        unauthorizedHandler?.()
      }
      const rawText = await response.text().catch(() => '')
      let resolvedMessage = rawText

      if (rawText) {
        try {
          const parsed = JSON.parse(rawText)
          if (typeof parsed === 'string') {
            resolvedMessage = parsed
          } else if (Array.isArray(parsed?.message)) {
            resolvedMessage = parsed.message.join('\n')
          } else if (parsed?.message) {
            resolvedMessage = String(parsed.message)
          } else if (parsed?.error) {
            resolvedMessage = String(parsed.error)
          }
        } catch {
          // ignore JSON parse errors
        }
      }

      throw new Error(
        resolvedMessage || `Request failed with status ${response.status}`
      )
    }

    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return undefined as T
    }

    const contentType = response.headers.get('Content-Type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return (await response.text()) as unknown as T
    }

    return response.json() as Promise<T>
  } finally {
    if (useGlobalLoading) {
      endGlobalLoading()
    }
  }
}
