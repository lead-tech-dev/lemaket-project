
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../src/categories/categories.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Category } from '../src/categories/category.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateCategoryDto } from '../src/categories/dto/create-category.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repository: Repository<Category>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    repository = module.get<Repository<Category>>(getRepositoryToken(Category));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'Test Category',
        slug: 'test-category',
      };
      const category = new Category();
      mockRepository.create.mockReturnValue(category);
      mockRepository.save.mockResolvedValue(category);

      const result = await service.create(createCategoryDto);

      expect(result).toEqual(category);
      expect(mockRepository.create).toHaveBeenCalledWith(createCategoryDto);
      expect(mockRepository.save).toHaveBeenCalledWith(category);
    });

    it('should throw a ConflictException if category name or slug is already in use', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'Test Category',
        slug: 'test-category',
      };
      const queryFailedError = new QueryFailedError('duplicate key', [], new Error());
      (queryFailedError as any).driverError = { code: '23505' };
      mockRepository.save.mockRejectedValue(queryFailedError);

      await expect(service.create(createCategoryDto)).rejects.toThrow(
        new ConflictException('Category name or slug is already in use.'),
      );
    });
  });

  describe('findOne', () => {
    it('should return a category if found', async () => {
      const category = new Category();
      mockRepository.findOne.mockResolvedValue(category);

      const result = await service.findOne('1');

      expect(result).toEqual(category);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['parent', 'children'],
      });
    });

    it('should throw a NotFoundException if category is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(
        new NotFoundException('Category not found.'),
      );
    });
  });
});
