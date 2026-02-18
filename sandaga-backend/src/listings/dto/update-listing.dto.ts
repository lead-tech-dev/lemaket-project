import { PartialType } from '@nestjs/mapped-types';
import { CreateListingDto } from './create-listing.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ListingStatus } from '../../common/enums/listing-status.enum';

export class UpdateListingDto extends PartialType(CreateListingDto) {
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
export class UpdateListingStatusDto {
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
