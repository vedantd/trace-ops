'use strict';

const { createServer } = require('node:http');
const { performance } = require('node:perf_hooks');

const safeId = /^[A-Za-z0-9._-]{1,64}$/;

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  if (requestUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (requestUrl.pathname !== '/verify') {
    res.writeHead(404);
    res.end();
    return;
  }

  const mode = requestUrl.searchParams.get('mode');
  const attempt = requestUrl.searchParams.get('attempt') === '2' ? 2 : 1;
  const transient = mode === 'first_attempt_503' && attempt === 1;
  const down = mode === 'always_503';
  const status = transient || down ? 503 : 200;
  const requestedDelay = Math.min(
    3000,
    Math.max(0, Number(requestUrl.searchParams.get('delay_ms')) || 0),
  );
  const delayMs = transient ? 180 : requestedDelay;
  const headerId = req.headers['x-request-id'];
  const requestId = typeof headerId === 'string' && safeId.test(headerId) ? headerId : null;
  const started = performance.now();

  setTimeout(() => {
    if (res.writableEnded || res.destroyed) return;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ verified: status === 200 }));
    process.stdout.write(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'mock-provider',
      event: 'provider_request_completed',
      request_id: requestId,
      operation: 'verify',
      attempt,
      http_status: status,
      duration_ms: Number((performance.now() - started).toFixed(2)),
    }) + '\n');
  }, delayMs);
});

server.listen(3001, '0.0.0.0');
