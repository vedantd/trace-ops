import { NotFoundException } from '@nestjs/common';
import { OrdersService } from '../src/orders.service';
import { ProviderService } from '../src/provider.service';
import { VerificationService } from '../src/verification.service';

describe('VerificationService', () => {
  const findOne = jest.fn();
  const verify = jest.fn();
  const service = new VerificationService(
    { findOne } as unknown as OrdersService,
    { verify } as unknown as ProviderService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findOne.mockResolvedValue({ id: 1 });
    verify.mockResolvedValue(undefined);
  });

  it('calls Postgres-backed order lookup before outbound verification', async () => {
    await expect(service.verifyOrder(1)).resolves.toEqual({ orderId: 1, verified: true });
    expect(findOne).toHaveBeenCalledWith(1);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(findOne.mock.invocationCallOrder[0]).toBeLessThan(verify.mock.invocationCallOrder[0]);
  });

  it('does not call provider when the order does not exist', async () => {
    findOne.mockRejectedValue(new NotFoundException('missing'));
    await expect(service.verifyOrder(123)).rejects.toBeInstanceOf(NotFoundException);
    expect(verify).not.toHaveBeenCalled();
  });
});
