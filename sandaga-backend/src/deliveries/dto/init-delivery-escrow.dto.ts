import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class InitDeliveryEscrowDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  dropoffAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  dropoffNotes?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsUUID()
  preferredCourierId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['delivery', 'pickup'])
  handoverMode?: 'delivery' | 'pickup';

  @IsOptional()
  @IsString()
  @IsIn(['mobile_money', 'card', 'wallet'])
  paymentMethod?: 'mobile_money' | 'card' | 'wallet';

  @IsOptional()
  @IsString()
  @IsIn(['inline', 'redirect'])
  paymentMode?: 'inline' | 'redirect';

  @IsOptional()
  @IsString()
  @IsIn(['mtn', 'orange'])
  paymentOperator?: 'mtn' | 'orange';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  paymentPhone?: string;
}
