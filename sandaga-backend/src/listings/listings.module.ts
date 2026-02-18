import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { MediaModule } from '../media/media.module';
import { FormStep } from '../forms/entities/form-step.entity';
import { SearchLogsModule } from '../search-logs/search-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, ListingImage, FormStep]),
    CategoriesModule,
    UsersModule,
    MediaModule,
    SearchLogsModule,
    NotificationsModule
  ],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService]
})
export class ListingsModule {}
