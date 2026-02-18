import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { PaymentMethodType } from '../../common/enums/payment-method-type.enum';

export class CreatePaymentMethodDto {
  @IsEnum(PaymentMethodType)
  type!: PaymentMethodType;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  @Length(4, 4)
  last4?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(2024)
  expYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  holderName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  externalId?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
