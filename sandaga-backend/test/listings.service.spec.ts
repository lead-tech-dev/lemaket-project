
import { Test, TestingModule } from '@nestjs/testing';
import { ListingsService } from '../src/listings/listings.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Listing } from '../src/listings/listing.entity';
import { ListingImage } from '../src/listings/listing-image.entity';
import { Category } from '../src/categories/category.entity';
import { CategoriesService } from '../src/categories/categories.service';
import { UsersService } from '../src/users/users.service';
import { Repository } from 'typeorm';
import { CreateListingDto } from '../src/listings/dto/create-listing.dto';
import { User } from '../src/users/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FormStep } from '../src/forms/entities/form-step.entity';
import { SearchLogsService } from '../src/search-logs/search-logs.service';
import { SearchRelevanceSettingsService } from '../src/search-logs/search-relevance-settings.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { GeoService } from '../src/geo/geo.service';
import { PromotionsService } from '../src/promotions/promotions.service';
import { MonitoringMetricsService } from '../src/monitoring/monitoring.metrics.service';

describe('ListingsService', () => {
  let service: ListingsService;
  let repository: Repository<Listing>;
  const treeRepositoryMock = {
    findDescendants: jest.fn(),
  };
  const queryBuilderMock = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const mockListingRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    increment: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    manager: {
      getTreeRepository: jest.fn(() => treeRepositoryMock),
    },
    createQueryBuilder: jest.fn(() => queryBuilderMock),
  };

  const categoryQueryBuilderMock = {
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const mockCategoryRepository = {
    createQueryBuilder: jest.fn(() => categoryQueryBuilderMock),
    find: jest.fn(),
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
    recordSearch: jest.fn(),
    getSearchSynonymsMap: jest.fn(),
  };
  const mockSearchRelevanceSettingsService = {
    getSettings: jest.fn(),
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  const mockGeoService = {
    resolveSelection: jest.fn(),
  };

  const mockPromotionsService = {
    runAutomationsIfDue: jest.fn(),
  };
  const mockMonitoringMetricsService = {
    observeSearchListingsQuery: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilderMock.getManyAndCount.mockResolvedValue([[], 0]);
    categoryQueryBuilderMock.getOne.mockResolvedValue(null);
    treeRepositoryMock.findDescendants.mockResolvedValue([]);
    mockCategoryRepository.find.mockResolvedValue([]);
    mockGeoService.resolveSelection.mockResolvedValue({
      cityId: null,
      neighborhoodId: null,
    });
    mockSearchLogsService.getSearchSynonymsMap.mockResolvedValue({});
    mockSearchRelevanceSettingsService.getSettings.mockResolvedValue({
      enableBusinessBoost: true,
      enableDynamicSynonyms: true,
      popularCityBoost: 28,
      proSellerBoost: 8,
      categoryPriorityWeights: {
        immobilier: 26,
      },
      categoryWeightsText: 'immobilier:26'
    });
    mockPromotionsService.runAutomationsIfDue.mockResolvedValue(undefined);
    mockMonitoringMetricsService.observeSearchListingsQuery.mockReset();

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
          provide: getRepositoryToken(Category),
          useValue: mockCategoryRepository,
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
          provide: SearchRelevanceSettingsService,
          useValue: mockSearchRelevanceSettingsService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: GeoService,
          useValue: mockGeoService,
        },
        {
          provide: PromotionsService,
          useValue: mockPromotionsService,
        },
        {
          provide: MonitoringMetricsService,
          useValue: mockMonitoringMetricsService,
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
      mockGeoService.resolveSelection.mockResolvedValue({
        cityId: 'city-1',
        neighborhoodId: null,
      });

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
      expect(mockGeoService.resolveSelection).toHaveBeenCalledWith(undefined, undefined);
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

  describe('findAll', () => {
    it('includes descendants when filtering by parent category slug', async () => {
      categoryQueryBuilderMock.getOne.mockResolvedValue({
        id: 'cat-parent',
        slug: 'vehicles',
      } as Category);
      treeRepositoryMock.findDescendants.mockResolvedValue([
        { id: 'cat-parent' } as Category,
        { id: 'cat-child-1' } as Category,
        { id: 'cat-child-2' } as Category,
      ]);

      await service.findAll({ categorySlug: 'vehicles' } as any);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'category.id IN (:...categoryScopeIds)',
        { categoryScopeIds: ['cat-parent', 'cat-child-1', 'cat-child-2'] }
      );
    });

    it('falls back to parent relation when descendants tree is incomplete', async () => {
      categoryQueryBuilderMock.getOne.mockResolvedValue({
        id: 'cat-parent',
        slug: 'vehicules',
      } as Category);
      treeRepositoryMock.findDescendants.mockResolvedValue([
        { id: 'cat-parent' } as Category,
      ]);
      mockCategoryRepository.find.mockResolvedValue([
        { id: 'cat-parent', parent: null } as unknown as Category,
        { id: 'cat-child-a', parent: { id: 'cat-parent' } } as unknown as Category,
        { id: 'cat-child-b', parent: { id: 'cat-parent' } } as unknown as Category,
      ]);

      await service.findAll({ categorySlug: 'vehicules' } as any);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'category.id IN (:...categoryScopeIds)',
        { categoryScopeIds: ['cat-parent', 'cat-child-a', 'cat-child-b'] }
      );
    });

    it('filters city against city/address/label', async () => {
      await service.findAll({ city: 'Douala' } as any);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        expect.stringContaining(`COALESCE(listing.location->>'address', '') ILIKE :city`),
        { city: '%Douala%' }
      );
    });

    it('normalizes search query before recording search logs', async () => {
      await service.findAll({ search: '   ndog   passi   ', page: 1 } as any);

      expect(mockSearchLogsService.recordSearch).toHaveBeenCalledWith('ndog passi', 0);
      expect(mockMonitoringMetricsService.observeSearchListingsQuery).toHaveBeenCalledWith(
        true,
        expect.any(Number),
        0
      );
    });

    it('uses search ranking order when a search term is provided', async () => {
      await service.findAll({ search: 'voiture', page: 1 } as any);

      expect(mockSearchLogsService.getSearchSynonymsMap).toHaveBeenCalled();
      expect(mockSearchRelevanceSettingsService.getSettings).toHaveBeenCalled();
      expect(queryBuilderMock.leftJoin).toHaveBeenCalledWith(
        'geo_cities',
        'geoCity',
        'geoCity.id = listing.city_id'
      );
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith('search_rank', 'DESC');
      expect(queryBuilderMock.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('CASE WHEN LOWER(lemaket_unaccent(COALESCE(listing.title, \'\'))) = :searchNormalizedExact'),
        'search_rank'
      );
      expect(queryBuilderMock.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('searchPopularCityBoost'),
        'search_rank'
      );
      expect(queryBuilderMock.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('searchProSellerBoost'),
        'search_rank'
      );
      expect(queryBuilderMock.setParameters).toHaveBeenCalledWith(
        expect.objectContaining({
          searchPopularCityBoost: expect.any(Number),
          searchProSellerBoost: expect.any(Number)
        })
      );
    });

    it('caps page size to 100', async () => {
      await service.findAll({ limit: 250 } as any);

      expect(queryBuilderMock.take).toHaveBeenCalledWith(100);
    });

    it('throws when minPrice is greater than maxPrice', async () => {
      await expect(
        service.findAll({ minPrice: 1000, maxPrice: 100 } as any)
      ).rejects.toThrow('minPrice must be less than or equal to maxPrice.');
    });

    it('throws when only lat is provided', async () => {
      await expect(
        service.findAll({ lat: 4.05 } as any)
      ).rejects.toThrow('lat and lng must be provided together.');
    });

    it('throws when radiusKm is provided without coordinates', async () => {
      await expect(
        service.findAll({ radiusKm: 25 } as any)
      ).rejects.toThrow('lat and lng are required when radiusKm is provided.');
    });

    it('keeps city matches without coordinates when radius filter is enabled', async () => {
      await service.findAll({ city: 'Douala', lat: 4.0511, lng: 9.7679, radiusKm: 25 } as any);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        expect.stringContaining(`OR (listing.location->>'lat') IS NULL`),
        expect.objectContaining({
          lat: 4.0511,
          lng: 9.7679,
          radiusKm: 25
        })
      );
    });

    it('adds deterministic id sort key for stable pagination', async () => {
      await service.findAll({ sort: 'recent' as any } as any);

      expect(queryBuilderMock.addOrderBy).toHaveBeenCalledWith('listing.id', 'DESC');
    });

    it('keeps only meaningful search tokens for filtering', () => {
      const tokens = (service as any).tokenizeSearchTerms('de la coloc a douala');
      expect(tokens).toEqual(['coloc', 'douala']);
    });

    it('falls back to the full query when only stop words are provided', () => {
      const tokens = (service as any).tokenizeSearchTerms('de la et');
      expect(tokens).toEqual(['de la et']);
    });

    it('supports advanced query parsing with include/exclude phrases and tokens', () => {
      const parsed = (service as any).parseSearchQuery('"studio meuble" coloc -maison -"sans balcon"');
      expect(parsed.includePhrases).toEqual(['studio meuble']);
      expect(parsed.includeTerms).toEqual(['coloc']);
      expect(parsed.excludeTerms).toEqual(['maison']);
      expect(parsed.excludePhrases).toEqual(['sans balcon']);
    });

    it('adds exclusion clauses when query contains negative tokens', async () => {
      await service.findAll({ search: 'coloc -maison', page: 1 } as any);
      const clauses = queryBuilderMock.andWhere.mock.calls.map(call => String(call[0]));
      expect(clauses.some(clause => clause.includes('NOT ('))).toBe(true);
    });

    it('merges runtime synonyms with static token expansion', () => {
      const expanded = (service as any).expandSearchToken('telephone', {
        telephone: ['gsm'],
      });

      expect(expanded).toEqual(expect.arrayContaining(['telephone', 'téléphone', 'smartphone', 'gsm']));
    });
  });

  describe('listPublishedByOwner', () => {
    it('includes descendants when storefront filters by parent category slug', async () => {
      categoryQueryBuilderMock.getOne.mockResolvedValue({
        id: 'cat-parent',
        slug: 'services',
      } as Category);
      treeRepositoryMock.findDescendants.mockResolvedValue([
        { id: 'cat-parent' } as Category,
        { id: 'cat-child-a' } as Category,
      ]);

      await service.listPublishedByOwner('owner-1', {
        categorySlug: 'services',
        page: 1,
        limit: 12,
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'category.id IN (:...categoryScopeIds)',
        { categoryScopeIds: ['cat-parent', 'cat-child-a'] }
      );
    });
  });
});
