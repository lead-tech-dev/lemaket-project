import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SearchLog } from './search-log.entity'
import { SearchSynonym } from './search-synonym.entity'
import { HomeTrendingSearch } from '../home/home.types'
import { SearchRelevanceSettingsService } from './search-relevance-settings.service'
import { MonitoringMetricsService } from '../monitoring/monitoring.metrics.service'

const MAX_QUERY_LENGTH = 160
const DEFAULT_TRENDING_LIMIT = 6
const DEFAULT_LOOKBACK_DAYS = 30
const DEFAULT_SUGGESTION_LIMIT = 8
const MAX_SUGGESTION_LIMIT = 20
const DEFAULT_SUGGESTION_LOOKBACK_DAYS = 180
const MIN_QUERY_LENGTH = 2
const MIN_FUZZY_QUERY_LENGTH = 3
const MAX_CLEAN_QUERY_LENGTH = 80
const FALLBACK_CANDIDATE_LIMIT = 120
const MIN_FUZZY_SCORE = 0.5
const SEARCH_SYNONYMS_CACHE_TTL_MS = 60_000
const SEARCH_SUGGESTIONS_CACHE_TTL_MS = 30_000
const SEARCH_SUGGESTIONS_CACHE_MAX_ENTRIES = 200

export type SearchQuerySuggestion = {
  id: string
  label: string
  query: string
  resultCount: number
  hits: number
}

export type SearchSynonymsMap = Record<string, string[]>

@Injectable()
export class SearchLogsService {
  private readonly logger = new Logger(SearchLogsService.name)

  constructor(
    @InjectRepository(SearchLog)
    private readonly searchLogRepository: Repository<SearchLog>,
    @InjectRepository(SearchSynonym)
    private readonly searchSynonymRepository: Repository<SearchSynonym>,
    private readonly searchRelevanceSettingsService: SearchRelevanceSettingsService,
    private readonly monitoringMetricsService: MonitoringMetricsService
  ) {}

  private searchSynonymsCache: { expiresAt: number; map: SearchSynonymsMap } | null = null
  private searchSuggestionsCache = new Map<string, { expiresAt: number; data: SearchQuerySuggestion[] }>()

  async recordSearch(query: string, resultCount: number, locale?: string): Promise<void> {
    const trimmed = query.trim()
    if (!trimmed) {
      return
    }

    const normalized = this.normalizeQuery(trimmed)
    if (!this.isSearchableQuery(normalized)) {
      return
    }

    const log = this.searchLogRepository.create({
      query: trimmed.slice(0, MAX_QUERY_LENGTH),
      normalizedQuery: normalized.slice(0, MAX_QUERY_LENGTH),
      resultCount: Number.isFinite(resultCount) ? Math.max(0, Math.trunc(resultCount)) : 0,
      locale: locale?.trim() || null
    })

    try {
      await this.searchLogRepository.save(log)
      this.searchSuggestionsCache.clear()
    } catch {
      this.logger.warn('Unable to store search log entry.')
    }
  }

  async getTrendingSearches(
    limit: number = DEFAULT_TRENDING_LIMIT,
    lookbackDays: number = DEFAULT_LOOKBACK_DAYS
  ): Promise<HomeTrendingSearch[]> {
    const since = new Date()
    since.setDate(since.getDate() - lookbackDays)

    const rows = await this.searchLogRepository
      .createQueryBuilder('log')
      .select('log.normalizedQuery', 'normalizedQuery')
      .addSelect('MAX(log.query)', 'label')
      .addSelect('MAX(log.resultCount)', 'resultCount')
      .addSelect('COUNT(*)', 'hits')
      .where('log.createdAt >= :since', { since })
      .groupBy('log.normalizedQuery')
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy('MAX(log.resultCount)', 'DESC')
      .limit(limit)
      .getRawMany()

    return rows
      .map((row: Record<string, string>) => {
        const normalizedQuery = String(row.normalizedQuery || '').trim()
        const rawLabel = String(row.label || normalizedQuery).trim()
        const resultCount = Number(row.resultCount) || 0

        return {
          id: this.buildTrendId(normalizedQuery),
          label: this.capitalize(rawLabel) || `Tendance`,
          query: normalizedQuery || rawLabel,
          resultCount
        }
      })
      .filter(item => item.query)
  }

  async getQuerySuggestions(
    query: string,
    limit = DEFAULT_SUGGESTION_LIMIT,
    lookbackDays = DEFAULT_SUGGESTION_LOOKBACK_DAYS
  ): Promise<SearchQuerySuggestion[]> {
    const trimmed = query.trim()
    if (!trimmed) {
      return []
    }

    const normalized = this.normalizeQuery(trimmed)
    if (!this.isSearchableQuery(normalized)) {
      return []
    }

    const sanitizedLimit = Math.max(1, Math.min(MAX_SUGGESTION_LIMIT, Math.trunc(limit || DEFAULT_SUGGESTION_LIMIT)))
    const since = new Date()
    since.setDate(since.getDate() - Math.max(1, Math.trunc(lookbackDays || DEFAULT_SUGGESTION_LOOKBACK_DAYS)))
    const cacheKey = `${normalized}|${sanitizedLimit}|${since.toISOString().slice(0, 10)}`
    const now = Date.now()
    const cached = this.searchSuggestionsCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      this.monitoringMetricsService.observeSearchSuggestionsCache(true)
      return cached.data
    }

    this.monitoringMetricsService.observeSearchSuggestionsCache(false)
    const start = process.hrtime.bigint()

    const rows = await this.searchLogRepository.query(
      `
        SELECT
          log."normalizedQuery" AS "normalizedQuery",
          MAX(log."query") AS "label",
          MAX(log."resultCount") AS "maxResultCount",
          COUNT(*)::int AS "hits",
          MAX(log."createdAt") AS "lastSeenAt",
          CASE WHEN log."normalizedQuery" LIKE $1 THEN 0 ELSE 1 END AS "prefixPriority"
        FROM "search_logs" log
        WHERE log."createdAt" >= $2
          AND log."normalizedQuery" LIKE $3
        GROUP BY log."normalizedQuery"
        ORDER BY "prefixPriority" ASC, "hits" DESC, "maxResultCount" DESC, "lastSeenAt" DESC
        LIMIT $4
      `,
      [`${normalized}%`, since.toISOString(), `%${normalized}%`, sanitizedLimit]
    )

    let data = this.mapSuggestionRows(rows)
    const inputKey = this.normalizeSuggestionKey(normalized)
    const hasAlternative = data.some(item => this.normalizeSuggestionKey(item.query) !== inputKey)

    if (normalized.length >= MIN_FUZZY_QUERY_LENGTH && (!data.length || !hasAlternative)) {
      const fuzzyMatches = await this.getFuzzySuggestions(normalized, sanitizedLimit, since)
      if (fuzzyMatches.length > 0) {
        data = this.mergeSuggestionLists(data, fuzzyMatches, sanitizedLimit)
      }
    }

    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9
    this.monitoringMetricsService.observeSearchSuggestionsQuery(durationSeconds, data.length)
    this.storeSuggestionsCacheEntry(cacheKey, data)
    return data
  }

  async getSearchSynonymsMap(forceRefresh = false): Promise<SearchSynonymsMap> {
    const searchRelevanceSettings = await this.searchRelevanceSettingsService.getSettings(forceRefresh)
    if (!searchRelevanceSettings.enableDynamicSynonyms) {
      return {}
    }

    const now = Date.now()
    if (!forceRefresh && this.searchSynonymsCache && this.searchSynonymsCache.expiresAt > now) {
      return this.searchSynonymsCache.map
    }

    const synonyms = await this.searchSynonymRepository.find({
      where: {
        isActive: true
      }
    })

    const map = this.buildSearchSynonymsMap(synonyms)
    this.searchSynonymsCache = {
      expiresAt: now + SEARCH_SYNONYMS_CACHE_TTL_MS,
      map
    }
    return map
  }

  async listSearchSynonyms(): Promise<SearchSynonym[]> {
    return this.searchSynonymRepository.find({
      order: {
        normalizedTerm: 'ASC',
        normalizedSynonym: 'ASC'
      }
    })
  }

  async upsertSearchSynonym(
    term: string,
    synonym: string,
    isActive = true
  ): Promise<SearchSynonym> {
    const normalizedTerm = this.normalizeSynonymToken(term)
    const normalizedSynonym = this.normalizeSynonymToken(synonym)
    if (!normalizedTerm || !normalizedSynonym) {
      throw new Error('Term and synonym must contain at least one alphanumeric token.')
    }
    if (normalizedTerm === normalizedSynonym) {
      throw new Error('Term and synonym must be different.')
    }

    const pair = await this.searchSynonymRepository.findOne({
      where: {
        normalizedTerm,
        normalizedSynonym
      }
    })

    const payload = {
      term: this.cleanQueryText(term),
      synonym: this.cleanQueryText(synonym),
      normalizedTerm,
      normalizedSynonym,
      isActive
    }

    const saved = pair
      ? await this.searchSynonymRepository.save({
          ...pair,
          ...payload
        })
      : await this.searchSynonymRepository.save(this.searchSynonymRepository.create(payload))

    this.searchSynonymsCache = null
    this.searchSuggestionsCache.clear()
    this.searchRelevanceSettingsService.invalidateCache()
    return saved
  }

  async deleteSearchSynonym(id: string): Promise<void> {
    await this.searchSynonymRepository.delete({ id })
    this.searchSynonymsCache = null
    this.searchSuggestionsCache.clear()
    this.searchRelevanceSettingsService.invalidateCache()
  }

  private normalizeQuery(value: string): string {
    const deaccented = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    return deaccented
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private cleanQueryText(value: string): string {
    return value
      .replace(/\s+/g, ' ')
      .replace(/\s([?.!,;:])/g, '$1')
      .trim()
      .slice(0, MAX_CLEAN_QUERY_LENGTH)
  }

  private normalizeSuggestionKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim()
  }

  private normalizeSynonymToken(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim()
  }

  private mapSuggestionRows(rows: Record<string, string>[]): SearchQuerySuggestion[] {
    const seen = new Set<string>()
    return rows
      .map((row: Record<string, string>) => {
        const normalizedQuery = this.normalizeQuery(String(row.normalizedQuery || ''))
        const rawLabel = this.cleanQueryText(String(row.label || normalizedQuery))
        const resultCount = Number(row.maxResultCount) || 0
        const hits = Number(row.hits) || 0
        if (!this.isSearchableQuery(normalizedQuery)) {
          return null
        }
        const dedupeKey = this.normalizeSuggestionKey(normalizedQuery)
        if (!dedupeKey || seen.has(dedupeKey)) {
          return null
        }
        seen.add(dedupeKey)

        return {
          id: this.buildTrendId(`suggestion-${dedupeKey}`),
          label: this.toDisplayLabel(rawLabel || normalizedQuery),
          query: normalizedQuery,
          resultCount,
          hits
        } satisfies SearchQuerySuggestion
      })
      .filter((item): item is SearchQuerySuggestion => Boolean(item?.query))
  }

  private async getFuzzySuggestions(
    normalizedInput: string,
    limit: number,
    since: Date
  ): Promise<SearchQuerySuggestion[]> {
    const rows = await this.searchLogRepository.query(
      `
        SELECT
          log."normalizedQuery" AS "normalizedQuery",
          MAX(log."query") AS "label",
          MAX(log."resultCount") AS "maxResultCount",
          COUNT(*)::int AS "hits"
        FROM "search_logs" log
        WHERE log."createdAt" >= $1
          AND log."normalizedQuery" IS NOT NULL
        GROUP BY log."normalizedQuery"
        ORDER BY "hits" DESC, "maxResultCount" DESC
        LIMIT $2
      `,
      [since.toISOString(), FALLBACK_CANDIDATE_LIMIT]
    )

    const normalizedInputKey = this.normalizeSuggestionKey(normalizedInput)
    return this.mapSuggestionRows(rows)
      .map(item => {
        const score = this.computeFuzzySuggestionScore(normalizedInput, item.query)
        return { ...item, score }
      })
      .filter(item => {
        const candidateKey = this.normalizeSuggestionKey(item.query)
        if (!candidateKey || candidateKey === normalizedInputKey) {
          return false
        }
        return item.score >= MIN_FUZZY_SCORE
      })
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score
        }
        if (b.hits !== a.hits) {
          return b.hits - a.hits
        }
        if (b.resultCount !== a.resultCount) {
          return b.resultCount - a.resultCount
        }
        return a.query.localeCompare(b.query)
      })
      .slice(0, limit)
      .map(({ score, ...item }) => item)
  }

  private mergeSuggestionLists(
    primary: SearchQuerySuggestion[],
    fallback: SearchQuerySuggestion[],
    limit: number
  ): SearchQuerySuggestion[] {
    const merged: SearchQuerySuggestion[] = []
    const seen = new Set<string>()

    const add = (item: SearchQuerySuggestion) => {
      const key = this.normalizeSuggestionKey(item.query)
      if (!key || seen.has(key)) {
        return
      }
      seen.add(key)
      merged.push(item)
    }

    primary.forEach(add)
    fallback.forEach(add)
    return merged.slice(0, limit)
  }

  private computeFuzzySuggestionScore(input: string, candidate: string): number {
    const normalizedInput = this.normalizeSuggestionKey(input)
    const normalizedCandidate = this.normalizeSuggestionKey(candidate)
    if (!normalizedInput || !normalizedCandidate) {
      return 0
    }

    const distance = this.levenshteinDistance(normalizedInput, normalizedCandidate)
    const maxLength = Math.max(normalizedInput.length, normalizedCandidate.length, 1)
    const similarity = 1 - distance / maxLength
    const prefixBonus =
      normalizedCandidate.startsWith(normalizedInput) || normalizedInput.startsWith(normalizedCandidate)
        ? 0.18
        : 0
    const containsBonus =
      normalizedCandidate.includes(normalizedInput) || normalizedInput.includes(normalizedCandidate)
        ? 0.08
        : 0
    return similarity + prefixBonus + containsBonus
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0
    if (!a.length) return b.length
    if (!b.length) return a.length

    const rows = a.length + 1
    const cols = b.length + 1
    const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

    for (let i = 0; i < rows; i += 1) matrix[i][0] = i
    for (let j = 0; j < cols; j += 1) matrix[0][j] = j

    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        )
      }
    }

    return matrix[rows - 1][cols - 1]
  }

  private isSearchableQuery(value: string): boolean {
    if (!value || value.length < MIN_QUERY_LENGTH || value.length > MAX_CLEAN_QUERY_LENGTH) {
      return false
    }
    return /[a-z]/i.test(value)
  }

  private buildTrendId(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
    return slug ? `trend-${slug}` : `trend-${Date.now()}`
  }

  private capitalize(value: string): string {
    if (!value) {
      return value
    }
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  private toDisplayLabel(value: string): string {
    return this.cleanQueryText(value)
      .split(' ')
      .filter(Boolean)
      .map(word => `${word.charAt(0).toLocaleUpperCase('fr-FR')}${word.slice(1).toLocaleLowerCase('fr-FR')}`)
      .join(' ')
  }

  private buildSearchSynonymsMap(synonyms: SearchSynonym[]): SearchSynonymsMap {
    const map = new Map<string, Set<string>>()

    const add = (key: string, candidate: string) => {
      if (!key || !candidate || key === candidate) {
        return
      }
      if (!map.has(key)) {
        map.set(key, new Set<string>())
      }
      map.get(key)?.add(candidate)
    }

    synonyms.forEach(synonym => {
      if (!synonym.isActive) {
        return
      }
      const term = this.normalizeSynonymToken(synonym.normalizedTerm || synonym.term)
      const candidate = this.normalizeSynonymToken(synonym.normalizedSynonym || synonym.synonym)
      add(term, candidate)
      add(candidate, term)
    })

    return Object.fromEntries(
      Array.from(map.entries()).map(([key, value]) => [key, Array.from(value)])
    )
  }

  private storeSuggestionsCacheEntry(key: string, data: SearchQuerySuggestion[]) {
    const now = Date.now()
    this.pruneSuggestionCache(now)
    this.searchSuggestionsCache.set(key, {
      expiresAt: now + SEARCH_SUGGESTIONS_CACHE_TTL_MS,
      data
    })
  }

  private pruneSuggestionCache(now = Date.now()) {
    for (const [key, value] of this.searchSuggestionsCache.entries()) {
      if (value.expiresAt <= now) {
        this.searchSuggestionsCache.delete(key)
      }
    }
    if (this.searchSuggestionsCache.size <= SEARCH_SUGGESTIONS_CACHE_MAX_ENTRIES) {
      return
    }
    const overflow = this.searchSuggestionsCache.size - SEARCH_SUGGESTIONS_CACHE_MAX_ENTRIES
    const keys = Array.from(this.searchSuggestionsCache.keys()).slice(0, overflow)
    keys.forEach(key => this.searchSuggestionsCache.delete(key))
  }
}
