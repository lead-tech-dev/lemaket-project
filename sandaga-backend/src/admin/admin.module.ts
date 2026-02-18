import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminLog } from './admin-log.entity';
import { AdminSetting } from './admin-setting.entity';
import { Listing } from '../listings/listing.entity';
import { Report } from '../reports/report.entity';
import { User } from '../users/user.entity';
import { Category } from '../categories/category.entity';
import { AdminModerationController } from './admin-moderation.controller';
import { AdminExportController } from './admin-export.controller';
import { AdminExportService } from './admin-export.service';
import { MessageNotificationLog } from '../messages/message-notification-log.entity';
import { WalletTransaction } from '../payments/wallet-transaction.entity';
import { Payment } from '../payments/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminLog,
      AdminSetting,
      Listing,
      Report,
      User,
      Category,
      MessageNotificationLog,
      WalletTransaction,
      Payment
    ])
  ],
  providers: [AdminService, AdminExportService],
  controllers: [AdminController, AdminModerationController, AdminExportController],
  exports: [AdminService, AdminExportService]
})
export class AdminModule {}
