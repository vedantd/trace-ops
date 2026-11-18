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
  private readonly dependencyAttempts = new Map<string, RequestMeasurements>();
  private dependencyRetries = 0;

  observeDependencyAttempt(success: boolean, durationMs: number): void {
    const outcome = success ? 'success' : 'failure';
    let item = this.dependencyAttempts.get(outcome);
    if (!item) {
      item = { count: 0, seconds: 0, cumulativeBuckets: BOUNDS.map(() => 0) };
      this.dependencyAttempts.set(outcome, item);
    }
    item.count++;
    const seconds = durationMs / 1000;
    item.seconds += seconds;
    for (let i = 0; i < BOUNDS.length; i++) {
      if (seconds <= BOUNDS[i]) item.cumulativeBuckets[i]++;
    }
  }

  observeDependencyRetry(): void {
    this.dependencyRetries++;
  }

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
      '# HELP traceops_dependency_attempts_total Outbound provider attempts by result.',
      '# TYPE traceops_dependency_attempts_total counter',
    );
    for (const outcome of ['success', 'failure']) {
      const item = this.dependencyAttempts.get(outcome);
      lines.push(
        'traceops_dependency_attempts_total{dependency="mock-provider",outcome="' +
          outcome + '"} ' + (item?.count ?? 0),
      );
    }
    lines.push(
      '# HELP traceops_dependency_duration_seconds Outbound provider attempt duration.',
      '# TYPE traceops_dependency_duration_seconds histogram',
    );
    for (const outcome of ['success', 'failure']) {
      const item = this.dependencyAttempts.get(outcome);
      const labels = 'dependency="mock-provider",outcome="' + outcome + '"';
      BOUNDS.forEach((bound, index) => {
        lines.push(
          'traceops_dependency_duration_seconds_bucket{' + labels + ',le="' + bound + '"} ' +
            (item?.cumulativeBuckets[index] ?? 0),
        );
      });
      lines.push(
        'traceops_dependency_duration_seconds_bucket{' + labels + ',le="+Inf"} ' + (item?.count ?? 0),
        'traceops_dependency_duration_seconds_sum{' + labels + '} ' + (item?.seconds ?? 0).toFixed(6),
        'traceops_dependency_duration_seconds_count{' + labels + '} ' + (item?.count ?? 0),
      );
    }
    lines.push(
      '# HELP traceops_dependency_retries_total Outbound provider attempts retried.',
      '# TYPE traceops_dependency_retries_total counter',
      'traceops_dependency_retries_total{dependency="mock-provider"} ' + this.dependencyRetries,
    );
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
