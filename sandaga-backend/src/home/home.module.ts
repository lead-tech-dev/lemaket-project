import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
import { CategoriesModule } from '../categories/categories.module';
import { ListingsModule } from '../listings/listings.module';
import { UsersModule } from '../users/users.module';
import { SearchLogsModule } from '../search-logs/search-logs.module';
import { User } from '../users/user.entity';
import { Review } from '../reviews/review.entity';

@Module({
  imports: [
    CategoriesModule,
    ListingsModule,
    UsersModule,
    SearchLogsModule,
    TypeOrmModule.forFeature([User, Review])
  ],
  providers: [HomeService],
  controllers: [HomeController]
})
export class HomeModule {}
