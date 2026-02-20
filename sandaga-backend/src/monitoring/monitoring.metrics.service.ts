import { Injectable } from '@nestjs/common';

type HttpLabelKey = string;

type HttpStat = {
  count: number;
  sum: number;
  buckets: number[];
};

const HISTOGRAM_BUCKETS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5];

@Injectable()
export class MonitoringMetricsService {
  private readonly processStartEpoch = Date.now();
  private readonly httpRequests = new Map<HttpLabelKey, number>();
  private readonly httpDurations = new Map<HttpLabelKey, HttpStat>();

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

  renderPrometheusMetrics() {
    const lines: string[] = [];

    this.appendRuntimeMetrics(lines);
    this.appendHttpCounter(lines);
    this.appendHttpHistogram(lines);

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

  private deserializeLabels(serialized: string) {
    const parsed = JSON.parse(serialized) as {
      method: string;
      route: string;
      status_code: string;
    };
    return `method="${this.escapeLabel(parsed.method)}",route="${this.escapeLabel(parsed.route)}",status_code="${this.escapeLabel(parsed.status_code)}"`;
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
}
