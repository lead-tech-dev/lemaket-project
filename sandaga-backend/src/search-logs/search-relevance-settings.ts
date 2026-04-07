export const SEARCH_RELEVANCE_SETTING_KEYS = {
  enableBusinessBoost: 'search.relevance.enableBusinessBoost',
  enableDynamicSynonyms: 'search.relevance.enableDynamicSynonyms',
  popularCityBoost: 'search.relevance.popularCityBoost',
  proSellerBoost: 'search.relevance.proSellerBoost',
  categoryWeights: 'search.relevance.categoryWeights'
} as const

export const DEFAULT_SEARCH_CATEGORY_PRIORITY_WEIGHTS: Record<string, number> = {
  immobilier: 26,
  vehicules: 22,
  vehicule: 22,
  emploi: 20,
  materielprofessionnel: 18,
  multimedia: 16,
  services: 14,
  vacances: 12,
  animaux: 11,
  loisirs: 10,
  mode: 10,
  maison: 9,
  divers: 7
}

export type SearchRelevanceSettings = {
  enableBusinessBoost: boolean
  enableDynamicSynonyms: boolean
  popularCityBoost: number
  proSellerBoost: number
  categoryPriorityWeights: Record<string, number>
  categoryWeightsText: string
}

export const DEFAULT_SEARCH_RELEVANCE_SETTINGS: SearchRelevanceSettings = {
  enableBusinessBoost: true,
  enableDynamicSynonyms: true,
  popularCityBoost: 28,
  proSellerBoost: 8,
  categoryPriorityWeights: DEFAULT_SEARCH_CATEGORY_PRIORITY_WEIGHTS,
  categoryWeightsText: stringifyCategoryWeights(DEFAULT_SEARCH_CATEGORY_PRIORITY_WEIGHTS)
}

export function normalizeSearchSettingsToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

export function stringifyCategoryWeights(weights: Record<string, number>): string {
  return Object.entries(weights)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([slug, value]) => `${slug}:${Math.round(value)}`)
    .join(', ')
}

export function parseCategoryWeights(
  rawValue: string | null | undefined,
  fallback: Record<string, number> = DEFAULT_SEARCH_CATEGORY_PRIORITY_WEIGHTS
): { map: Record<string, number>; text: string } {
  if (!rawValue || typeof rawValue !== 'string') {
    return {
      map: fallback,
      text: stringifyCategoryWeights(fallback)
    }
  }

  const entries = rawValue
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)

  const map: Record<string, number> = {}
  for (const entry of entries) {
    const [slugRaw, weightRaw] = entry.split(':').map(value => value?.trim())
    const normalizedSlug = normalizeSearchSettingsToken(slugRaw ?? '')
    const parsedWeight = Number(weightRaw)
    if (!normalizedSlug || !Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      continue
    }
    map[normalizedSlug] = Math.round(parsedWeight)
  }

  if (Object.keys(map).length === 0) {
    return {
      map: fallback,
      text: stringifyCategoryWeights(fallback)
    }
  }

  return {
    map,
    text: stringifyCategoryWeights(map)
  }
}
