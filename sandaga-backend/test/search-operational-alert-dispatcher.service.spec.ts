import { ConfigService } from '@nestjs/config';
import { SearchOperationalAlertDispatcherService } from '../src/monitoring/search-operational-alert-dispatcher.service';
import {
  SearchOperationalAlertsService,
  SearchOperationalStatus
} from '../src/monitoring/search-operational-alerts.service';
import { SearchOperationalAlertSettingsService } from '../src/monitoring/search-operational-alert-settings.service';

const buildStatus = (overrides?: Partial<SearchOperationalStatus>): SearchOperationalStatus => ({
  status: 'ok',
  generatedAt: '2026-04-06T10:00:00.000Z',
  thresholds: {
    windowSeconds: 300,
    minListingsRequests: 20,
    minSuggestionsRequests: 20,
    listingsP95Ms: 1200,
    listingsErrorRate: 0.05,
    suggestionsP95Ms: 400,
    suggestionsErrorRate: 0.05
  },
  snapshot: {
    windowSeconds: 300,
    listings: {
      withSearch: { total: 0, errors: 0, errorRate: 0, successRate: 1, p95LatencyMs: 0 },
      all: { total: 0, errors: 0, errorRate: 0, successRate: 1, p95LatencyMs: 0 }
    },
    suggestions: { total: 0, errors: 0, errorRate: 0, successRate: 1, p95LatencyMs: 0 }
  },
  alerts: [],
  notes: [],
  ...overrides
});

describe('SearchOperationalAlertDispatcherService', () => {
  const setup = (status: SearchOperationalStatus, configValues: Record<string, string | number> = {}) => {
    const alertsService = {
      getStatus: jest.fn().mockResolvedValue(status)
    } as unknown as SearchOperationalAlertsService;
    const settingsService = {
      getSettings: jest.fn().mockResolvedValue({
        alertWindowSeconds: 300,
        minListingsRequests: 20,
        minSuggestionsRequests: 20,
        listingsP95Ms: 1200,
        listingsErrorRate: 0.05,
        suggestionsP95Ms: 400,
        suggestionsErrorRate: 0.05,
        dispatchEnabled: true,
        dispatchCooldownSeconds: 900,
        dispatchAutoEnabled: true,
        dispatchIntervalSeconds: 300,
        dispatchOnBoot: false
      })
    } as unknown as SearchOperationalAlertSettingsService;
    const configService = {
      get: jest.fn((key: string) => configValues[key])
    } as unknown as ConfigService;
    const service = new SearchOperationalAlertDispatcherService(
      alertsService,
      settingsService,
      configService
    );
    return { service, alertsService, settingsService, configService };
  };

  it('does not dispatch when status is ok', async () => {
    const { service, alertsService } = setup(buildStatus());
    const result = await service.dispatch();

    expect(alertsService.getStatus).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ok');
    expect(result.dispatched).toBe(false);
    expect(result.channels).toHaveLength(0);
  });

  it('dispatches configured channels when degraded', async () => {
    const degradedStatus = buildStatus({
      status: 'degraded',
      alerts: [
        {
          severity: 'degraded',
          component: 'listings',
          metric: 'p95LatencyMs',
          value: 1600,
          threshold: 1200,
          message: 'P95 listings élevé'
        }
      ]
    });
    const { service } = setup(degradedStatus, {
      SEARCH_ALERT_WEBHOOK_URL: 'https://example.com/hooks/search',
      SEARCH_ALERT_EMAIL_TO: 'ops@example.com'
    });

    jest.spyOn(service as never, 'sendWebhook' as never).mockResolvedValue(true as never);
    jest.spyOn(service as never, 'sendEmail' as never).mockResolvedValue(true as never);

    const result = await service.dispatch();

    expect(result.dispatched).toBe(true);
    expect(result.suppressed).toBe(false);
    expect(result.channels).toEqual([
      { channel: 'webhook', sent: true, reason: undefined },
      { channel: 'email', sent: true, reason: undefined }
    ]);
  });

  it('suppresses duplicate alert dispatch in cooldown window', async () => {
    const criticalStatus = buildStatus({
      status: 'critical',
      alerts: [
        {
          severity: 'critical',
          component: 'suggestions',
          metric: 'errorRate',
          value: 0.2,
          threshold: 0.05,
          message: "Taux d'erreur suggestions élevé"
        }
      ]
    });
    const { service, settingsService } = setup(criticalStatus, {
      SEARCH_ALERT_WEBHOOK_URL: 'https://example.com/hooks/search',
    });
    (settingsService.getSettings as jest.Mock).mockResolvedValue({
      alertWindowSeconds: 300,
      minListingsRequests: 20,
      minSuggestionsRequests: 20,
      listingsP95Ms: 1200,
      listingsErrorRate: 0.05,
      suggestionsP95Ms: 400,
      suggestionsErrorRate: 0.05,
      dispatchEnabled: true,
      dispatchCooldownSeconds: 900,
      dispatchAutoEnabled: true,
      dispatchIntervalSeconds: 300,
      dispatchOnBoot: false
    });

    jest.spyOn(service as never, 'sendWebhook' as never).mockResolvedValue(true as never);

    const first = await service.dispatch();
    const second = await service.dispatch();

    expect(first.dispatched).toBe(true);
    expect(second.dispatched).toBe(false);
    expect(second.suppressed).toBe(true);
  });
});
