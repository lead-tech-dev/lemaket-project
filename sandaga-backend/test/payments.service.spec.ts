
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../src/payments/payments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/payments/payment.entity';
import { PaymentMethodEntity } from '../src/payments/payment-method.entity';
import { Repository } from 'typeorm';
import { UserRole } from '../src/common/enums/user-role.enum';
import { CreatePaymentMethodDto } from '../src/payments/dto/create-payment-method.dto';
import { PaymentMethodType } from '../src/common/enums/payment-method-type.enum';
import { NotFoundException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: Repository<Payment>;
  let paymentMethodRepository: Repository<PaymentMethodEntity>;

  const mockPaymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockPaymentMethodRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(PaymentMethodEntity),
          useValue: mockPaymentMethodRepository,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    paymentMethodRepository = module.get<Repository<PaymentMethodEntity>>(
      getRepositoryToken(PaymentMethodEntity),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addMethod', () => {
    it('should add a new payment method', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      const dto: CreatePaymentMethodDto = {
        type: PaymentMethodType.CARD,
        isDefault: true,
      };
      const paymentMethod = new PaymentMethodEntity();

      mockPaymentMethodRepository.create.mockReturnValue(paymentMethod);
      mockPaymentMethodRepository.save.mockResolvedValue(paymentMethod);

      const result = await service.addMethod(user, dto);

      expect(result).toEqual(paymentMethod);
    });
  });

  describe('removeMethod', () => {
    it('should remove a payment method', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      const paymentMethod = new PaymentMethodEntity();
      jest.spyOn(service as any, 'findMethod').mockResolvedValue(paymentMethod);

      await service.removeMethod('1', user);

      expect(mockPaymentMethodRepository.remove).toHaveBeenCalledWith(paymentMethod);
    });

    it('should throw a NotFoundException if payment method is not found', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      jest.spyOn(service as any, 'findMethod').mockRejectedValue(new NotFoundException());

      await expect(service.removeMethod('1', user)).rejects.toThrow(
        new NotFoundException(),
      );
    });
  });
});
