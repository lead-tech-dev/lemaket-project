import { API_BASE_URL } from '@/core/config/env'
import { getAccessToken } from '@/core/auth/token-storage'

export type MediaUploadResponse = {
  url: string
  key?: string
}

const createUploadFormData = (assetUri: string) => {
  const fileName = assetUri.split('/').pop() || `photo-${Date.now()}.jpg`
  const extension = fileName.split('.').pop()?.toLowerCase()
  const mimeType = extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : 'image/jpeg'

  const formData = new FormData()
  formData.append('file', {
    uri: assetUri,
    name: fileName,
    type: mimeType
  } as any)

  return formData
}

export const mediaApi = {
  uploadImage: async (assetUri: string): Promise<MediaUploadResponse> => {
    const token = getAccessToken()
    const response = await fetch(`${API_BASE_URL}/media/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: createUploadFormData(assetUri)
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(message || `Upload failed (${response.status})`)
    }

    return response.json() as Promise<MediaUploadResponse>
  }
}
