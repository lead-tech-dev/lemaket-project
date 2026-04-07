import { MonitoringMetricsService, SearchOperationalSnapshot } from '../src/monitoring/monitoring.metrics.service';
import { SearchOperationalAlertsService } from '../src/monitoring/search-operational-alerts.service';
import { SearchOperationalAlertSettingsService } from '../src/monitoring/search-operational-alert-settings.service';

const buildSummary = (overrides?: Partial<SearchOperationalSnapshot['suggestions']>) => ({
  total: 0,
  errors: 0,
  errorRate: 0,
  successRate: 1,
  p95LatencyMs: 0,
  ...overrides
});

const buildSnapshot = (overrides?: Partial<SearchOperationalSnapshot>): SearchOperationalSnapshot => ({
  windowSeconds: 300,
  listings: {
    withSearch: buildSummary(),
    all: buildSummary()
  },
  suggestions: buildSummary(),
  ...overrides
});

describe('SearchOperationalAlertsService', () => {
  const setup = (
    snapshot: SearchOperationalSnapshot,
    settingsOverrides: Partial<{
      alertWindowSeconds: number;
      minListingsRequests: number;
      minSuggestionsRequests: number;
      listingsP95Ms: number;
      listingsErrorRate: number;
      suggestionsP95Ms: number;
      suggestionsErrorRate: number;
    }> = {}
  ) => {
    const metricsService = {
      getSearchOperationalSnapshot: jest.fn().mockReturnValue(snapshot)
    } as unknown as MonitoringMetricsService;
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
        dispatchOnBoot: false,
        ...settingsOverrides
      })
    } as unknown as SearchOperationalAlertSettingsService;

    const service = new SearchOperationalAlertsService(metricsService, settingsService);
    return { service, metricsService, settingsService };
  };

  it('keeps status ok when traffic is below alert minimum thresholds', async () => {
    const snapshot = buildSnapshot({
      listings: {
        withSearch: buildSummary({ total: 3, errors: 1, errorRate: 0.3333, successRate: 0.6667, p95LatencyMs: 1800 }),
        all: buildSummary({ total: 4, errors: 1, errorRate: 0.25, successRate: 0.75, p95LatencyMs: 1200 })
      },
      suggestions: buildSummary({ total: 2, errors: 1, errorRate: 0.5, successRate: 0.5, p95LatencyMs: 900 })
    });
    const { service, metricsService } = setup(snapshot);

    const status = await service.getStatus();

    expect(metricsService.getSearchOperationalSnapshot).toHaveBeenCalledWith(300_000);
    expect(status.status).toBe('ok');
    expect(status.alerts).toHaveLength(0);
    expect(status.notes.some(note => note.includes('listings'))).toBe(true);
    expect(status.notes.some(note => note.includes('suggestions'))).toBe(true);
  });

  it('returns degraded when thresholds are crossed but not critical', async () => {
    const snapshot = buildSnapshot({
      listings: {
        withSearch: buildSummary({ total: 40, errors: 1, errorRate: 0.025, successRate: 0.975, p95LatencyMs: 1600 }),
        all: buildSummary({ total: 60, errors: 2, errorRate: 0.0333, successRate: 0.9667, p95LatencyMs: 1300 })
      },
      suggestions: buildSummary({ total: 55, errors: 1, errorRate: 0.0182, successRate: 0.9818, p95LatencyMs: 280 })
    });
    const { service } = setup(snapshot);

    const status = await service.getStatus();

    expect(status.status).toBe('degraded');
    expect(
      status.alerts.some(
        alert =>
          alert.component === 'listings' &&
          alert.metric === 'p95LatencyMs' &&
          alert.severity === 'degraded'
      )
    ).toBe(true);
  });

  it('returns critical when error rate exceeds critical threshold', async () => {
    const snapshot = buildSnapshot({
      listings: {
        withSearch: buildSummary({ total: 120, errors: 2, errorRate: 0.0167, successRate: 0.9833, p95LatencyMs: 500 }),
        all: buildSummary({ total: 140, errors: 2, errorRate: 0.0143, successRate: 0.9857, p95LatencyMs: 480 })
      },
      suggestions: buildSummary({ total: 100, errors: 20, errorRate: 0.2, successRate: 0.8, p95LatencyMs: 300 })
    });
    const { service } = setup(snapshot, {
      suggestionsErrorRate: 0.05
    });

    const status = await service.getStatus();

    expect(status.status).toBe('critical');
    expect(
      status.alerts.some(
        alert =>
          alert.component === 'suggestions' &&
          alert.metric === 'errorRate' &&
          alert.severity === 'critical'
      )
    ).toBe(true);
  });
});
