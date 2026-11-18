import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { HealthController } from './health.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [HealthController, OrdersController],
  providers: [DatabaseService, OrdersService],
})
export class AppModule {}
