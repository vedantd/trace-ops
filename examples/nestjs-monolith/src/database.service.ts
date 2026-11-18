import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { emitEvent } from './observability';
import { PoolStats } from './metrics.service';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly poolLimit: number;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL must be configured');

    const exhausted = process.env.NODE_ENV !== 'production' &&
      process.env.FAULT_MODE === 'db_pool_exhaustion';
    this.poolLimit = exhausted ? 2 : 5;
    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: exhausted ? 400 : 1200,
      query_timeout: 7000,
      max: this.poolLimit,
    });

    this.pool.on('error', (error: Error & { code?: string }) => {
      emitEvent('postgres_pool_error', { error_code: error.code ?? 'PG_CONNECTION_LOST' });
    });
  }

  async query<T extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(sql, values);
    return result.rows;
  }

  poolStats(): PoolStats {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      limit: this.poolLimit,
    };
  }

  async ping(): Promise<void> {
    await this.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
