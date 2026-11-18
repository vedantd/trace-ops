import { Controller, Get, Header } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly database: DatabaseService,
  ) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  expose(): string {
    return this.metrics.render(this.database.poolStats());
  }
}
