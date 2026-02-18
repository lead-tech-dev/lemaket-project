import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'

export class CreateShortLinkDto {
  @IsUrl({ require_protocol: true, require_tld: false }, { message: 'targetUrl doit être une URL valide (avec http/https).' })
  @IsNotEmpty()
  targetUrl!: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  slug?: string
}
