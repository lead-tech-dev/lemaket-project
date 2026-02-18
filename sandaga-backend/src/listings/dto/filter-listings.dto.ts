import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dtos/pagination-query.dto';
import { ListingStatus } from '../../common/enums/listing-status.enum';
import { ListingFlow } from '../listing.entity';

export enum ListingSort {
  RECENT = 'recent',
  PRICE_ASC = 'priceAsc',
  PRICE_DESC = 'priceDesc'
}

export enum SellerTypeFilter {
  PRO = 'pro',
  INDIVIDUAL = 'individual'
}

export class FilterListingsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBoosted?: boolean;

  @IsOptional()
  @IsEnum(ListingSort)
  sort?: ListingSort;

  @IsOptional()
  @IsEnum(SellerTypeFilter)
  sellerType?: SellerTypeFilter;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toUpperCase();
    }
    return value;
  })
  @IsEnum(ListingFlow)
  adType?: ListingFlow;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  attributes?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radiusKm?: number;
}
