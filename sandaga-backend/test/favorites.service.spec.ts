
import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesService } from '../src/favorites/favorites.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Favorite } from '../src/favorites/favorite.entity';
import { Repository } from 'typeorm';
import { ListingsService } from '../src/listings/listings.service';
import { UserRole } from '../src/common/enums/user-role.enum';
import { ConflictException } from '@nestjs/common';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let repository: Repository<Favorite>;
  let listingsService: ListingsService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  const mockListingsService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        {
          provide: getRepositoryToken(Favorite),
          useValue: mockRepository,
        },
        {
          provide: ListingsService,
          useValue: mockListingsService,
        },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
    repository = module.get<Repository<Favorite>>(getRepositoryToken(Favorite));
    listingsService = module.get<ListingsService>(ListingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('add', () => {
    it('should add a listing to favorites', async () => {
      const listingId = '1';
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      const favorite = new Favorite();

      mockListingsService.findOne.mockResolvedValue({});
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(favorite);
      mockRepository.save.mockResolvedValue(favorite);

      const result = await service.add(listingId, user);

      expect(result).toEqual(favorite);
      expect(mockListingsService.findOne).toHaveBeenCalledWith(listingId);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { listingId, userId: user.id } });
      expect(mockRepository.create).toHaveBeenCalledWith({ listingId, userId: user.id });
      expect(mockRepository.save).toHaveBeenCalledWith(favorite);
    });

    it('should throw a ConflictException if listing is already in favorites', async () => {
      const listingId = '1';
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };

      mockListingsService.findOne.mockResolvedValue({});
      mockRepository.findOne.mockResolvedValue(new Favorite());

      await expect(service.add(listingId, user)).rejects.toThrow(
        new ConflictException('Listing is already in favorites.'),
      );
    });
  });

  describe('remove', () => {
    it('should remove a listing from favorites', async () => {
      const listingId = '1';
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };

      await service.remove(listingId, user);

      expect(mockRepository.delete).toHaveBeenCalledWith({ listingId, userId: user.id });
    });
  });
});
