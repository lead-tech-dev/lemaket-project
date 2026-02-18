import { IsOptional, IsString, IsUUID, Max, Min, IsInt } from 'class-validator';

export class PriceSuggestionQueryDto {
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsUUID('4')
  subCategoryId?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(500)
  sampleSize?: number;
}
