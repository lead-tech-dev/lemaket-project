import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveriesService } from './deliveries.service';
import { DeliveriesController } from './deliveries.controller';
import { Delivery } from './delivery.entity';
import { ListingsModule } from '../listings/listings.module';
import { Payment } from '../payments/payment.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delivery, Payment]),
    ListingsModule,
    NotificationsModule,
    PaymentsModule,
    UsersModule,
    OrdersModule,
    MessagesModule
  ],
  providers: [DeliveriesService],
  controllers: [DeliveriesController]
})
export class DeliveriesModule {}
