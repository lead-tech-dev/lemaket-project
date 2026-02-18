import { IsBoolean } from 'class-validator';

export class UpdateTwoFactorDto {
  @IsBoolean()
  enable!: boolean;
}
