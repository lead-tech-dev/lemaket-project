
import { Test, TestingModule } from '@nestjs/testing';
import { ListingsService } from '../src/listings/listings.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Listing } from '../src/listings/listing.entity';
import { ListingImage } from '../src/listings/listing-image.entity';
import { CategoriesService } from '../src/categories/categories.service';
import { UsersService } from '../src/users/users.service';
import { Repository } from 'typeorm';
import { CreateListingDto } from '../src/listings/dto/create-listing.dto';
import { User } from '../src/users/user.entity';
import { Category } from '../src/categories/category.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FormStep } from '../src/forms/entities/form-step.entity';
import { SearchLogsService } from '../src/search-logs/search-logs.service';
import { NotificationsService } from '../src/notifications/notifications.service';

describe('ListingsService', () => {
  let service: ListingsService;
  let repository: Repository<Listing>;

  const mockListingRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    increment: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    })),
  };

  const mockListingImageRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  const mockFormStepRepository = {
    find: jest.fn(),
  };

  const mockCategoriesService = {
    findOne: jest.fn(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
  };

  const mockSearchLogsService = {
    record: jest.fn(),
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: getRepositoryToken(Listing),
          useValue: mockListingRepository,
        },
        {
          provide: getRepositoryToken(ListingImage),
          useValue: mockListingImageRepository,
        },
        {
          provide: getRepositoryToken(FormStep),
          useValue: mockFormStepRepository,
        },
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: SearchLogsService,
          useValue: mockSearchLogsService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
    repository = module.get<Repository<Listing>>(getRepositoryToken(Listing));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new listing', async () => {
      const createListingDto: CreateListingDto = {
        categoryId: '1',
        subCategoryId: '1',
        adType: 'sell',
        title: 'Test Listing',
        description: 'Test Description',
        price: { amount: 100, currency: 'USD', newItemPrice: null },
        location: { city: 'Test City', address: 'Test Location', lat: 3.86, lng: 11.52 },
        contact: { email: 'user@test.com', phone: '000', phoneHidden: false, noSalesmen: false },
        attributes: {},
        meta: {}
      };
      const user = new User();
      user.id = '1';
      user.firstName = 'Test';
      user.lastName = 'User';
      const category = new Category();
      category.id = '1';
      category.name = 'Test Category';
      category.slug = 'test-category';
      const listing = new Listing();
      listing.id = 'listing-1';
      listing.title = createListingDto.title;
      listing.description = createListingDto.description;
      listing.price = 100;
      listing.currency = 'USD';
      listing.category = category;
      listing.owner = user;
      listing.images = [];
      listing.formData = {};

      mockUsersService.findOne.mockResolvedValue(user);
      mockCategoriesService.findOne.mockResolvedValue(category);
      mockListingRepository.create.mockReturnValue(listing);
      mockListingRepository.save.mockResolvedValue(listing);
      mockListingImageRepository.save.mockResolvedValue([]);

      const result = await service.create(createListingDto, { id: '1', email: 'test@example.com', role: UserRole.USER });

      expect(result).toEqual(
        expect.objectContaining({
          id: 'listing-1',
          title: 'Test Listing',
        }),
      );
      expect(result).toHaveProperty('category.id', '1');
      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
      expect(mockCategoriesService.findOne).toHaveBeenCalledWith('1');
      expect(mockListingRepository.create).toHaveBeenCalledWith(expect.any(Object));
      expect(mockListingRepository.save).toHaveBeenCalledWith(listing);
    });
  });

  describe('findOne', () => {
    it('should return a listing if found', async () => {
      const listing = new Listing();
      mockListingRepository.findOne.mockResolvedValue(listing);

      const result = await service.findOne('1');

      expect(result).toEqual(listing);
      expect(mockListingRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' }, relations: { images: true, category: true, owner: true, promotions: true } });
    });

    it('should throw a NotFoundException if listing is not found', async () => {
      mockListingRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(
        new NotFoundException('Listing not found.'),
      );
    });
  });
});
