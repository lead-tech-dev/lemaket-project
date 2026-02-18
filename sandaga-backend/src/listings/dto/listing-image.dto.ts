import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListingImageDto {
  @IsString()
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}
