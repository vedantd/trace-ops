import { routeTemplate, validatedRequestId } from '../src/observability';

describe('request observability', () => {
  it('normalizes dynamic paths and strips query data', () => {
    expect(routeTemplate('/orders/123?token=never-log-this')).toBe('/orders/:id');
    expect(routeTemplate('/orders/123/verify?token=never-log-this')).toBe('/orders/:id/verify');
    expect(routeTemplate('/unknown/sensitive-identifier')).toBe('/unmatched');
  });

  it('preserves safe request IDs and rejects unsafe ones', () => {
    expect(validatedRequestId('external-req_123')).toBe('external-req_123');
    expect(validatedRequestId('bad header with spaces')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27,}$/,
    );
    expect(validatedRequestId('secret\nvalue')).not.toBe('secret\nvalue');
  });
});
