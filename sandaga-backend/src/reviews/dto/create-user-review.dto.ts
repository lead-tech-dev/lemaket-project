import { IsOptional, IsString, IsUUID, MaxLength, Min, Max, IsInt } from 'class-validator';

export class CreateUserReviewDto {
  @IsUUID()
  sellerId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MaxLength(1000)
  comment!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;
}
