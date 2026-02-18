import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength
} from 'class-validator';
import { ListingStatus } from '../../common/enums/listing-status.enum';

export class BulkUpdateListingStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  listingIds!: string[];

  @IsEnum(ListingStatus)
  status!: ListingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
