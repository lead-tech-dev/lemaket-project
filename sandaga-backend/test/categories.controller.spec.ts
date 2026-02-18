
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from '../src/categories/categories.controller';
import { CategoriesService } from '../src/categories/categories.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { CreateCategoryDto } from '../src/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../src/categories/dto/update-category.dto';
import { AdminService } from '../src/admin/admin.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;
  let adminService: AdminService;

  const mockCategoriesService = {
    findActive: jest.fn(),
    findAll: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: '1', name: 'Cat' }),
    update: jest.fn().mockResolvedValue({ id: '1', name: 'Cat' }),
    remove: jest.fn(),
  };

  const mockAdminService = {
    recordLog: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);
    adminService = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call categoriesService.findActive when active is true', async () => {
      await controller.findAll('true');
      expect(service.findActive).toHaveBeenCalled();
    });

    it('should call categoriesService.findAll when active is not true', async () => {
      await controller.findAll('false');
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('should call categoriesService.findBySlug with the correct slug', async () => {
      const slug = 'test-slug';
      await controller.findBySlug(slug);
      expect(service.findBySlug).toHaveBeenCalledWith(slug);
    });
  });

  describe('create', () => {
    it('should call categoriesService.create with the correct parameters', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'Test Category',
        slug: 'test-category',
      };
      const actor = { id: 'actor', email: 'admin@example.com', role: 'admin' };
      await controller.create(createCategoryDto, actor);
      expect(service.create).toHaveBeenCalledWith(createCategoryDto);
      expect(adminService.recordLog).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should call categoriesService.update with the correct parameters', async () => {
      const id = '1';
      const updateCategoryDto: UpdateCategoryDto = { name: 'Updated Category' };
      const actor = { id: 'actor', email: 'admin@example.com', role: 'admin' };
      await controller.update(id, updateCategoryDto, actor);
      expect(service.update).toHaveBeenCalledWith(id, updateCategoryDto);
      expect(adminService.recordLog).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should call categoriesService.remove with the correct id', async () => {
      const id = '1';
      const actor = { id: 'actor', email: 'admin@example.com', role: 'admin' };
      await controller.remove(id, actor);
      expect(service.remove).toHaveBeenCalledWith(id);
      expect(adminService.recordLog).toHaveBeenCalled();
    });
  });
});
