import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { StorefrontsService } from './storefronts.service';
import { StorefrontListingsQueryDto } from './dto/storefront-listings.dto';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('storefronts')
export class StorefrontsController {
  constructor(private readonly storefrontsService: StorefrontsService) {}

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  getStorefront(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.storefrontsService.getStorefront(slug, user?.id);
  }

  @Get(':slug/listings')
  getStorefrontListings(
    @Param('slug') slug: string,
    @Query() query: StorefrontListingsQueryDto
  ) {
    return this.storefrontsService.getStorefrontListings(slug, query);
  }
}
