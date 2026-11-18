import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [HealthController, OrdersController, MetricsController],
  providers: [DatabaseService, OrdersService, MetricsService],
})
export class AppModule {}
