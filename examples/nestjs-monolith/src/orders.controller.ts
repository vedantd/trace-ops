import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { Order, OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Order> {
    return this.orders.findOne(id);
  }
}
