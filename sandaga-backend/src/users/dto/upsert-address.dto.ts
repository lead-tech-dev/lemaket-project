import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class UpsertAddressDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(160)
  recipientName!: string;

  @IsString()
  @MaxLength(160)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  line2?: string;

  @IsString()
  @MaxLength(120)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsString()
  @MaxLength(24)
  postalCode!: string;

  @IsString()
  @MaxLength(80)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isDefaultShipping?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefaultBilling?: boolean;
}
