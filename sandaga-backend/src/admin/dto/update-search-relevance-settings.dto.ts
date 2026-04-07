import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

export class UpdateSearchRelevanceSettingsDto {
  @IsOptional()
  @IsBoolean()
  enableBusinessBoost?: boolean

  @IsOptional()
  @IsBoolean()
  enableDynamicSynonyms?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  popularCityBoost?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  proSellerBoost?: number

  @IsOptional()
  @IsString()
  categoryWeightsText?: string
}
