import { MonitoringMetricsService } from '../src/monitoring/monitoring.metrics.service';

describe('MonitoringMetricsService', () => {
  it('should expose prometheus metrics with request counters and histogram buckets', () => {
    const service = new MonitoringMetricsService();

    service.observeHttpRequest('GET', '/health', 200, 0.123);
    service.observeHttpRequest('GET', '/health', 500, 0.456);
    service.observeSearchSuggestionsCache(false);
    service.observeSearchSuggestionsCache(true);
    service.observeSearchSuggestionsQuery(0.08, 6);
    service.observeSearchListingsQuery(true, 0.22, 18);
    service.observeSearchListingsQuery(false, 0.05, 20);

    const rendered = service.renderPrometheusMetrics();

    expect(rendered).toContain('sandaga_http_requests_total');
    expect(rendered).toContain('route="/health"');
    expect(rendered).toContain('status_code="200"');
    expect(rendered).toContain('status_code="500"');
    expect(rendered).toContain('sandaga_http_request_duration_seconds_bucket');
    expect(rendered).toContain('sandaga_http_request_duration_seconds_count');
    expect(rendered).toContain('sandaga_search_suggestions_cache_hits_total 1');
    expect(rendered).toContain('sandaga_search_suggestions_cache_misses_total 1');
    expect(rendered).toContain('sandaga_search_suggestions_results_total 6');
    expect(rendered).toContain('sandaga_search_listings_queries_total{has_search="true"} 1');
    expect(rendered).toContain('sandaga_search_listings_results_total{has_search="false"} 20');
    expect(rendered).toContain('sandaga_search_listings_duration_seconds_bucket');
  });
});
