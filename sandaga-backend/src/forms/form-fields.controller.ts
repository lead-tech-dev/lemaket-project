import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FormFieldsService } from './form-fields.service';

@Controller('admin/forms/fields')
export class FormFieldsController {
  constructor(private readonly formFieldsService: FormFieldsService) {}

  @Post('step/:stepId')
  create(@Param('stepId') stepId: string, @Body() createFormFieldDto: any) {
    return this.formFieldsService.create({ ...createFormFieldDto, step: { id: stepId } });
  }

  @Get('step/:stepId')
  findAllForStep(@Param('stepId') stepId: string) {
    return this.formFieldsService.findAllForStep(stepId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formFieldsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFormFieldDto: any) {
    return this.formFieldsService.update(id, updateFormFieldDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.formFieldsService.remove(id);
  }
}
