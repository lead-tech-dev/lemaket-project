import { IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDeliveryDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  pickupAddress?: string;

  @IsString()
  @MaxLength(300)
  dropoffAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  dropoffNotes?: string;

  @IsOptional()
  @IsNumber()
  pickupLat?: number;

  @IsOptional()
  @IsNumber()
  pickupLng?: number;

  @IsOptional()
  @IsNumber()
  dropoffLat?: number;

  @IsOptional()
  @IsNumber()
  dropoffLng?: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}
