import { BadGatewayException } from '@nestjs/common';
import { MetricsService } from '../src/metrics.service';
import { ProviderService, providerMode } from '../src/provider.service';

describe('ProviderService', () => {
  const originalMode = process.env.FAULT_MODE;
  const originalEnvironment = process.env.NODE_ENV;
  let metrics: MetricsService;
  let service: ProviderService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.FAULT_MODE = 'none';
    metrics = new MetricsService();
    service = new ProviderService(metrics);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalMode === undefined) delete process.env.FAULT_MODE;
    else process.env.FAULT_MODE = originalMode;
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  });

  it('performs a single HTTP provider call when healthy', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    await expect(service.verify()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('mode=healthy');
    expect(metrics.render({ total: 0, idle: 0, waiting: 0, limit: 5 }))
      .toContain('traceops_dependency_retries_total{dependency="mock-provider"} 0');
  });

  it('recovers from one transient 503 with a bounded retry', async () => {
    process.env.FAULT_MODE = 'provider_flaky';
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    await expect(service.verify()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('attempt=2');
    const text = metrics.render({ total: 0, idle: 0, waiting: 0, limit: 5 });
    expect(text).toContain('traceops_dependency_attempts_total{dependency="mock-provider",outcome="failure"} 1');
    expect(text).toContain('traceops_dependency_attempts_total{dependency="mock-provider",outcome="success"} 1');
    expect(text).toContain('traceops_dependency_retries_total{dependency="mock-provider"} 1');
  });

  it('returns 502 after two provider failures without an unbounded loop', async () => {
    process.env.FAULT_MODE = 'provider_outage';
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(service.verify()).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never enables injected faults in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.FAULT_MODE = 'provider_outage';
    expect(providerMode()).toBe('healthy');
  });
});
