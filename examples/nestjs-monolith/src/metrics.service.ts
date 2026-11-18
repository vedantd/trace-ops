import { Injectable } from '@nestjs/common';

export interface PoolStats {
  total: number;
  idle: number;
  waiting: number;
  limit: number;
}

interface RequestMeasurements {
  count: number;
  seconds: number;
  cumulativeBuckets: number[];
}

const BOUNDS = [0.025, 0.1, 0.5, 1, 2, 3, 5, 10];

@Injectable()
export class MetricsService {
  private readonly requests = new Map<string, RequestMeasurements>();

  observe(route: string, status: number, durationMs: number): void {
    // Both label values are from controlled sets, preventing cardinality explosion.
    const statusClass = status >= 500 ? '5xx' : status >= 400 ? '4xx' : '2xx';
    const key = route + '|' + statusClass;
    let item = this.requests.get(key);
    if (!item) {
      item = { count: 0, seconds: 0, cumulativeBuckets: BOUNDS.map(() => 0) };
      this.requests.set(key, item);
    }
    item.count++;
    const durationSeconds = durationMs / 1000;
    item.seconds += durationSeconds;
    for (let i = 0; i < BOUNDS.length; i++) {
      if (durationSeconds <= BOUNDS[i]) item.cumulativeBuckets[i]++;
    }
  }

  render(pool: PoolStats): string {
    const lines: string[] = [
      '# HELP traceops_http_requests_total Observed HTTP requests by route and status class.',
      '# TYPE traceops_http_requests_total counter',
    ];
    const entries = [...this.requests.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [key, item] of entries) {
      const [route, statusClass] = key.split('|');
      lines.push(
        `traceops_http_requests_total{route="${route}",status_class="${statusClass}"} ${item.count}`,
      );
    }
    lines.push(
      '# HELP traceops_http_request_duration_seconds HTTP request duration.',
      '# TYPE traceops_http_request_duration_seconds histogram',
    );
    for (const [key, item] of entries) {
      const [route, statusClass] = key.split('|');
      const labels = `route="${route}",status_class="${statusClass}"`;
      BOUNDS.forEach((bound, index) => {
        lines.push(
          `traceops_http_request_duration_seconds_bucket{${labels},le="${bound}"} ${item.cumulativeBuckets[index]}`,
        );
      });
      lines.push(
        `traceops_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${item.count}`,
        `traceops_http_request_duration_seconds_sum{${labels}} ${item.seconds.toFixed(6)}`,
        `traceops_http_request_duration_seconds_count{${labels}} ${item.count}`,
      );
    }
    lines.push(
      '# HELP traceops_db_pool_connections PostgreSQL pool connection counts.',
      '# TYPE traceops_db_pool_connections gauge',
    );
    for (const [state, value] of Object.entries(pool)) {
      lines.push(`traceops_db_pool_connections{state="${state}"} ${value}`);
    }
    return lines.join('\n') + '\n';
  }
}
