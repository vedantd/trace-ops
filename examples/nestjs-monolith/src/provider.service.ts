import { BadGatewayException, Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { MetricsService } from './metrics.service';
import { currentRequestId, emitEvent } from './observability';

type ProviderMode = 'healthy' | 'first_attempt_503' | 'always_503';

// Faults are selected at process startup, never by a public API request.
export function providerMode(): ProviderMode {
  if (process.env.NODE_ENV === 'production') return 'healthy';
  if (process.env.FAULT_MODE === 'provider_flaky') return 'first_attempt_503';
  if (process.env.FAULT_MODE === 'provider_outage') return 'always_503';
  return 'healthy';
}

@Injectable()
export class ProviderService {
  constructor(private readonly metrics: MetricsService) {}

  async verify(): Promise<void> {
    const base = process.env.MOCK_PROVIDER_URL ?? 'http://mock-provider:3001';
    const mode = providerMode();
    const requestId = currentRequestId();

    for (let attempt = 1; attempt <= 2; attempt++) {
      const url = new URL('/verify', base);
      url.searchParams.set('mode', mode);
      url.searchParams.set('attempt', String(attempt));
      const started = performance.now();
      let errorCode = 'UPSTREAM_REQUEST_ERROR';

      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(350),
          headers: requestId ? { 'x-request-id': requestId } : {},
        });
        const durationMs = Number((performance.now() - started).toFixed(2));
        this.metrics.observeDependencyAttempt(response.ok, durationMs);
        emitEvent('dependency_request_completed', {
          dependency: 'mock-provider',
          operation: 'verify',
          attempt,
          http_status: response.status,
          duration_ms: durationMs,
          error_code: response.ok ? null : 'UPSTREAM_HTTP_' + response.status,
        });
        if (response.ok) return;
        errorCode = 'UPSTREAM_HTTP_' + response.status;
      } catch {
        const durationMs = Number((performance.now() - started).toFixed(2));
        this.metrics.observeDependencyAttempt(false, durationMs);
        emitEvent('dependency_request_completed', {
          dependency: 'mock-provider',
          operation: 'verify',
          attempt,
          http_status: null,
          duration_ms: durationMs,
          error_code: 'UPSTREAM_REQUEST_ERROR',
        });
      }

      // Retry transient provider failures once, with a fixed and bounded backoff.
      if (attempt === 2 || (errorCode !== 'UPSTREAM_HTTP_503' && errorCode !== 'UPSTREAM_REQUEST_ERROR')) {
        break;
      }
      this.metrics.observeDependencyRetry();
      emitEvent('upstream_retry_scheduled', {
        dependency: 'mock-provider',
        operation: 'verify',
        attempt,
        error_code: errorCode,
        backoff_ms: 100,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    emitEvent('upstream_request_failed', {
      dependency: 'mock-provider',
      operation: 'verify',
      error_code: 'UPSTREAM_VERIFICATION_FAILED',
    });
    throw new BadGatewayException('Verification provider unavailable');
  }
}
