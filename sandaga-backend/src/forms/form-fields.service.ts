import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormField } from './entities/form-field.entity';

@Injectable()
export class FormFieldsService {
  constructor(
    @InjectRepository(FormField)
    private readonly formFieldRepository: Repository<FormField>,
  ) {}

  private sanitizeDto(dto: any): Partial<FormField> {
    const allowedKeys = new Set([
      'name',
      'label',
      'type',
      'unit',
      'info',
      'values',
      'rules',
      'modalForInfo',
      'modalsForInfo',
      'default_checked',
      'disabled',
      'step',
    ]);

    return Object.entries(dto ?? {}).reduce<Partial<FormField>>((acc, [key, value]) => {
      if (allowedKeys.has(key)) {
        (acc as any)[key] = value;
      }
      return acc;
    }, {});
  }

  async create(createFormFieldDto: any): Promise<FormField> {
    const formField = this.formFieldRepository.create(this.sanitizeDto(createFormFieldDto));
    return this.formFieldRepository.save(formField);
  }

  async findAllForStep(stepId: string): Promise<FormField[]> {
    return this.formFieldRepository.find({ where: { step: { id: stepId } } });
  }

  async findOne(id: string): Promise<FormField> {
    return this.formFieldRepository.findOne({ where: { id } });
  }

  async update(id: string, updateFormFieldDto: any): Promise<FormField> {
    await this.formFieldRepository.update(id, this.sanitizeDto(updateFormFieldDto));
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.formFieldRepository.delete(id);
  }
}
