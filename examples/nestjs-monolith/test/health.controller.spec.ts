import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../src/health.controller';
import { DatabaseService } from '../src/database.service';

describe('HealthController', () => {
  it('returns liveness without querying PostgreSQL', () => {
    const ping = jest.fn();
    const controller = new HealthController({ ping } as unknown as DatabaseService);
    expect(controller.live()).toEqual({ status: 'alive' });
    expect(ping).not.toHaveBeenCalled();
  });

  it('returns readiness when PostgreSQL responds', async () => {
    const controller = new HealthController({
      ping: jest.fn().mockResolvedValue(undefined),
    } as unknown as DatabaseService);
    await expect(controller.ready()).resolves.toEqual({ status: 'ready' });
  });

  it('fails readiness when PostgreSQL is unavailable', async () => {
    const controller = new HealthController({
      ping: jest.fn().mockRejectedValue(new Error('down')),
    } as unknown as DatabaseService);
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
