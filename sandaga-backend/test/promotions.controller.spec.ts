import { Test, TestingModule } from '@nestjs/testing';
import { PromotionsController } from '../src/promotions/promotions.controller';
import { PromotionsService } from '../src/promotions/promotions.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { CreatePromotionDto } from '../src/promotions/dto/create-promotion.dto';
import { UpdatePromotionDto } from '../src/promotions/dto/update-promotion.dto';
import { PromotionStatus } from '../src/common/enums/promotion-status.enum';
import { PromotionType } from '../src/common/enums/promotion-type.enum';
import { AdminService } from '../src/admin/admin.service';
import { UpdatePromotionStatusDto } from '../src/promotions/dto/update-promotion-status.dto';

describe('PromotionsController', () => {
  let controller: PromotionsController;
  let promotionsService: jest.Mocked<PromotionsService>;
  let adminService: jest.Mocked<AdminService>;

  const mockPromotion = {
    id: 'promotion-id',
    name: 'Test Campaign',
    type: PromotionType.BOOST,
    status: PromotionStatus.ACTIVE,
    startDate: new Date(),
    endDate: new Date(),
    budget: '100.00',
    description: null,
    listingId: null,
    listing: null,
    created_at: new Date(),
    updatedAt: new Date()
  };

  const mockUser = {
    id: 'user-id',
    email: 'admin@example.com',
    role: 'admin'
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromotionsController],
      providers: [
        {
          provide: PromotionsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([mockPromotion]),
            findOne: jest.fn().mockResolvedValue(mockPromotion),
            create: jest.fn().mockResolvedValue(mockPromotion),
            update: jest.fn().mockResolvedValue(mockPromotion),
            transitionStatus: jest.fn().mockResolvedValue(mockPromotion),
            remove: jest.fn().mockResolvedValue(undefined)
          }
        },
        {
          provide: AdminService,
          useValue: {
            recordLog: jest.fn().mockResolvedValue(undefined)
          }
        }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PromotionsController);
    promotionsService = module.get(PromotionsService);
    adminService = module.get(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list promotions with serialization', async () => {
    const result = await controller.findAll();
    expect(promotionsService.findAll).toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      id: mockPromotion.id,
      budget: Number(mockPromotion.budget)
    });
  });

  it('should create promotion and log action', async () => {
    const dto: CreatePromotionDto = {
      name: 'Test',
      type: PromotionType.FEATURED,
      status: PromotionStatus.DRAFT,
      budget: 120,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    };

    await controller.create(dto, mockUser);
    expect(promotionsService.create).toHaveBeenCalledWith(dto);
    expect(adminService.recordLog).toHaveBeenCalled();
  });

  it('should update promotion and log action', async () => {
    const dto: UpdatePromotionDto = { description: 'Updated' };
    await controller.update('promotion-id', dto, mockUser);
    expect(promotionsService.update).toHaveBeenCalledWith('promotion-id', dto);
    expect(adminService.recordLog).toHaveBeenCalled();
  });

  it('should transition status and log action', async () => {
    const dto: UpdatePromotionStatusDto = { status: PromotionStatus.ACTIVE };
    await controller.transitionStatus('promotion-id', dto, mockUser);
    expect(promotionsService.transitionStatus).toHaveBeenCalledWith(
      'promotion-id',
      PromotionStatus.ACTIVE
    );
    expect(adminService.recordLog).toHaveBeenCalled();
  });

  it('should remove promotion after logging', async () => {
    await controller.remove('promotion-id', mockUser);
    expect(promotionsService.findOne).toHaveBeenCalledWith('promotion-id');
    expect(promotionsService.remove).toHaveBeenCalledWith('promotion-id');
    expect(adminService.recordLog).toHaveBeenCalled();
  });
});
