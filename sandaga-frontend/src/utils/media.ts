import { API_BASE_URL } from './constants'
import { getAuthToken } from './auth-token'

export type UploadMediaResponse = {
  url: string
  key: string
  originalName?: string
  size?: number
  mimeType?: string
}

export type UploadMediaMessages = {
  invalidResponse?: string
  networkError?: string
}

export function uploadMedia(
  file: File,
  onProgress?: (progress: number) => void,
  messages: UploadMediaMessages = {}
): Promise<UploadMediaResponse> {
  return new Promise((resolve, reject) => {
    const base = API_BASE_URL.replace(/\/$/, '')
    const url = `${base}/media/upload`
    const token = getAuthToken()

    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    xhr.withCredentials = true

    xhr.upload.onprogress = event => {
      if (onProgress && event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100)
        onProgress(percentage)
      }
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText) as UploadMediaResponse
          resolve(parsed)
        } catch {
          reject(new Error(messages.invalidResponse ?? 'Invalid server response during upload.'))
        }
      } else {
        const message = xhr.responseText || `Upload failed with status ${xhr.status}`
        reject(new Error(message))
      }
    }

    xhr.onerror = () => {
      reject(new Error(messages.networkError ?? 'Network error during upload.'))
    }

    xhr.send(formData)
  })
}

export const resolveMediaUrl = (url: string): string => {
  if (!url) {
    return url
  }
  if (/^https?:\/\//i.test(url)) {
    return url
  }
  const base =
    API_BASE_URL?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const normalizedPath = url.replace(/^\/+/, '')
  return `${base}/${normalizedPath}`
}
