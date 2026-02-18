
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from '../src/payments/payments.controller';
import { PaymentsService } from '../src/payments/payments.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { UserRole } from '../src/common/enums/user-role.enum';
import { CreatePaymentMethodDto } from '../src/payments/dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from '../src/payments/dto/update-payment-method.dto';
import { CreatePaymentDto } from '../src/payments/dto/create-payment.dto';
import { PaymentMethodType } from '../src/common/enums/payment-method-type.enum';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: PaymentsService;

  const mockPaymentsService = {
    getMethods: jest.fn(),
    addMethod: jest.fn(),
    updateMethod: jest.fn(),
    removeMethod: jest.fn(),
    getPayments: jest.fn(),
    createPayment: jest.fn(),
    finalizeCheckoutSession: jest.fn(),
    requestProPlan: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMethods', () => {
    it('should call paymentsService.getMethods with the correct user', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.getMethods(user);
      expect(service.getMethods).toHaveBeenCalledWith(user);
    });
  });

  describe('addMethod', () => {
    it('should call paymentsService.addMethod with the correct parameters', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      const dto: CreatePaymentMethodDto = {
        type: PaymentMethodType.CARD,
        isDefault: true,
      };
      await controller.addMethod(user, dto);
      expect(service.addMethod).toHaveBeenCalledWith(user, dto);
    });
  });

  describe('createPayment', () => {
    it('should call paymentsService.createPayment with the correct parameters', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      const dto: CreatePaymentDto = {
        listingId: 'listing-1',
        optionId: 'boost-7',
        paymentMethodId: 'method-1',
      };
      await controller.createPayment(user, dto);
      expect(service.createPayment).toHaveBeenCalledWith(user, dto);
    });
  });
});
