import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdminSetting } from '../admin/admin-setting.entity';
import {
  DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS,
  SEARCH_OPERATIONAL_ALERT_SETTING_KEYS,
  SearchOperationalAlertSettings
} from './search-operational-alert-settings';

const SETTINGS_CACHE_TTL_MS = 30_000;

@Injectable()
export class SearchOperationalAlertSettingsService {
  constructor(
    @InjectRepository(AdminSetting)
    private readonly adminSettingsRepository: Repository<AdminSetting>,
    private readonly configService: ConfigService
  ) {}

  private cache: { expiresAt: number; value: SearchOperationalAlertSettings } | null = null;

  async getSettings(forceRefresh = false): Promise<SearchOperationalAlertSettings> {
    const now = Date.now();
    if (!forceRefresh && this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }

    const keys = Object.values(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS);
    const rows = await this.adminSettingsRepository.find({
      where: {
        key: In(keys)
      }
    });
    const byKey = new Map(rows.map(row => [row.key, row]));

    const defaults = this.resolveDefaultsFromEnv();
    const value: SearchOperationalAlertSettings = {
      alertWindowSeconds: this.readNumberSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.alertWindowSeconds),
        defaults.alertWindowSeconds,
        60,
        3600
      ),
      minListingsRequests: this.readNumberSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.minListingsRequests),
        defaults.minListingsRequests,
        1,
        10_000
      ),
      minSuggestionsRequests: this.readNumberSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.minSuggestionsRequests),
        defaults.minSuggestionsRequests,
        1,
        10_000
      ),
      listingsP95Ms: this.readNumberSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.listingsP95Ms),
        defaults.listingsP95Ms,
        10,
        60_000
      ),
      listingsErrorRate: this.readNumberSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.listingsErrorRate),
        defaults.listingsErrorRate,
        0.001,
        1
      ),
      suggestionsP95Ms: this.readNumberSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.suggestionsP95Ms),
        defaults.suggestionsP95Ms,
        10,
        60_000
      ),
      suggestionsErrorRate: this.readNumberSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.suggestionsErrorRate),
        defaults.suggestionsErrorRate,
        0.001,
        1
      ),
      dispatchEnabled: this.readBooleanSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.dispatchEnabled),
        defaults.dispatchEnabled
      ),
      dispatchCooldownSeconds: this.readNumberSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.dispatchCooldownSeconds),
        defaults.dispatchCooldownSeconds,
        0,
        86_400
      ),
      dispatchAutoEnabled: this.readBooleanSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.dispatchAutoEnabled),
        defaults.dispatchAutoEnabled
      ),
      dispatchIntervalSeconds: this.readNumberSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.dispatchIntervalSeconds),
        defaults.dispatchIntervalSeconds,
        30,
        86_400
      ),
      dispatchOnBoot: this.readBooleanSetting(
        byKey.get(SEARCH_OPERATIONAL_ALERT_SETTING_KEYS.dispatchOnBoot),
        defaults.dispatchOnBoot
      )
    };

    this.cache = {
      expiresAt: now + SETTINGS_CACHE_TTL_MS,
      value
    };

    return value;
  }

  invalidateCache() {
    this.cache = null;
  }

  private resolveDefaultsFromEnv(): SearchOperationalAlertSettings {
    return {
      ...DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS,
      alertWindowSeconds: this.readNumberFromEnv(
        'SEARCH_ALERT_WINDOW_SECONDS',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.alertWindowSeconds,
        60,
        3600
      ),
      minListingsRequests: this.readNumberFromEnv(
        'SEARCH_ALERT_MIN_LISTINGS_REQUESTS',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.minListingsRequests,
        1,
        10_000
      ),
      minSuggestionsRequests: this.readNumberFromEnv(
        'SEARCH_ALERT_MIN_SUGGESTIONS_REQUESTS',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.minSuggestionsRequests,
        1,
        10_000
      ),
      listingsP95Ms: this.readNumberFromEnv(
        'SEARCH_ALERT_LISTINGS_P95_MS',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.listingsP95Ms,
        10,
        60_000
      ),
      listingsErrorRate: this.readNumberFromEnv(
        'SEARCH_ALERT_LISTINGS_ERROR_RATE',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.listingsErrorRate,
        0.001,
        1
      ),
      suggestionsP95Ms: this.readNumberFromEnv(
        'SEARCH_ALERT_SUGGESTIONS_P95_MS',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.suggestionsP95Ms,
        10,
        60_000
      ),
      suggestionsErrorRate: this.readNumberFromEnv(
        'SEARCH_ALERT_SUGGESTIONS_ERROR_RATE',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.suggestionsErrorRate,
        0.001,
        1
      ),
      dispatchEnabled: this.readBooleanFromEnv(
        'SEARCH_ALERT_DISPATCH_ENABLED',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.dispatchEnabled
      ),
      dispatchCooldownSeconds: this.readNumberFromEnv(
        'SEARCH_ALERT_DISPATCH_COOLDOWN_SECONDS',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.dispatchCooldownSeconds,
        0,
        86_400
      ),
      dispatchAutoEnabled: this.readBooleanFromEnv(
        'SEARCH_ALERT_DISPATCH_AUTO_ENABLED',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.dispatchAutoEnabled
      ),
      dispatchIntervalSeconds: this.readNumberFromEnv(
        'SEARCH_ALERT_DISPATCH_INTERVAL_SECONDS',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.dispatchIntervalSeconds,
        30,
        86_400
      ),
      dispatchOnBoot: this.readBooleanFromEnv(
        'SEARCH_ALERT_DISPATCH_ON_BOOT',
        DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS.dispatchOnBoot
      )
    };
  }

  private readSettingValue(setting: AdminSetting | null | undefined): unknown {
    if (!setting || setting.value === null || setting.value === undefined) {
      return undefined;
    }
    if (typeof setting.value === 'object' && setting.value && 'value' in setting.value) {
      return (setting.value as Record<string, unknown>).value;
    }
    return setting.value;
  }

  private readBooleanSetting(setting: AdminSetting | null | undefined, fallback: boolean): boolean {
    const raw = this.readSettingValue(setting);
    if (typeof raw === 'boolean') {
      return raw;
    }
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return fallback;
  }

  private readNumberSetting(
    setting: AdminSetting | null | undefined,
    fallback: number,
    min: number,
    max: number
  ): number {
    const raw = this.readSettingValue(setting);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }

  private readBooleanFromEnv(name: string, fallback: boolean): boolean {
    const raw = this.configService.get<string | boolean>(name);
    if (typeof raw === 'boolean') {
      return raw;
    }
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return fallback;
  }

  private readNumberFromEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = this.configService.get<string | number>(name);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }
}
