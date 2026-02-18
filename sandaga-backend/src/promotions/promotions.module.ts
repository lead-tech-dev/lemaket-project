import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { Promotion } from './promotion.entity';
import { AdminModule } from '../admin/admin.module';
import { Listing } from '../listings/listing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion, Listing]), AdminModule],
  providers: [PromotionsService],
  controllers: [PromotionsController],
  exports: [PromotionsService]
})
export class PromotionsModule {}
