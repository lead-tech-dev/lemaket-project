import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorefrontsController } from './storefronts.controller';
import { StorefrontsService } from './storefronts.service';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { ListingsModule } from '../listings/listings.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { UserFollow } from '../users/user-follow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Listing, UserFollow]),
    ListingsModule,
    ReviewsModule
  ],
  controllers: [StorefrontsController],
  providers: [StorefrontsService]
})
export class StorefrontsModule {}
