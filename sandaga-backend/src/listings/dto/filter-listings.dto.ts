import { Transform, Type } from 'class-transformer';
import {
  Max,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';
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

function transformStringArray(value: unknown): string[] | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [value];

  const normalized = values
    .flatMap(entry => (typeof entry === 'string' ? entry.split(',') : [entry]))
    .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

export class FilterListingsDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
      }
      if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
      }
    }
    return value;
  })
  @IsBoolean()
  titleOnly?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categorySlug?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @Transform(({ value }) => transformStringArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  cityIds?: string[];

  @IsOptional()
  @IsUUID()
  neighborhoodId?: string;

  @IsOptional()
  @Transform(({ value }) => transformStringArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  neighborhoodIds?: string[];

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
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
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new BadRequestException('attributes must be a valid JSON object.');
        }
        return parsed;
      } catch {
        throw new BadRequestException('attributes must be a valid JSON object.');
      }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('attributes must be a valid JSON object.');
    }
    return value;
  })
  attributes?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  radiusKm?: number;
}
