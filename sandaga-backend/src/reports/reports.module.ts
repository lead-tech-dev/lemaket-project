import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Report } from './report.entity';
import { User } from '../users/user.entity';
import { ListingsModule } from '../listings/listings.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([Report, User]), ListingsModule, AdminModule],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService]
})
export class ReportsModule {}
