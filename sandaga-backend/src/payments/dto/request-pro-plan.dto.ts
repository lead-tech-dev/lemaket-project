import { IsEnum, IsString } from 'class-validator';

export enum ProPlanRequestMode {
  TRIAL = 'trial',
  SUBSCRIBE = 'subscribe'
}

export class RequestProPlanDto {
  @IsString()
  planId!: string;

  @IsEnum(ProPlanRequestMode)
  mode!: ProPlanRequestMode;
}
