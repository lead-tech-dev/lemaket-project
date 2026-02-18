import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormStep } from './entities/form-step.entity';
import { FormField } from './entities/form-field.entity';
import { FormStepsController } from './form-steps.controller';
import { FormStepsService } from './form-steps.service';
import { FormFieldsController } from './form-fields.controller';
import { FormFieldsService } from './form-fields.service';
import { Category } from '../categories/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FormStep, FormField, Category])],
  controllers: [FormStepsController, FormFieldsController],
  providers: [FormStepsService, FormFieldsService],
})
export class FormsModule {}
