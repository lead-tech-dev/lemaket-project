import { http } from '@/core/api/http'

export type SearchQuerySuggestionItem = {
  id: string
  label: string
  query: string
  resultCount: number
  hits: number
}

export const searchApi = {
  suggestions: (q: string, limit = 8) =>
    http.get<SearchQuerySuggestionItem[]>(
      `/search/suggestions?q=${encodeURIComponent(q)}&limit=${limit}`
    )
}

