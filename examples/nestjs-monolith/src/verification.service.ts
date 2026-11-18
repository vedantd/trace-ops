import { Injectable } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ProviderService } from './provider.service';

export interface VerificationResult {
  orderId: number;
  verified: boolean;
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly orders: OrdersService,
    private readonly provider: ProviderService,
  ) {}

  async verifyOrder(id: number): Promise<VerificationResult> {
    // Deliberately cross both dependency boundaries: PostgreSQL then HTTP provider.
    await this.orders.findOne(id);
    await this.provider.verify();
    return { orderId: id, verified: true };
  }
}
