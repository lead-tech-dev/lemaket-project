import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';
import { AdminModule } from '../admin/admin.module';
import { UserAddress } from './user-address.entity';
import { MediaModule } from '../media/media.module';
import { Listing } from '../listings/listing.entity';
import { Favorite } from '../favorites/favorite.entity';
import { UserFollow } from './user-follow.entity';
import { Review } from '../reviews/review.entity';
import { Message } from '../messages/message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserAddress, Listing, Favorite, UserFollow, Review, Message]),
    AdminModule,
    MediaModule
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
