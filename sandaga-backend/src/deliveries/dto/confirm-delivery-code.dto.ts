import { IsString, Length } from 'class-validator';

export class ConfirmDeliveryCodeDto {
  @IsString()
  @Length(4, 10)
  code!: string;
}
