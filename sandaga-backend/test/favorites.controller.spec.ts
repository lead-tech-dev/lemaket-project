
import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesController } from '../src/favorites/favorites.controller';
import { FavoritesService } from '../src/favorites/favorites.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { UserRole } from '../src/common/enums/user-role.enum';

describe('FavoritesController', () => {
  let controller: FavoritesController;
  let service: FavoritesService;

  const mockFavoritesService = {
    getForUser: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        {
          provide: FavoritesService,
          useValue: mockFavoritesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FavoritesController>(FavoritesController);
    service = module.get<FavoritesService>(FavoritesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findMine', () => {
    it('should call favoritesService.getForUser with the correct user', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.findMine(user);
      expect(service.getForUser).toHaveBeenCalledWith(user);
    });
  });

  describe('addFavorite', () => {
    it('should call favoritesService.add with the correct parameters', async () => {
      const listingId = '1';
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.addFavorite(listingId, user);
      expect(service.add).toHaveBeenCalledWith(listingId, user);
    });
  });

  describe('removeFavorite', () => {
    it('should call favoritesService.remove with the correct parameters', async () => {
      const listingId = '1';
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.removeFavorite(listingId, user);
      expect(service.remove).toHaveBeenCalledWith(listingId, user);
    });
  });
});
