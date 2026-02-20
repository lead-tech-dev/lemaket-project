import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MonitoringController } from './monitoring.controller';
import { MonitoringInterceptor } from './monitoring.interceptor';
import { MonitoringMetricsService } from './monitoring.metrics.service';

@Module({
  controllers: [MonitoringController],
  providers: [
    MonitoringMetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor
    }
  ]
})
export class MonitoringModule {}
