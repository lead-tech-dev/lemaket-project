import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments.webhook.controller';
import { Payment } from './payment.entity';
import { PaymentMethodEntity } from './payment-method.entity';
import { Subscription } from './subscription.entity';
import { UsersModule } from '../users/users.module';
import { Listing } from '../listings/listing.entity';
import { Promotion } from '../promotions/promotion.entity';
import { Delivery } from '../deliveries/delivery.entity';
import { PaymentEvent } from './payment-event.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { WalletTransaction } from './wallet-transaction.entity';
import { WalletsService } from './wallets.service';
import { User } from '../users/user.entity';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      PaymentEvent,
      PaymentMethodEntity,
      Subscription,
      Listing,
      Promotion,
      Delivery,
      WalletTransaction,
      User
    ]),
    UsersModule,
    NotificationsModule,
    OrdersModule,
    MessagesModule
  ],
  providers: [PaymentsService, WalletsService],
  controllers: [PaymentsController, PaymentsWebhookController],
  exports: [PaymentsService, WalletsService]
})
export class PaymentsModule {}
