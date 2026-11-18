import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { VerificationResult, VerificationService } from './verification.service';

@Controller('orders')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get(':id/verify')
  verify(@Param('id', ParseIntPipe) id: number): Promise<VerificationResult> {
    return this.verification.verifyOrder(id);
  }
}
