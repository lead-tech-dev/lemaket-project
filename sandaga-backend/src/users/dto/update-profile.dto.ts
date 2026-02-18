import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength
} from 'class-validator';

const LOCAL_STORE_HERO_URL_REGEX =
  /^(\/[^\s]*|https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/[^\s]*)$/i;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  companyNiu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  companyRccm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyCity?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  businessWebsite?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, {
    message: 'Le slug doit contenir uniquement des lettres, chiffres et tirets.'
  })
  storefrontSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  storefrontTagline?: string;

  @IsOptional()
  @Matches(LOCAL_STORE_HERO_URL_REGEX, {
    message:
      'storefrontHeroUrl doit etre une URL locale (http://localhost...) ou un chemin local (/uploads/...).'
  })
  @MaxLength(255)
  storefrontHeroUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  storefrontTheme?: string;

  @IsOptional()
  @IsBoolean()
  storefrontShowReviews?: boolean;
}
