import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MonitoringMetricsService } from './monitoring.metrics.service';

@Controller()
export class MonitoringController {
  constructor(private readonly monitoringMetrics: MonitoringMetricsService) {}

  @Get('metrics')
  getMetrics(@Res() response: Response) {
    response.setHeader('Content-Type', this.monitoringMetrics.getContentType());
    response.send(this.monitoringMetrics.renderPrometheusMetrics());
  }
}
