import { IsBoolean } from 'class-validator';

export class ConfirmPaymentMethodDto {
  @IsBoolean()
  success!: boolean;
}
