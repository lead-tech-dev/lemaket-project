import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import jwtConfig from './config/jwt.config';
import storageConfig from './config/storage.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ListingsModule } from './listings/listings.module';
import { FavoritesModule } from './favorites/favorites.module';
import { MessagesModule } from './messages/messages.module';
import { ReportsModule } from './reports/reports.module';
import { PaymentsModule } from './payments/payments.module';
import { PromotionsModule } from './promotions/promotions.module';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HomeModule } from './home/home.module';
import { MediaModule } from './media/media.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import paymentsConfig from './config/payments.config';
import { NotificationsModule } from './notifications/notifications.module';
import { FormsModule } from './forms/forms.module';
import { LinksModule } from './links/links.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AlertsModule } from './alerts/alerts.module';
import { StorefrontsModule } from './storefronts/storefronts.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, jwtConfig, storageConfig, paymentsConfig]
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        synchronize: configService.get<boolean>('database.synchronize'),
        autoLoadEntities: true
      })
    }),
    UsersModule,
    AuthModule,
    CategoriesModule,
    ListingsModule,
    FavoritesModule,
    MessagesModule,
    ReportsModule,
    PaymentsModule,
    PromotionsModule,
    AdminModule,
    NotificationsModule,
    DashboardModule,
    HomeModule,
    MediaModule,
    FormsModule,
    LinksModule,
    ReviewsModule,
    AlertsModule,
    StorefrontsModule,
    DeliveriesModule,
    OrdersModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
