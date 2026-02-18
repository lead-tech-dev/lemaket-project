import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsString,
  Length,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

const CONTACT_CHANNELS = ['email', 'sms', 'phone', 'whatsapp', 'in_app'] as const;
type ContactChannel = (typeof CONTACT_CHANNELS)[number];

class CourierLocationDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 20)
  zipcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  showPhoneToApprovedOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  maskPreciseLocation?: boolean;

  @IsOptional()
  @IsBoolean()
  enableTwoFactorAuth?: boolean;

  @IsOptional()
  @IsBoolean()
  tipsNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  favoritePriceAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  emailAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  importantSmsNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  savedSearchAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  moderationAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  systemAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(CONTACT_CHANNELS, { each: true })
  preferredContactChannels?: ContactChannel[];

  @IsOptional()
  @IsBoolean()
  onboardingChecklistDismissed?: boolean;

  @IsOptional()
  @IsBoolean()
  isCourier?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CourierLocationDto)
  courierLocation?: CourierLocationDto;

  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(50)
  courierRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  aiAutoReplyEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(720)
  aiAutoReplyCooldownMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  aiAutoReplyDailyLimit?: number;

  @IsOptional()
  @IsIn(['mtn', 'orange'])
  payoutMobileNetwork?: 'mtn' | 'orange';

  @IsOptional()
  @IsString()
  @Length(6, 20)
  payoutMobileNumber?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  payoutMobileName?: string;
}
