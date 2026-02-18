
import { Test, TestingModule } from '@nestjs/testing';
import { PromotionsService } from '../src/promotions/promotions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Promotion } from '../src/promotions/promotion.entity';
import { Repository } from 'typeorm';
import { CreatePromotionDto } from '../src/promotions/dto/create-promotion.dto';
import { PromotionType } from '../src/common/enums/promotion-type.enum';
import { PromotionStatus } from '../src/common/enums/promotion-status.enum';
import { NotFoundException } from '@nestjs/common';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let repository: Repository<Promotion>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        {
          provide: getRepositoryToken(Promotion),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
    repository = module.get<Repository<Promotion>>(getRepositoryToken(Promotion));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new promotion', async () => {
      const createPromotionDto: CreatePromotionDto = {
        name: 'Test Promotion',
        listingId: '1',
        type: PromotionType.BOOST,
        status: PromotionStatus.ACTIVE,
        budget: 100,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      };
      const promotion = new Promotion();
      mockRepository.create.mockReturnValue(promotion);
      mockRepository.save.mockResolvedValue(promotion);

      const result = await service.create(createPromotionDto);

      expect(result).toEqual(promotion);
      expect(mockRepository.create).toHaveBeenCalledWith(expect.any(Object));
      expect(mockRepository.save).toHaveBeenCalledWith(promotion);
    });
  });

  describe('findOne', () => {
    it('should return a promotion if found', async () => {
      const promotion = new Promotion();
      mockRepository.findOne.mockResolvedValue(promotion);

      const result = await service.findOne('1');

      expect(result).toEqual(promotion);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' }, relations: { listing: true } });
    });

    it('should throw a NotFoundException if promotion is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(
        new NotFoundException('Promotion not found.'),
      );
    });
  });
});
