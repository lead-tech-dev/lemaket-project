import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormStep } from './entities/form-step.entity';
import { Category } from '../categories/category.entity';

@Injectable()
export class FormStepsService {
  constructor(
    @InjectRepository(FormStep)
    private readonly formStepRepository: Repository<FormStep>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(createFormStepDto: any): Promise<FormStep> {
    const categoryId = createFormStepDto?.category?.id;
    if (!categoryId) {
      throw new BadRequestException('Une catégorie est requise pour créer un formulaire.');
    }

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
      relations: ['parent'],
    });

    if (!category) {
      throw new NotFoundException('Catégorie introuvable.');
    }

    if (!category.parent) {
      throw new BadRequestException('Les formulaires ne peuvent être créés que pour les sous-catégories.');
    }

    const formStep = this.formStepRepository.create(createFormStepDto as Partial<FormStep>);
    return this.formStepRepository.save(formStep);
  }

  async findAllForCategory(categoryId: string): Promise<FormStep[]> {
    return this.formStepRepository.find({ where: { category: { id: categoryId } } });
  }

  async findOne(id: string): Promise<FormStep> {
    return this.formStepRepository.findOne({ where: { id } });
  }

  async update(id: string, updateFormStepDto: any): Promise<FormStep> {
    await this.formStepRepository.update(id, updateFormStepDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.formStepRepository.delete(id);
  }
}
