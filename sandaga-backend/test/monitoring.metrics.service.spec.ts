import { MonitoringMetricsService } from '../src/monitoring/monitoring.metrics.service';

describe('MonitoringMetricsService', () => {
  it('should expose prometheus metrics with request counters and histogram buckets', () => {
    const service = new MonitoringMetricsService();

    service.observeHttpRequest('GET', '/health', 200, 0.123);
    service.observeHttpRequest('GET', '/health', 500, 0.456);

    const rendered = service.renderPrometheusMetrics();

    expect(rendered).toContain('sandaga_http_requests_total');
    expect(rendered).toContain('route="/health"');
    expect(rendered).toContain('status_code="200"');
    expect(rendered).toContain('status_code="500"');
    expect(rendered).toContain('sandaga_http_request_duration_seconds_bucket');
    expect(rendered).toContain('sandaga_http_request_duration_seconds_count');
  });
});
