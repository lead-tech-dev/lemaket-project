import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GeoService } from '../src/geo/geo.service';
import { GeoCity } from '../src/geo/entities/geo-city.entity';
import { GeoNeighborhood } from '../src/geo/entities/geo-neighborhood.entity';

describe('GeoService', () => {
  let service: GeoService;

  const queryBuilderMock = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn()
  };

  const cityRepositoryMock = {
    createQueryBuilder: jest.fn(() => queryBuilderMock),
    findOne: jest.fn()
  };

  const neighborhoodRepositoryMock = {
    createQueryBuilder: jest.fn(() => queryBuilderMock),
    findOne: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoService,
        { provide: getRepositoryToken(GeoCity), useValue: cityRepositoryMock },
        { provide: getRepositoryToken(GeoNeighborhood), useValue: neighborhoodRepositoryMock }
      ]
    }).compile();

    service = module.get<GeoService>(GeoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns empty autocomplete list for short query', async () => {
    const searchCitiesSpy = jest.spyOn(service, 'searchCities');
    const searchNeighborhoodsSpy = jest.spyOn(service, 'searchNeighborhoods');

    const result = await service.autocomplete('a', 8);

    expect(result).toEqual([]);
    expect(searchCitiesSpy).not.toHaveBeenCalled();
    expect(searchNeighborhoodsSpy).not.toHaveBeenCalled();
  });

  it('prioritizes matching neighborhoods in autocomplete', async () => {
    jest.spyOn(service, 'searchNeighborhoods').mockResolvedValue([
      {
        id: 'n-1',
        name: 'Coloc QA',
        slug: 'coloc-qa',
        normalizedName: 'coloc qa',
        cityId: 'c-1',
        city: {
          id: 'c-1',
          name: 'Douala',
          slug: 'douala',
          normalizedName: 'douala',
          region: 'Littoral',
          countryCode: 'CM',
          lat: 4.05,
          lng: 9.76,
          placeType: 'city',
          isActive: true,
          isPopular: true,
          neighborhoods: [],
          created_at: new Date(),
          updatedAt: new Date()
        } as GeoCity,
        lat: 4.05,
        lng: 9.76,
        isActive: true,
        created_at: new Date(),
        updatedAt: new Date()
      } as GeoNeighborhood
    ]);
    jest.spyOn(service, 'searchCities').mockResolvedValue([
      {
        id: 'c-1',
        name: 'Douala',
        slug: 'douala',
        normalizedName: 'douala',
        region: 'Littoral',
        countryCode: 'CM',
        lat: 4.05,
        lng: 9.76,
        placeType: 'city',
        isActive: true,
        isPopular: true,
        neighborhoods: [],
        created_at: new Date(),
        updatedAt: new Date()
      } as GeoCity
    ]);
    jest.spyOn(service as any, 'getPopularCities').mockResolvedValue([]);
    jest.spyOn(service as any, 'searchNeighborhoodsForCities').mockResolvedValue([]);

    const result = await service.autocomplete('coloc', 8);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].kind).toBe('neighborhood');
    expect(result[0].label).toContain('Coloc QA');
    expect(result[0].label).toContain('Douala');
  });
});
