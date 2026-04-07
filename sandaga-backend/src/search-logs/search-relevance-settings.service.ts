import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { AdminSetting } from '../admin/admin-setting.entity'
import {
  DEFAULT_SEARCH_RELEVANCE_SETTINGS,
  parseCategoryWeights,
  SEARCH_RELEVANCE_SETTING_KEYS,
  SearchRelevanceSettings
} from './search-relevance-settings'

const SETTINGS_CACHE_TTL_MS = 60_000
const MIN_BOOST = 0
const MAX_BOOST = 200

@Injectable()
export class SearchRelevanceSettingsService {
  constructor(
    @InjectRepository(AdminSetting)
    private readonly adminSettingsRepository: Repository<AdminSetting>
  ) {}

  private cache: { expiresAt: number; value: SearchRelevanceSettings } | null = null

  async getSettings(forceRefresh = false): Promise<SearchRelevanceSettings> {
    const now = Date.now()
    if (!forceRefresh && this.cache && this.cache.expiresAt > now) {
      return this.cache.value
    }

    const keys = Object.values(SEARCH_RELEVANCE_SETTING_KEYS)
    const rows = await this.adminSettingsRepository.find({
      where: {
        key: In(keys)
      }
    })

    const byKey = new Map(rows.map(row => [row.key, row]))
    const enableBusinessBoost = this.readBooleanSetting(
      byKey.get(SEARCH_RELEVANCE_SETTING_KEYS.enableBusinessBoost),
      DEFAULT_SEARCH_RELEVANCE_SETTINGS.enableBusinessBoost
    )
    const enableDynamicSynonyms = this.readBooleanSetting(
      byKey.get(SEARCH_RELEVANCE_SETTING_KEYS.enableDynamicSynonyms),
      DEFAULT_SEARCH_RELEVANCE_SETTINGS.enableDynamicSynonyms
    )
    const popularCityBoost = this.readNumberSetting(
      byKey.get(SEARCH_RELEVANCE_SETTING_KEYS.popularCityBoost),
      DEFAULT_SEARCH_RELEVANCE_SETTINGS.popularCityBoost
    )
    const proSellerBoost = this.readNumberSetting(
      byKey.get(SEARCH_RELEVANCE_SETTING_KEYS.proSellerBoost),
      DEFAULT_SEARCH_RELEVANCE_SETTINGS.proSellerBoost
    )
    const categoryWeightsRaw = this.readStringSetting(
      byKey.get(SEARCH_RELEVANCE_SETTING_KEYS.categoryWeights),
      DEFAULT_SEARCH_RELEVANCE_SETTINGS.categoryWeightsText
    )
    const parsedCategoryWeights = parseCategoryWeights(
      categoryWeightsRaw,
      DEFAULT_SEARCH_RELEVANCE_SETTINGS.categoryPriorityWeights
    )

    const value: SearchRelevanceSettings = {
      enableBusinessBoost,
      enableDynamicSynonyms,
      popularCityBoost,
      proSellerBoost,
      categoryPriorityWeights: parsedCategoryWeights.map,
      categoryWeightsText: parsedCategoryWeights.text
    }
    this.cache = {
      expiresAt: now + SETTINGS_CACHE_TTL_MS,
      value
    }

    return value
  }

  async updateSettings(
    input: Partial<{
      enableBusinessBoost: boolean
      enableDynamicSynonyms: boolean
      popularCityBoost: number
      proSellerBoost: number
      categoryWeightsText: string
    }>
  ): Promise<SearchRelevanceSettings> {
    const updates: { key: string; value: unknown }[] = []

    if (input.enableBusinessBoost !== undefined) {
      updates.push({
        key: SEARCH_RELEVANCE_SETTING_KEYS.enableBusinessBoost,
        value: Boolean(input.enableBusinessBoost)
      })
    }
    if (input.enableDynamicSynonyms !== undefined) {
      updates.push({
        key: SEARCH_RELEVANCE_SETTING_KEYS.enableDynamicSynonyms,
        value: Boolean(input.enableDynamicSynonyms)
      })
    }
    if (input.popularCityBoost !== undefined) {
      updates.push({
        key: SEARCH_RELEVANCE_SETTING_KEYS.popularCityBoost,
        value: this.clampBoost(input.popularCityBoost)
      })
    }
    if (input.proSellerBoost !== undefined) {
      updates.push({
        key: SEARCH_RELEVANCE_SETTING_KEYS.proSellerBoost,
        value: this.clampBoost(input.proSellerBoost)
      })
    }
    if (input.categoryWeightsText !== undefined) {
      const parsed = parseCategoryWeights(input.categoryWeightsText)
      updates.push({
        key: SEARCH_RELEVANCE_SETTING_KEYS.categoryWeights,
        value: parsed.text
      })
    }

    for (const update of updates) {
      await this.upsertSetting(update.key, update.value)
    }

    this.cache = null
    return this.getSettings(true)
  }

  invalidateCache() {
    this.cache = null
  }

  private async upsertSetting(key: string, value: unknown): Promise<void> {
    const payload = {
      value
    }
    const existing = await this.adminSettingsRepository.findOne({
      where: {
        key
      }
    })
    if (!existing) {
      await this.adminSettingsRepository.save(
        this.adminSettingsRepository.create({
          key,
          value: payload
        })
      )
      return
    }
    existing.value = payload
    await this.adminSettingsRepository.save(existing)
  }

  private readSettingValue(setting: AdminSetting | null | undefined): unknown {
    if (!setting || setting.value === null || setting.value === undefined) {
      return undefined
    }
    if (typeof setting.value === 'object' && setting.value && 'value' in setting.value) {
      return (setting.value as Record<string, unknown>).value
    }
    return setting.value
  }

  private readBooleanSetting(setting: AdminSetting | null | undefined, fallback: boolean): boolean {
    const raw = this.readSettingValue(setting)
    if (typeof raw === 'boolean') {
      return raw
    }
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
    return fallback
  }

  private readNumberSetting(setting: AdminSetting | null | undefined, fallback: number): number {
    const raw = this.readSettingValue(setting)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      return fallback
    }
    return this.clampBoost(parsed)
  }

  private readStringSetting(setting: AdminSetting | null | undefined, fallback: string): string {
    const raw = this.readSettingValue(setting)
    if (typeof raw !== 'string') {
      return fallback
    }
    return raw.trim() || fallback
  }

  private clampBoost(value: number): number {
    return Math.min(MAX_BOOST, Math.max(MIN_BOOST, Math.round(value)))
  }
}
