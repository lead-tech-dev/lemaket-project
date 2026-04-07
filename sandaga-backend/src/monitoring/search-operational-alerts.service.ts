import { Injectable } from '@nestjs/common';
import {
  MonitoringMetricsService,
  SearchOperationalSnapshot,
  SearchOperationalSummary
} from './monitoring.metrics.service';
import { SearchOperationalAlertSettingsService } from './search-operational-alert-settings.service';

type SearchAlertSeverity = 'degraded' | 'critical';

type SearchAlert = {
  severity: SearchAlertSeverity;
  component: 'listings' | 'suggestions';
  metric: 'p95LatencyMs' | 'errorRate';
  value: number;
  threshold: number;
  message: string;
};

type SearchOperationalThresholds = {
  windowSeconds: number;
  minListingsRequests: number;
  minSuggestionsRequests: number;
  listingsP95Ms: number;
  listingsErrorRate: number;
  suggestionsP95Ms: number;
  suggestionsErrorRate: number;
};

export type SearchOperationalStatus = {
  status: 'ok' | 'degraded' | 'critical';
  generatedAt: string;
  thresholds: SearchOperationalThresholds;
  snapshot: SearchOperationalSnapshot;
  alerts: SearchAlert[];
  notes: string[];
};

@Injectable()
export class SearchOperationalAlertsService {
  constructor(
    private readonly metricsService: MonitoringMetricsService,
    private readonly settingsService: SearchOperationalAlertSettingsService
  ) {}

  async getStatus(forceRefresh = false): Promise<SearchOperationalStatus> {
    const thresholds = await this.resolveThresholds(forceRefresh);
    const snapshot = this.metricsService.getSearchOperationalSnapshot(
      thresholds.windowSeconds * 1000
    );

    const alerts: SearchAlert[] = [];
    const notes: string[] = [];

    this.evaluateComponent(
      'listings',
      snapshot.listings.withSearch,
      thresholds.minListingsRequests,
      thresholds.listingsP95Ms,
      thresholds.listingsErrorRate,
      alerts,
      notes
    );

    this.evaluateComponent(
      'suggestions',
      snapshot.suggestions,
      thresholds.minSuggestionsRequests,
      thresholds.suggestionsP95Ms,
      thresholds.suggestionsErrorRate,
      alerts,
      notes
    );

    const status: SearchOperationalStatus['status'] = alerts.some(alert => alert.severity === 'critical')
      ? 'critical'
      : alerts.length > 0
        ? 'degraded'
        : 'ok';

    return {
      status,
      generatedAt: new Date().toISOString(),
      thresholds,
      snapshot,
      alerts,
      notes
    };
  }

  private evaluateComponent(
    component: 'listings' | 'suggestions',
    summary: SearchOperationalSummary,
    minRequests: number,
    latencyThresholdMs: number,
    errorRateThreshold: number,
    alerts: SearchAlert[],
    notes: string[]
  ) {
    if (summary.total < minRequests) {
      notes.push(
        `${component}: trafic insuffisant (${summary.total}/${minRequests}) pour déclencher une alerte fiable.`
      );
      return;
    }

    this.pushThresholdAlert(
      component,
      'p95LatencyMs',
      summary.p95LatencyMs,
      latencyThresholdMs,
      alerts,
      `P95 ${component} élevé`
    );

    this.pushThresholdAlert(
      component,
      'errorRate',
      summary.errorRate,
      errorRateThreshold,
      alerts,
      `Taux d'erreur ${component} élevé`
    );
  }

  private pushThresholdAlert(
    component: 'listings' | 'suggestions',
    metric: 'p95LatencyMs' | 'errorRate',
    value: number,
    threshold: number,
    alerts: SearchAlert[],
    title: string
  ) {
    if (value < threshold) {
      return;
    }

    const criticalThreshold = metric === 'errorRate'
      ? Math.min(1, threshold * 2)
      : threshold * 2;
    const severity: SearchAlertSeverity = value >= criticalThreshold ? 'critical' : 'degraded';

    alerts.push({
      severity,
      component,
      metric,
      value: Number(value.toFixed(metric === 'errorRate' ? 4 : 2)),
      threshold,
      message: `${title}: ${value.toFixed(metric === 'errorRate' ? 4 : 2)} (seuil ${threshold})`
    });
  }

  private async resolveThresholds(forceRefresh = false): Promise<SearchOperationalThresholds> {
    const settings = await this.settingsService.getSettings(forceRefresh);
    return {
      windowSeconds: settings.alertWindowSeconds,
      minListingsRequests: settings.minListingsRequests,
      minSuggestionsRequests: settings.minSuggestionsRequests,
      listingsP95Ms: settings.listingsP95Ms,
      listingsErrorRate: settings.listingsErrorRate,
      suggestionsP95Ms: settings.suggestionsP95Ms,
      suggestionsErrorRate: settings.suggestionsErrorRate
    };
  }
}
