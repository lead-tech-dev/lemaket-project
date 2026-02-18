import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.categoryRepository.create(createCategoryDto);

    if (createCategoryDto.parentId) {
      const parent = await this.findOne(createCategoryDto.parentId);
      category.parent = parent;
    }

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        typeof error.driverError?.code === 'string' &&
        error.driverError.code === '23505'
      ) {
        throw new ConflictException(
          'Category name or slug is already in use.'
        );
      }

      throw error;
    }
  }

  findAll(): Promise<Category[]> {
    return this.categoryRepository.find({
      order: { position: 'ASC', name: 'ASC' },
      relations: ['parent', 'children']
    });
  }

  findActive(): Promise<Category[]> {
    return this.categoryRepository.find({
      where: { isActive: true },
      order: { position: 'ASC', name: 'ASC' },
      relations: ['parent', 'children']
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children']
    });
    if (!category) {
      throw new NotFoundException('Category not found.');
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return this.categoryRepository.findOne({
      where: { slug },
      relations: ['parent', 'children']
    });
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto
  ): Promise<Category> {
    const category = await this.findOne(id);
    const merged = this.categoryRepository.merge(category, updateCategoryDto);
    return this.categoryRepository.save(merged);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
  }

  async getFormSchema(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['steps', 'steps.fields'],
    });
    if (!category) {
      throw new NotFoundException('Category not found.');
    }
    return category;
  }
}
