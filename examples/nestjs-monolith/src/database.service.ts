import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL must be configured');
    }
    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 1200,
      query_timeout: 7000,
      max: 5,
    });

    // Unhandled idle-client errors would crash Node when Postgres stops.
    // This is a disposable testbed, so log safe error codes and let
    // readiness + request handlers report the outage.
    this.pool.on('error', (error: Error & { code?: string }) => {
      this.logger.error('postgres_pool_error code=' + (error.code ?? 'unknown'));
    });
  }

  async query<T extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(sql, values);
    return result.rows;
  }

  async ping(): Promise<void> {
    await this.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
