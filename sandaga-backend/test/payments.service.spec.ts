
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../src/payments/payments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/payments/payment.entity';
import { PaymentEvent } from '../src/payments/payment-event.entity';
import { PaymentMethodEntity } from '../src/payments/payment-method.entity';
import { Subscription } from '../src/payments/subscription.entity';
import { Listing } from '../src/listings/listing.entity';
import { Promotion } from '../src/promotions/promotion.entity';
import { Delivery } from '../src/deliveries/delivery.entity';
import { WalletTransaction } from '../src/payments/wallet-transaction.entity';
import { Repository } from 'typeorm';
import { UserRole } from '../src/common/enums/user-role.enum';
import { CreatePaymentMethodDto } from '../src/payments/dto/create-payment-method.dto';
import { PaymentMethodType } from '../src/common/enums/payment-method-type.enum';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../src/users/users.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { WalletsService } from '../src/payments/wallets.service';
import { OrdersService } from '../src/orders/orders.service';
import { MessagesService } from '../src/messages/messages.service';
import { ConfigService } from '@nestjs/config';

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

  const mockSimpleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findOneBy: jest.fn(),
  };

  const mockUsersService = {
    listCouriersNearby: jest.fn().mockResolvedValue([]),
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  const mockWalletsService = {
    reserveEscrow: jest.fn(),
    releaseEscrow: jest.fn(),
  };

  const mockOrdersService = {
    findOne: jest.fn(),
    markPaid: jest.fn(),
  };

  const mockMessagesService = {
    sendTimelineEvent: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(undefined),
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
          provide: getRepositoryToken(PaymentEvent),
          useValue: mockSimpleRepository,
        },
        {
          provide: getRepositoryToken(PaymentMethodEntity),
          useValue: mockPaymentMethodRepository,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSimpleRepository,
        },
        {
          provide: getRepositoryToken(Listing),
          useValue: mockSimpleRepository,
        },
        {
          provide: getRepositoryToken(Promotion),
          useValue: mockSimpleRepository,
        },
        {
          provide: getRepositoryToken(Delivery),
          useValue: mockSimpleRepository,
        },
        {
          provide: getRepositoryToken(WalletTransaction),
          useValue: mockSimpleRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: WalletsService,
          useValue: mockWalletsService,
        },
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
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
