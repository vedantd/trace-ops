import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ProviderService } from './provider.service';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  controllers: [HealthController, OrdersController, VerificationController, MetricsController],
  providers: [DatabaseService, OrdersService, ProviderService, VerificationService, MetricsService],
})
export class AppModule {}
