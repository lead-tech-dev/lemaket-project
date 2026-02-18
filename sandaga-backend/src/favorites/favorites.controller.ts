import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findMine(@CurrentUser() user: AuthUser) {
    return this.favoritesService.getForUser(user);
  }

  @Post(':listingId')
  addFavorite(
    @Param('listingId') listingId: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.favoritesService.add(listingId, user);
  }

  @Delete(':listingId')
  removeFavorite(
    @Param('listingId') listingId: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.favoritesService.remove(listingId, user);
  }
}
