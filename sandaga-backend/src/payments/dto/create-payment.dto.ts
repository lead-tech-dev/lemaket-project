import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID('4')
  listingId!: string;

  @IsOptional()
  @IsUUID('4')
  paymentMethodId?: string;

  @IsString()
  optionId!: string;
}
