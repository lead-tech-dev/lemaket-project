import { Injectable } from '@nestjs/common';

type HttpLabelKey = string;

type HttpStat = {
  count: number;
  sum: number;
  buckets: number[];
};
type SearchLabelKey = string;
type SearchEvent = {
  timestampMs: number;
  durationSeconds: number;
  success: boolean;
};
type SearchListingEvent = SearchEvent & {
  hasSearch: boolean;
};
export type SearchOperationalSummary = {
  total: number;
  errors: number;
  errorRate: number;
  successRate: number;
  p95LatencyMs: number;
};
export type SearchOperationalSnapshot = {
  windowSeconds: number;
  listings: {
    withSearch: SearchOperationalSummary;
    all: SearchOperationalSummary;
  };
  suggestions: SearchOperationalSummary;
};

const HISTOGRAM_BUCKETS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5];
const DEFAULT_SEARCH_OPERATIONAL_WINDOW_MS = 5 * 60 * 1000;
const MAX_SEARCH_EVENT_RETENTION_MS = 60 * 60 * 1000;
const MAX_SEARCH_EVENT_BUFFER_SIZE = 25_000;

@Injectable()
export class MonitoringMetricsService {
  private readonly processStartEpoch = Date.now();
  private readonly httpRequests = new Map<HttpLabelKey, number>();
  private readonly httpDurations = new Map<HttpLabelKey, HttpStat>();
  private searchSuggestionsCacheHits = 0;
  private searchSuggestionsCacheMisses = 0;
  private readonly searchSuggestionsDurations = this.createEmptyStat();
  private searchSuggestionsResultsTotal = 0;
  private readonly searchListingsRequests = new Map<SearchLabelKey, number>();
  private readonly searchListingsResults = new Map<SearchLabelKey, number>();
  private readonly searchListingsDurations = new Map<SearchLabelKey, HttpStat>();
  private readonly recentSearchListingEvents: SearchListingEvent[] = [];
  private readonly recentSearchSuggestionEvents: SearchEvent[] = [];

  getContentType() {
    return 'text/plain; version=0.0.4; charset=utf-8';
  }

  observeHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number) {
    const methodLabel = this.normalizeLabel(method, 'UNKNOWN');
    const routeLabel = this.normalizeLabel(route, 'unknown');
    const statusLabel = this.normalizeLabel(String(statusCode || 0), '0');
    const key = this.serializeLabels(methodLabel, routeLabel, statusLabel);

    this.httpRequests.set(key, (this.httpRequests.get(key) || 0) + 1);

    const existing =
      this.httpDurations.get(key) ||
      ({ count: 0, sum: 0, buckets: new Array(HISTOGRAM_BUCKETS.length).fill(0) } as HttpStat);

    existing.count += 1;
    existing.sum += durationSeconds;
    for (let i = 0; i < HISTOGRAM_BUCKETS.length; i += 1) {
      if (durationSeconds <= HISTOGRAM_BUCKETS[i]) {
        existing.buckets[i] += 1;
      }
    }
    this.httpDurations.set(key, existing);
  }

  observeSearchSuggestionsCache(hit: boolean) {
    if (hit) {
      this.searchSuggestionsCacheHits += 1;
      return;
    }
    this.searchSuggestionsCacheMisses += 1;
  }

  observeSearchSuggestionsQuery(
    durationSeconds: number,
    resultCount: number,
    success = true,
    nowMs = Date.now()
  ) {
    this.observeHistogram(this.searchSuggestionsDurations, durationSeconds);
    this.searchSuggestionsResultsTotal += Math.max(0, Math.trunc(resultCount || 0));
    this.recentSearchSuggestionEvents.push({
      timestampMs: nowMs,
      durationSeconds,
      success
    });
    this.pruneSearchEvents(nowMs);
  }

  observeSearchListingsQuery(
    hasSearch: boolean,
    durationSeconds: number,
    resultCount: number,
    success = true,
    nowMs = Date.now()
  ) {
    const key = this.serializeSearchLabels(hasSearch)
    this.searchListingsRequests.set(key, (this.searchListingsRequests.get(key) || 0) + 1);
    this.searchListingsResults.set(
      key,
      (this.searchListingsResults.get(key) || 0) + Math.max(0, Math.trunc(resultCount || 0))
    );
    const stat = this.searchListingsDurations.get(key) || this.createEmptyStat()
    this.observeHistogram(stat, durationSeconds)
    this.searchListingsDurations.set(key, stat)
    this.recentSearchListingEvents.push({
      timestampMs: nowMs,
      durationSeconds,
      success,
      hasSearch
    });
    this.pruneSearchEvents(nowMs);
  }

  getSearchOperationalSnapshot(
    windowMs = DEFAULT_SEARCH_OPERATIONAL_WINDOW_MS,
    nowMs = Date.now()
  ): SearchOperationalSnapshot {
    const resolvedWindowMs = Math.max(60_000, Math.trunc(windowMs));
    this.pruneSearchEvents(nowMs);
    const windowStart = nowMs - resolvedWindowMs;

    const listingAllEvents = this.recentSearchListingEvents.filter(event => event.timestampMs >= windowStart);
    const listingWithSearchEvents = listingAllEvents.filter(event => event.hasSearch);
    const suggestionEvents = this.recentSearchSuggestionEvents.filter(event => event.timestampMs >= windowStart);

    return {
      windowSeconds: Math.round(resolvedWindowMs / 1000),
      listings: {
        withSearch: this.summarizeSearchEvents(listingWithSearchEvents),
        all: this.summarizeSearchEvents(listingAllEvents)
      },
      suggestions: this.summarizeSearchEvents(suggestionEvents)
    };
  }

  renderPrometheusMetrics() {
    const lines: string[] = [];

    this.appendRuntimeMetrics(lines);
    this.appendHttpCounter(lines);
    this.appendHttpHistogram(lines);
    this.appendSearchMetrics(lines);

    return `${lines.join('\n')}\n`;
  }

  private appendRuntimeMetrics(lines: string[]) {
    const now = Date.now();
    const uptimeSeconds = (now - this.processStartEpoch) / 1000;
    const mem = process.memoryUsage();

    lines.push('# HELP sandaga_process_uptime_seconds Process uptime in seconds.');
    lines.push('# TYPE sandaga_process_uptime_seconds gauge');
    lines.push(`sandaga_process_uptime_seconds ${this.formatNumber(uptimeSeconds)}`);

    lines.push('# HELP sandaga_process_resident_memory_bytes Resident memory size in bytes.');
    lines.push('# TYPE sandaga_process_resident_memory_bytes gauge');
    lines.push(`sandaga_process_resident_memory_bytes ${mem.rss}`);

    lines.push('# HELP sandaga_process_heap_used_bytes Heap used in bytes.');
    lines.push('# TYPE sandaga_process_heap_used_bytes gauge');
    lines.push(`sandaga_process_heap_used_bytes ${mem.heapUsed}`);
  }

  private appendHttpCounter(lines: string[]) {
    lines.push('# HELP sandaga_http_requests_total Total number of HTTP requests.');
    lines.push('# TYPE sandaga_http_requests_total counter');
    for (const [key, value] of this.httpRequests.entries()) {
      lines.push(`sandaga_http_requests_total{${this.deserializeLabels(key)}} ${value}`);
    }
  }

  private appendHttpHistogram(lines: string[]) {
    lines.push(
      '# HELP sandaga_http_request_duration_seconds HTTP request duration in seconds.'
    );
    lines.push('# TYPE sandaga_http_request_duration_seconds histogram');

    for (const [key, stat] of this.httpDurations.entries()) {
      const labels = this.deserializeLabels(key);
      for (let i = 0; i < HISTOGRAM_BUCKETS.length; i += 1) {
        lines.push(
          `sandaga_http_request_duration_seconds_bucket{${labels},le="${HISTOGRAM_BUCKETS[i]}"} ${stat.buckets[i]}`
        );
      }
      lines.push(
        `sandaga_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${stat.count}`
      );
      lines.push(`sandaga_http_request_duration_seconds_sum{${labels}} ${this.formatNumber(stat.sum)}`);
      lines.push(`sandaga_http_request_duration_seconds_count{${labels}} ${stat.count}`);
    }
  }

  private appendSearchMetrics(lines: string[]) {
    lines.push('# HELP sandaga_search_suggestions_cache_hits_total Search suggestions cache hits.');
    lines.push('# TYPE sandaga_search_suggestions_cache_hits_total counter');
    lines.push(`sandaga_search_suggestions_cache_hits_total ${this.searchSuggestionsCacheHits}`);

    lines.push('# HELP sandaga_search_suggestions_cache_misses_total Search suggestions cache misses.');
    lines.push('# TYPE sandaga_search_suggestions_cache_misses_total counter');
    lines.push(`sandaga_search_suggestions_cache_misses_total ${this.searchSuggestionsCacheMisses}`);

    lines.push('# HELP sandaga_search_suggestions_results_total Returned suggestions count.');
    lines.push('# TYPE sandaga_search_suggestions_results_total counter');
    lines.push(`sandaga_search_suggestions_results_total ${this.searchSuggestionsResultsTotal}`);

    lines.push('# HELP sandaga_search_suggestions_duration_seconds Search suggestions query duration in seconds.');
    lines.push('# TYPE sandaga_search_suggestions_duration_seconds histogram');
    this.appendHistogramBuckets(
      lines,
      'sandaga_search_suggestions_duration_seconds',
      'source="all"',
      this.searchSuggestionsDurations
    );

    lines.push('# HELP sandaga_search_listings_queries_total Search listings query count.');
    lines.push('# TYPE sandaga_search_listings_queries_total counter');
    for (const [key, value] of this.searchListingsRequests.entries()) {
      lines.push(`sandaga_search_listings_queries_total{${this.deserializeSearchLabels(key)}} ${value}`);
    }

    lines.push('# HELP sandaga_search_listings_results_total Total listings returned by search queries.');
    lines.push('# TYPE sandaga_search_listings_results_total counter');
    for (const [key, value] of this.searchListingsResults.entries()) {
      lines.push(`sandaga_search_listings_results_total{${this.deserializeSearchLabels(key)}} ${value}`);
    }

    lines.push('# HELP sandaga_search_listings_duration_seconds Search listings query duration in seconds.');
    lines.push('# TYPE sandaga_search_listings_duration_seconds histogram');
    for (const [key, stat] of this.searchListingsDurations.entries()) {
      this.appendHistogramBuckets(
        lines,
        'sandaga_search_listings_duration_seconds',
        this.deserializeSearchLabels(key),
        stat
      );
    }
  }

  private normalizeLabel(value: string | undefined, fallback: string) {
    const normalized = value?.trim();
    if (!normalized) {
      return fallback;
    }
    return normalized;
  }

  private serializeLabels(method: string, route: string, statusCode: string) {
    return JSON.stringify({
      method,
      route,
      status_code: statusCode
    });
  }

  private serializeSearchLabels(hasSearch: boolean) {
    return JSON.stringify({
      has_search: hasSearch ? 'true' : 'false'
    });
  }

  private deserializeLabels(serialized: string) {
    const parsed = JSON.parse(serialized) as {
      method: string;
      route: string;
      status_code: string;
    };
    return `method="${this.escapeLabel(parsed.method)}",route="${this.escapeLabel(parsed.route)}",status_code="${this.escapeLabel(parsed.status_code)}"`;
  }

  private deserializeSearchLabels(serialized: string) {
    const parsed = JSON.parse(serialized) as { has_search: string }
    return `has_search="${this.escapeLabel(parsed.has_search)}"`
  }

  private escapeLabel(input: string) {
    return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  private formatNumber(value: number) {
    if (!Number.isFinite(value)) {
      return '0';
    }
    return Number(value.toFixed(6)).toString();
  }

  private createEmptyStat(): HttpStat {
    return {
      count: 0,
      sum: 0,
      buckets: new Array(HISTOGRAM_BUCKETS.length).fill(0)
    }
  }

  private observeHistogram(stat: HttpStat, durationSeconds: number) {
    stat.count += 1;
    stat.sum += durationSeconds;
    for (let i = 0; i < HISTOGRAM_BUCKETS.length; i += 1) {
      if (durationSeconds <= HISTOGRAM_BUCKETS[i]) {
        stat.buckets[i] += 1;
      }
    }
  }

  private appendHistogramBuckets(lines: string[], metricName: string, labels: string, stat: HttpStat) {
    const baseLabels = labels ? `${labels},` : ''
    for (let i = 0; i < HISTOGRAM_BUCKETS.length; i += 1) {
      lines.push(
        `${metricName}_bucket{${baseLabels}le="${HISTOGRAM_BUCKETS[i]}"} ${stat.buckets[i]}`
      );
    }
    lines.push(`${metricName}_bucket{${baseLabels}le="+Inf"} ${stat.count}`);
    lines.push(`${metricName}_sum{${labels}} ${this.formatNumber(stat.sum)}`);
    lines.push(`${metricName}_count{${labels}} ${stat.count}`);
  }

  private summarizeSearchEvents(events: SearchEvent[]): SearchOperationalSummary {
    if (events.length === 0) {
      return {
        total: 0,
        errors: 0,
        errorRate: 0,
        successRate: 1,
        p95LatencyMs: 0
      };
    }

    const errors = events.reduce((count, event) => count + (event.success ? 0 : 1), 0);
    const durationsMs = events
      .map(event => Math.max(0, event.durationSeconds) * 1000)
      .sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(durationsMs.length * 0.95) - 1);
    const p95LatencyMs = durationsMs[p95Index] ?? 0;
    const errorRate = errors / events.length;

    return {
      total: events.length,
      errors,
      errorRate,
      successRate: 1 - errorRate,
      p95LatencyMs: Number(p95LatencyMs.toFixed(2))
    };
  }

  private pruneSearchEvents(nowMs = Date.now()) {
    const minTimestamp = nowMs - MAX_SEARCH_EVENT_RETENTION_MS;
    while (this.recentSearchListingEvents.length > 0) {
      if (this.recentSearchListingEvents[0]!.timestampMs >= minTimestamp) {
        break;
      }
      this.recentSearchListingEvents.shift();
    }
    while (this.recentSearchSuggestionEvents.length > 0) {
      if (this.recentSearchSuggestionEvents[0]!.timestampMs >= minTimestamp) {
        break;
      }
      this.recentSearchSuggestionEvents.shift();
    }

    if (this.recentSearchListingEvents.length > MAX_SEARCH_EVENT_BUFFER_SIZE) {
      this.recentSearchListingEvents.splice(
        0,
        this.recentSearchListingEvents.length - MAX_SEARCH_EVENT_BUFFER_SIZE
      );
    }
    if (this.recentSearchSuggestionEvents.length > MAX_SEARCH_EVENT_BUFFER_SIZE) {
      this.recentSearchSuggestionEvents.splice(
        0,
        this.recentSearchSuggestionEvents.length - MAX_SEARCH_EVENT_BUFFER_SIZE
      );
    }
  }
}
