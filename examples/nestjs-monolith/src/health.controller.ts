import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('live')
  live(): { status: string } {
    return { status: 'alive' };
  }

  @Get('ready')
  async ready(): Promise<{ status: string }> {
    try {
      await this.database.ping();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Database dependency not ready');
    }
  }
}
