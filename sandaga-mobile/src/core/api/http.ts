import { API_BASE_URL } from '@/core/config/env'
import { getAccessToken } from '@/core/auth/token-storage'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

type RequestOptions = {
  body?: unknown
  signal?: AbortSignal
}

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let unauthorizedHandler: (() => void | Promise<void>) | null = null

export const setUnauthorizedHandler = (handler: (() => void | Promise<void>) | null) => {
  unauthorizedHandler = handler
}

const buildUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

async function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAccessToken()
  const hasBody = options.body !== undefined

  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    signal: options.signal,
    body: hasBody ? JSON.stringify(options.body) : undefined
  })

  if (!response.ok) {
    const raw = await response.text().catch(() => '')
    let message = raw || `HTTP ${response.status}`

    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.message)) {
          message = parsed.message.join('\n')
        } else if (parsed?.message) {
          message = String(parsed.message)
        } else if (parsed?.error) {
          message = String(parsed.error)
        }
      } catch {
        // keep raw text
      }
    }

    if (response.status === 401 && unauthorizedHandler) {
      void unauthorizedHandler()
    }

    throw new HttpError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return (await response.text()) as T
  }

  return response.json() as Promise<T>
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...options, body }),
  del: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', path, { ...options, body })
}
