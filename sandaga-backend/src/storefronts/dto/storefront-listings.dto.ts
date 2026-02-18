import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';

export enum StorefrontListingsSort {
  RECENT = 'recent',
  PRICE_ASC = 'priceAsc',
  PRICE_DESC = 'priceDesc',
  POPULAR = 'popular'
}

export class StorefrontListingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  categorySlug?: string;

  @IsOptional()
  @IsEnum(StorefrontListingsSort)
  sort?: StorefrontListingsSort;
}
