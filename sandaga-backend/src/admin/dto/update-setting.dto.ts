import { IsArray, IsDefined, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSettingValueDto {
  @IsDefined()
  value!: unknown;
}

export class UpdateSettingDto {
  @IsString()
  key!: string;

  @IsDefined()
  value!: unknown;
}

export class UpdateSettingsBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSettingDto)
  updates!: UpdateSettingDto[];
}
