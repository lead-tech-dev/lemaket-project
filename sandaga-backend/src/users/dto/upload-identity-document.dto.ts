import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IdentityDocumentType } from '../enums/identity-document-type.enum';

export class UploadIdentityDocumentDto {
  @IsEnum(IdentityDocumentType)
  type!: IdentityDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  description?: string;
}
