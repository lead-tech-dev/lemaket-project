import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { MonitoringMetricsService } from './monitoring.metrics.service';
import { SearchOperationalAlertsService } from './search-operational-alerts.service';
import { SearchOperationalAlertDispatcherService } from './search-operational-alert-dispatcher.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller()
export class MonitoringController {
  constructor(
    private readonly monitoringMetrics: MonitoringMetricsService,
    private readonly searchOperationalAlerts: SearchOperationalAlertsService,
    private readonly searchOperationalAlertDispatcher: SearchOperationalAlertDispatcherService
  ) {}

  @Get('metrics')
  getMetrics(@Res() response: Response) {
    response.setHeader('Content-Type', this.monitoringMetrics.getContentType());
    response.send(this.monitoringMetrics.renderPrometheusMetrics());
  }

  @Get('monitoring/search/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getSearchOperationalStatus(@Query('force') force?: string) {
    const shouldForce = force === '1' || force === 'true';
    return this.searchOperationalAlerts.getStatus(shouldForce);
  }

  @Post('monitoring/search/alerts/dispatch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async dispatchSearchOperationalAlerts(@Query('force') force?: string) {
    const shouldForce = force === '1' || force === 'true';
    return this.searchOperationalAlertDispatcher.dispatch(shouldForce);
  }
}
