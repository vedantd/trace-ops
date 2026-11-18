import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from './database.service';

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

type FaultMode = 'none' | 'slow_query' | 'application_exception';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly database: DatabaseService) {}

  async findOne(id: number): Promise<Order> {
    // Deliberately faultable: never copy fault modes into production services.
    const mode = this.faultMode();
    if (mode === 'application_exception') {
      throw new Error('Unexpected order processing failure');
    }

    try {
      if (mode === 'slow_query') {
        await this.database.query('SELECT pg_sleep($1)', [2.5]);
      }
      const rows = await this.database.query<OrderRow>(
        'SELECT id, customer_name, total_cents, status FROM orders WHERE id = $1',
        [id],
      );
      if (rows.length === 0) {
        throw new NotFoundException('Order ' + id + ' not found');
      }
      const order = rows[0];
      return {
        id: order.id,
        customerName: order.customer_name,
        totalCents: order.total_cents,
        status: order.status,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : 'unknown';
      this.logger.error('order_query_failed error_code=' + code);
      throw new ServiceUnavailableException('Order database unavailable or query failed');
    }
  }

  private faultMode(): FaultMode {
    if (process.env.NODE_ENV === 'production') return 'none';
    const value = process.env.FAULT_MODE;
    if (value === 'slow_query' || value === 'application_exception') return value;
    return 'none';
  }
}
