import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SearchLog } from './search-log.entity'
import { HomeTrendingSearch } from '../home/home.types'

const MAX_QUERY_LENGTH = 160
const DEFAULT_TRENDING_LIMIT = 6
const DEFAULT_LOOKBACK_DAYS = 30

@Injectable()
export class SearchLogsService {
  private readonly logger = new Logger(SearchLogsService.name)

  constructor(
    @InjectRepository(SearchLog)
    private readonly searchLogRepository: Repository<SearchLog>
  ) {}

  async recordSearch(query: string, resultCount: number, locale?: string): Promise<void> {
    const trimmed = query.trim()
    if (!trimmed) {
      return
    }

    const normalized = this.normalizeQuery(trimmed)
    if (normalized.length < 2) {
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
    } catch (err) {
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

  private normalizeQuery(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
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
}
