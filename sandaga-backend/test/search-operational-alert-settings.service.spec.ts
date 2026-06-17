import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AdminSetting } from '../src/admin/admin-setting.entity';
import { SearchOperationalAlertSettingsService } from '../src/monitoring/search-operational-alert-settings.service';

describe('SearchOperationalAlertSettingsService', () => {
  const setup = (
    rows: AdminSetting[] = [],
    env: Record<string, string | number | boolean> = {}
  ) => {
    const repository = {
      find: jest.fn().mockResolvedValue(rows)
    } as unknown as Repository<AdminSetting>;
    const configService = {
      get: jest.fn((key: string) => env[key])
    } as unknown as ConfigService;
    const service = new SearchOperationalAlertSettingsService(repository, configService);
    return { service, repository };
  };

  it('uses environment defaults when no admin settings are stored', async () => {
    const { service, repository } = setup([], {
      SEARCH_ALERT_WINDOW_SECONDS: 450,
      SEARCH_ALERT_DISPATCH_ENABLED: 'false'
    });

    const settings = await service.getSettings(true);

    expect(repository.find).toHaveBeenCalledTimes(1);
    expect(settings.alertWindowSeconds).toBe(450);
    expect(settings.dispatchEnabled).toBe(false);
    expect(settings.listingsP95Ms).toBeGreaterThan(0);
  });

  it('prefers stored admin settings values over env defaults', async () => {
    const rows = [
      {
        key: 'monitoring.search.alertWindowSeconds',
        value: { value: 900 }
      },
      {
        key: 'monitoring.search.dispatchEnabled',
        value: { value: true }
      },
      {
        key: 'monitoring.search.dispatchCooldownSeconds',
        value: { value: 120 }
      }
    ] as unknown as AdminSetting[];
    const { service } = setup(rows, {
      SEARCH_ALERT_WINDOW_SECONDS: 450,
      SEARCH_ALERT_DISPATCH_ENABLED: 'false',
      SEARCH_ALERT_DISPATCH_COOLDOWN_SECONDS: 900
    });

    const settings = await service.getSettings(true);

    expect(settings.alertWindowSeconds).toBe(900);
    expect(settings.dispatchEnabled).toBe(true);
    expect(settings.dispatchCooldownSeconds).toBe(120);
  });
});
