import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  IsArray,
  ArrayMaxSize
} from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsBoolean()
  hideExact?: boolean;
}

class ContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  phoneHidden?: boolean;

  @IsOptional()
  @IsBoolean()
  noSalesmen?: boolean;
}

class PriceDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @MaxLength(3)
  currency!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  newItemPrice?: number | null;
}

class MetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customRef?: string;
}

class ImageDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsNumber()
  position?: number;

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}

export class CreateListingDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  subCategoryId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['sell', 'buy', 'let', 'rent'])
  adType?: string | null;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @ValidateNested()
  @Type(() => PriceDto)
  price!: PriceDto;

  @ValidateNested()
  @Type(() => LocationDto)
  location!: LocationDto;

  @ValidateNested()
  @Type(() => ContactDto)
  contact!: ContactDto;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetaDto)
  meta?: MetaDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ImageDto)
  images?: ImageDto[];

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
