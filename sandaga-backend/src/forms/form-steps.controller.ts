import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FormStepsService } from './form-steps.service';

@Controller('admin/forms/steps')
export class FormStepsController {
  constructor(private readonly formStepsService: FormStepsService) {}

  @Post('category/:categoryId')
  create(@Param('categoryId') categoryId: string, @Body() createFormStepDto: any) {
    return this.formStepsService.create({ ...createFormStepDto, category: { id: categoryId } });
  }

  @Get('category/:categoryId')
  findAllForCategory(@Param('categoryId') categoryId: string) {
    return this.formStepsService.findAllForCategory(categoryId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formStepsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFormStepDto: any) {
    return this.formStepsService.update(id, updateFormStepDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.formStepsService.remove(id);
  }
}
