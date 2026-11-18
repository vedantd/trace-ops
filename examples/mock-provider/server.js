'use strict';

const { createServer } = require('node:http');

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
  const delayMs = Math.min(3000, Math.max(0, Number(requestUrl.searchParams.get('delay_ms')) || 0));
  setTimeout(() => {
    if (!res.writableEnded) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ verified: true }));
    }
  }, delayMs);
});

server.listen(3001, '0.0.0.0');
