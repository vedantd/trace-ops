import {
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from './database.service';
import { emitEvent } from './observability';

interface OrderRow extends QueryResultRow {
  id: number;
  customer_name: string;
  total_cents: number;
  status: string;
}

export interface Order {
  id: number;
  customerName: string;
  totalCents: number;
  status: string;
}

type FaultMode = 'none' | 'slow_query' | 'application_exception' |
  'upstream_timeout' | 'db_pool_exhaustion';

@Injectable()
export class OrdersService {
  constructor(private readonly database: DatabaseService) {}

  async findOne(id: number): Promise<Order> {
    // This testbed never exposes a fault-injection HTTP endpoint.
    const mode = this.faultMode();
    if (mode === 'application_exception') {
      emitEvent('application_exception', { error_code: 'INJECTED_APP_EXCEPTION' });
      throw new Error('Unexpected order processing failure');
    }

    let rows: OrderRow[];
    try {
      if (mode === 'slow_query') {
        await this.database.query('SELECT pg_sleep($1)', [2.5]);
      }
      if (mode === 'db_pool_exhaustion') {
        // With pool max=2, concurrent requests queue and some time out.
        await this.database.query('SELECT pg_sleep($1)', [1.8]);
      }
      rows = await this.database.query<OrderRow>(
        'SELECT id, customer_name, total_cents, status FROM orders WHERE id = $1',
        [id],
      );
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : mode === 'db_pool_exhaustion' ? 'PG_POOL_ACQUIRE_TIMEOUT' : 'PG_UNAVAILABLE';
      emitEvent('database_query_failed', { error_code: code, dependency: 'postgres' });
      throw new ServiceUnavailableException('Order database unavailable or query failed');
    }

    if (rows.length === 0) throw new NotFoundException('Order ' + id + ' not found');

    if (mode === 'upstream_timeout') {
      try {
        // A real HTTP dependency running in a local, disposable container.
        const url = (process.env.MOCK_PROVIDER_URL ?? 'http://mock-provider:3001') +
          '/verify?delay_ms=2000';
        const response = await fetch(url, { signal: AbortSignal.timeout(350) });
        if (!response.ok) throw new Error('upstream_unhealthy');
      } catch {
        emitEvent('upstream_request_failed', {
          error_code: 'UPSTREAM_TIMEOUT',
          dependency: 'mock-provider',
        });
        throw new GatewayTimeoutException('Upstream provider did not respond in time');
      }
    }

    const order = rows[0];
    return {
      id: order.id,
      customerName: order.customer_name,
      totalCents: order.total_cents,
      status: order.status,
    };
  }

  private faultMode(): FaultMode {
    if (process.env.NODE_ENV === 'production') return 'none';
    const value = process.env.FAULT_MODE;
    if (
      value === 'slow_query' || value === 'application_exception' ||
      value === 'upstream_timeout' || value === 'db_pool_exhaustion'
    ) return value;
    return 'none';
  }
}
