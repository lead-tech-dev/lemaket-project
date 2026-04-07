import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpsertSearchSynonymDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  term: string

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  synonym: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
