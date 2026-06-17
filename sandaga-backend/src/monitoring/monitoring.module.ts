import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSetting } from '../admin/admin-setting.entity';
import { MonitoringController } from './monitoring.controller';
import { MonitoringInterceptor } from './monitoring.interceptor';
import { MonitoringMetricsService } from './monitoring.metrics.service';
import { SearchOperationalAlertsService } from './search-operational-alerts.service';
import { SearchOperationalAlertDispatcherService } from './search-operational-alert-dispatcher.service';
import { SearchOperationalAlertSchedulerService } from './search-operational-alert-scheduler.service';
import { SearchOperationalAlertSettingsService } from './search-operational-alert-settings.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AdminSetting])],
  controllers: [MonitoringController],
  providers: [
    MonitoringMetricsService,
    SearchOperationalAlertSettingsService,
    SearchOperationalAlertsService,
    SearchOperationalAlertDispatcherService,
    SearchOperationalAlertSchedulerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor
    }
  ],
  exports: [
    MonitoringMetricsService,
    SearchOperationalAlertSettingsService,
    SearchOperationalAlertsService,
    SearchOperationalAlertDispatcherService
  ]
})
export class MonitoringModule {}
