import { MetricsService } from '../src/metrics.service';

describe('MetricsService', () => {
  it('records cumulative latency buckets and bounded label dimensions', () => {
    const metrics = new MetricsService();
    metrics.observe('/orders/:id', 503, 2800);
    metrics.observe('/orders/:id', 200, 100);
    const text = metrics.render({ total: 2, idle: 1, waiting: 0, limit: 5 });
    expect(text).toContain('traceops_http_requests_total{route="/orders/:id",status_class="5xx"} 1');
    expect(text).toContain('traceops_http_request_duration_seconds_bucket{route="/orders/:id",status_class="5xx",le="2"} 0');
    expect(text).toContain('traceops_http_request_duration_seconds_bucket{route="/orders/:id",status_class="5xx",le="3"} 1');
    expect(text).toContain('traceops_db_pool_connections{state="waiting"} 0');
    metrics.observeDependencyAttempt(false, 180);
    metrics.observeDependencyAttempt(true, 20);
    metrics.observeDependencyRetry();
    const withDependencies = metrics.render({ total: 2, idle: 1, waiting: 0, limit: 5 });
    expect(withDependencies).toContain('traceops_dependency_attempts_total{dependency="mock-provider",outcome="failure"} 1');
    expect(withDependencies).toContain('traceops_dependency_retries_total{dependency="mock-provider"} 1');
    expect(withDependencies).toContain('traceops_dependency_duration_seconds_bucket{dependency="mock-provider",outcome="failure",le="0.5"} 1');
    expect(text).not.toContain('customer');
  });
});
