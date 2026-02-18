import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ListingsModule } from '../listings/listings.module';
import { MessagesModule } from '../messages/messages.module';
import { PaymentsModule } from '../payments/payments.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ListingsModule,
    MessagesModule,
    PaymentsModule,
    FavoritesModule,
    UsersModule,
    NotificationsModule
  ],
  providers: [DashboardService],
  controllers: [DashboardController]
})
export class DashboardModule {}
