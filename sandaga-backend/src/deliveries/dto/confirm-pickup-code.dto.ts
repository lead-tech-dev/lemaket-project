import { IsString, Length } from 'class-validator';

export class ConfirmPickupCodeDto {
  @IsString()
  @Length(4, 10)
  code!: string;
}
