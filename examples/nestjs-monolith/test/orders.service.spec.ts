import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../src/database.service';
import { OrdersService } from '../src/orders.service';

describe('OrdersService', () => {
  const originalFaultMode = process.env.FAULT_MODE;
  const originalNodeEnv = process.env.NODE_ENV;
  let query: jest.Mock;
  let service: OrdersService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.FAULT_MODE = 'none';
    query = jest.fn().mockResolvedValue([
      { id: 1, customer_name: 'Demo Customer', total_cents: 2599, status: 'paid' },
    ]);
    service = new OrdersService({ query } as unknown as DatabaseService);
  });

  afterAll(() => {
    if (originalFaultMode === undefined) delete process.env.FAULT_MODE;
    else process.env.FAULT_MODE = originalFaultMode;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns an order normally', async () => {
    await expect(service.findOne(1)).resolves.toEqual({
      id: 1, customerName: 'Demo Customer', totalCents: 2599, status: 'paid',
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM orders'), [1]);
  });

  it('returns 404 for a missing order', async () => {
    query.mockResolvedValue([]);
    await expect(service.findOne(100)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps a database error to service unavailable', async () => {
    query.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.findOne(1)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('injects a slow query', async () => {
    process.env.FAULT_MODE = 'slow_query';
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 1, customer_name: 'Demo Customer', total_cents: 2599, status: 'paid' },
    ]);
    await expect(service.findOne(1)).resolves.toMatchObject({ id: 1 });
    expect(query).toHaveBeenNthCalledWith(1, 'SELECT pg_sleep($1)', [2.5]);
  });

  it('injects an application exception before database access', async () => {
    process.env.FAULT_MODE = 'application_exception';
    await expect(service.findOne(1)).rejects.toThrow('Unexpected order processing failure');
    expect(query).not.toHaveBeenCalled();
  });

  it('disables fault injection in production mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FAULT_MODE = 'application_exception';
    await expect(service.findOne(1)).resolves.toMatchObject({ id: 1 });
  });
});
