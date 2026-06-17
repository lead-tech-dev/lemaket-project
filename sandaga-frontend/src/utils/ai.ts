import { apiPost } from './api'
import type { Listing } from '../types/listing'

export interface VisualSearchResult {
  category: string | null
  confidence: number | null
  matches: Listing[]
}

/**
 * Recherche visuelle par IA. Tente un appel au backend de reconnaissance
 * d'image. Tant que cet endpoint n'existe pas, l'appel échoue et l'appelant
 * doit gérer un fallback gracieux (cf. page VisualSearch).
 */
export const visualSearch = async (imageDataUrl: string): Promise<VisualSearchResult> => {
  return apiPost<VisualSearchResult>('/search/visual', { image: imageDataUrl }, { silent: true })
}
