import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { Favorite } from './favorite.entity';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite]), ListingsModule],
  providers: [FavoritesService],
  controllers: [FavoritesController],
  exports: [FavoritesService]
})
export class FavoritesModule {}
