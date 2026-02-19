
import { Test, TestingModule } from '@nestjs/testing';
import { ListingsController } from '../src/listings/listings.controller';
import { ListingsService } from '../src/listings/listings.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { UserRole } from '../src/common/enums/user-role.enum';
import { CreateListingDto } from '../src/listings/dto/create-listing.dto';
import { UpdateListingDto } from '../src/listings/dto/update-listing.dto';
import { FilterListingsDto } from '../src/listings/dto/filter-listings.dto';
import { ListingStatus } from '../src/common/enums/listing-status.enum';
import { MediaService } from '../src/media/media.service';

describe('ListingsController', () => {
  let controller: ListingsController;
  let service: ListingsService;

  const mockListingsService = {
    findAll: jest.fn(),
    getFeatured: jest.fn(),
    getLatest: jest.fn(),
    findMine: jest.fn(),
    findPending: jest.fn(),
    getSimilar: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    incrementViews: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockMediaService = {
    uploadFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [
        {
          provide: ListingsService,
          useValue: mockListingsService,
        },
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ListingsController>(ListingsController);
    service = module.get<ListingsService>(ListingsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call listingsService.findAll with the correct parameters', async () => {
      const filterListingsDto: FilterListingsDto = { page: 1, limit: 10 };
      await controller.findAll(filterListingsDto);
      expect(service.findAll).toHaveBeenCalledWith(filterListingsDto);
    });
  });

  describe('create', () => {
    it('should call listingsService.create with the correct parameters', async () => {
      const createListingDto: CreateListingDto = {
        categoryId: '1',
        subCategoryId: '1',
        adType: 'sell',
        title: 'Test Listing',
        description: 'Test Description',
        price: { amount: 100, currency: 'USD', newItemPrice: null },
        location: { city: 'Test City', address: 'Test Location', lat: 1, lng: 2 },
        contact: { email: 'test@example.com', phone: '000', phoneHidden: false, noSalesmen: false },
        attributes: {},
        meta: {}
      };
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.create(createListingDto, user);
      expect(service.create).toHaveBeenCalledWith(createListingDto, user);
    });
  });

  describe('update', () => {
    it('should call listingsService.update with the correct parameters', async () => {
      const id = '1';
      const updateListingDto: UpdateListingDto = { title: 'Updated Listing' };
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.update(id, updateListingDto, user);
      expect(service.update).toHaveBeenCalledWith(id, updateListingDto, user);
    });
  });

  describe('remove', () => {
    it('should call listingsService.remove with the correct parameters', async () => {
      const id = '1';
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.remove(id, user);
      expect(service.remove).toHaveBeenCalledWith(id, user);
    });
  });

  describe('updateStatus', () => {
    it('should call listingsService.updateStatus with the correct parameters', async () => {
      const id = '1';
      const status = ListingStatus.PUBLISHED;
      const user = { id: '1', email: 'test@example.com', role: UserRole.ADMIN };
      await controller.updateStatus(id, status, user);
      expect(service.updateStatus).toHaveBeenCalledWith(id, status, user);
    });
  });
});
