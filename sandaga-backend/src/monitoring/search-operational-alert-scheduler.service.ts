import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SearchOperationalAlertDispatcherService } from './search-operational-alert-dispatcher.service';
import { SearchOperationalAlertSettingsService } from './search-operational-alert-settings.service';

@Injectable()
export class SearchOperationalAlertSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SearchOperationalAlertSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private lockEnabled = true;
  private lockKey = 972_341;

  constructor(
    private readonly dispatcher: SearchOperationalAlertDispatcherService,
    private readonly settingsService: SearchOperationalAlertSettingsService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService
  ) {}

  async onModuleInit() {
    this.lockEnabled = this.readBoolean('SEARCH_ALERT_DISPATCH_LOCK_ENABLED', true);
    this.lockKey = this.readNumber('SEARCH_ALERT_DISPATCH_LOCK_KEY', 972_341, 1, 2_147_483_647);

    const settings = await this.settingsService.getSettings();
    const autoEnabled = settings.dispatchAutoEnabled;
    if (!autoEnabled) {
      this.logger.log('Search alert scheduler disabled (SEARCH_ALERT_DISPATCH_AUTO_ENABLED=false).');
      return;
    }

    const intervalSeconds = settings.dispatchIntervalSeconds;

    this.timer = setInterval(() => {
      void this.dispatchSafely();
    }, intervalSeconds * 1000);
    const timerRef = this.timer as unknown as { unref?: () => void };
    if (typeof timerRef.unref === 'function') {
      timerRef.unref();
    }

    const dispatchOnBoot = settings.dispatchOnBoot;
    if (dispatchOnBoot) {
      void this.dispatchSafely();
    }

    this.logger.log(`Search alert scheduler started (interval=${intervalSeconds}s).`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async dispatchSafely() {
    let lockAcquired = false;
    try {
      lockAcquired = await this.tryAcquireLock();
      if (!lockAcquired) {
        return;
      }

      const result = await this.dispatcher.dispatch(false);
      if (result.dispatched) {
        this.logger.warn(
          `Search alert dispatched (status=${result.status}, channels=${result.channels.length}).`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Search alert scheduled dispatch failed: ${message}`);
    } finally {
      if (lockAcquired) {
        await this.releaseLock();
      }
    }
  }

  private async tryAcquireLock(): Promise<boolean> {
    if (!this.lockEnabled) {
      return true;
    }
    try {
      const rows = await this.dataSource.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [this.lockKey]
      );
      const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      return Boolean(first?.locked);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Search alert scheduler lock failed, continuing without lock: ${message}`);
      this.lockEnabled = false;
      return true;
    }
  }

  private async releaseLock() {
    if (!this.lockEnabled) {
      return;
    }
    try {
      await this.dataSource.query(
        'SELECT pg_advisory_unlock($1)',
        [this.lockKey]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Search alert scheduler unlock failed: ${message}`);
    }
  }

  private readBoolean(name: string, fallback: boolean): boolean {
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

  private readNumber(name: string, fallback: number, min: number, max: number): number {
    const raw = this.configService.get<string | number>(name);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
  }
}
