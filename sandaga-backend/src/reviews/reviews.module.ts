import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { Review } from './review.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { Conversation } from '../messages/conversation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Listing, User, Conversation])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService]
})
export class ReviewsModule {}
