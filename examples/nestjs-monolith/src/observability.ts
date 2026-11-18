import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { MetricsService } from './metrics.service';

interface RequestScope {
  requestId: string;
}

const requestScope = new AsyncLocalStorage<RequestScope>();
const safeId = /^[A-Za-z0-9._-]{1,64}$/;

export function validatedRequestId(value: string | string[] | undefined): string {
  if (typeof value === 'string' && safeId.test(value)) return value;
  return randomUUID();
}

export function currentRequestId(): string | null {
  return requestScope.getStore()?.requestId ?? null;
}

export function routeTemplate(rawUrl: string | undefined): string {
  const path = (rawUrl ?? '/').split('?')[0];
  if (/^\/orders\/\d+\/verify$/.test(path)) return '/orders/:id/verify';
  if (/^\/orders\/\d+$/.test(path)) return '/orders/:id';
  if (path === '/health/live' || path === '/health/ready' || path === '/metrics') return path;
  return '/unmatched'; // Do not log arbitrary paths, query strings or identifiers.
}

type SafeField = string | number | boolean | null;
export function emitEvent(event: string, fields: Record<string, SafeField> = {}): void {
  process.stdout.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'orders-api',
      event,
      request_id: requestScope.getStore()?.requestId ?? null,
      ...fields,
    }) + '\n',
  );
}

export function installRequestObservability(
  app: INestApplication,
  metrics: MetricsService,
): void {
  app.use((req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const requestId = validatedRequestId(req.headers['x-request-id']);
    res.setHeader('x-request-id', requestId);
    const started = process.hrtime.bigint();
    const route = routeTemplate(req.url);
    res.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      if (route !== '/metrics') metrics.observe(route, res.statusCode, durationMs);
      emitEvent('request_completed', {
        request_id: requestId,
        method: req.method ?? 'UNKNOWN',
        route,
        http_status: res.statusCode,
        duration_ms: Number(durationMs.toFixed(2)),
        error_code: res.statusCode >= 500 ? 'HTTP_' + res.statusCode : null,
      });
    });
    requestScope.run({ requestId }, next);
  });
}
