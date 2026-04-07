import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SearchOperationalAlertDispatcherService } from '../src/monitoring/search-operational-alert-dispatcher.service';
import { SearchOperationalAlertSettingsService } from '../src/monitoring/search-operational-alert-settings.service';
import { SearchOperationalAlertSchedulerService } from '../src/monitoring/search-operational-alert-scheduler.service';

const dispatchResult = {
  status: 'degraded' as const,
  generatedAt: '2026-04-06T10:00:00.000Z',
  dispatched: true,
  suppressed: false,
  cooldownSeconds: 60,
  fingerprint: 'fp',
  channels: [{ channel: 'webhook' as const, sent: true }],
  message: 'ok'
};

describe('SearchOperationalAlertSchedulerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not schedule when auto dispatch is disabled', async () => {
    const dispatcher = {
      dispatch: jest.fn().mockResolvedValue(dispatchResult)
    } as unknown as SearchOperationalAlertDispatcherService;
    const settings = {
      getSettings: jest.fn().mockResolvedValue({
        dispatchAutoEnabled: false,
        dispatchIntervalSeconds: 60,
        dispatchOnBoot: false
      })
    } as unknown as SearchOperationalAlertSettingsService;
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ locked: true }])
    } as unknown as DataSource;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'SEARCH_ALERT_DISPATCH_LOCK_ENABLED') return false;
        if (key === 'SEARCH_ALERT_DISPATCH_LOCK_KEY') return 972341;
        return undefined;
      })
    } as unknown as ConfigService;

    const service = new SearchOperationalAlertSchedulerService(
      dispatcher,
      settings,
      dataSource,
      configService
    );
    await service.onModuleInit();

    jest.advanceTimersByTime(60_000);
    await Promise.resolve();

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('runs on boot and interval when enabled, then stops on destroy', async () => {
    const dispatcher = {
      dispatch: jest.fn().mockResolvedValue(dispatchResult)
    } as unknown as SearchOperationalAlertDispatcherService;
    const settings = {
      getSettings: jest.fn().mockResolvedValue({
        dispatchAutoEnabled: true,
        dispatchIntervalSeconds: 60,
        dispatchOnBoot: true
      })
    } as unknown as SearchOperationalAlertSettingsService;
    const dataSource = {
      query: jest.fn().mockResolvedValue([])
    } as unknown as DataSource;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'SEARCH_ALERT_DISPATCH_LOCK_ENABLED') return false;
        if (key === 'SEARCH_ALERT_DISPATCH_LOCK_KEY') return 972341;
        return undefined;
      })
    } as unknown as ConfigService;

    const service = new SearchOperationalAlertSchedulerService(
      dispatcher,
      settings,
      dataSource,
      configService
    );
    await service.onModuleInit();

    await Promise.resolve();
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60_000);
    await Promise.resolve();
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);

    service.onModuleDestroy();
    jest.advanceTimersByTime(180_000);
    await Promise.resolve();
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it('skips dispatch when advisory lock is not acquired', async () => {
    const dispatcher = {
      dispatch: jest.fn().mockResolvedValue(dispatchResult)
    } as unknown as SearchOperationalAlertDispatcherService;
    const settings = {
      getSettings: jest.fn().mockResolvedValue({
        dispatchAutoEnabled: true,
        dispatchIntervalSeconds: 60,
        dispatchOnBoot: true
      })
    } as unknown as SearchOperationalAlertSettingsService;
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ locked: false }])
        .mockResolvedValueOnce([{ locked: false }])
    } as unknown as DataSource;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'SEARCH_ALERT_DISPATCH_LOCK_ENABLED') return true;
        if (key === 'SEARCH_ALERT_DISPATCH_LOCK_KEY') return 972341;
        return undefined;
      })
    } as unknown as ConfigService;

    const service = new SearchOperationalAlertSchedulerService(
      dispatcher,
      settings,
      dataSource,
      configService
    );
    await service.onModuleInit();

    await Promise.resolve();
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(60_000);
    await Promise.resolve();
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(0);
  });
});
