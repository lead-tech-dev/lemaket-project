import { http } from '@/core/api/http'

export const presenceApi = {
  ping: () => http.post<{ ok: boolean; now?: string }>('/presence/ping')
}
