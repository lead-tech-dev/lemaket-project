import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Res
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditScope } from './dto/audit-query.dto';
import { UpdateSettingDto, UpdateSettingsBatchDto, UpdateSettingValueDto } from './dto/update-setting.dto';
import { MessageNotificationLogQueryDto } from './dto/message-notification-log-query.dto';
import { CompanyVerificationQueryDto } from './dto/company-verification-query.dto';
import { CourierVerificationQueryDto } from './dto/courier-verification-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('activities')
  getActivities() {
    return this.adminService.getRecentActivities();
  }

  @Get('logs')
  getLogs() {
    return this.adminService.listLogs();
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Get('message-notification-logs')
  getMessageNotificationLogs(@Query() filters: MessageNotificationLogQueryDto) {
    return this.adminService.getMessageNotificationLogs(filters);
  }

  @Get('company-verifications')
  getCompanyVerifications(@Query() filters: CompanyVerificationQueryDto) {
    return this.adminService.getCompanyVerifications(filters);
  }

  @Get('courier-verifications')
  getCourierVerifications(@Query() filters: CourierVerificationQueryDto) {
    return this.adminService.getCourierVerifications(filters);
  }

  @Get('platform-wallet')
  getPlatformWallet() {
    return this.adminService.getPlatformWalletSummary();
  }

  @Get('platform-wallet/transactions')
  getPlatformWalletTransactions(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    if (parsedTo && to && to.length === 10) {
      parsedTo.setHours(23, 59, 59, 999);
    }
    return this.adminService.getPlatformWalletTransactions({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
      type: type || undefined,
      status: status || undefined,
      from: parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
      to: parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : undefined
    });
  }

  @Get('platform-wallet/transactions/export')
  async exportPlatformWalletTransactions(
    @Res({ passthrough: true }) res: Response,
    @Query('type') type: string | undefined,
    @Query('status') status: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined
  ) {
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    if (parsedTo && to && to.length === 10) {
      parsedTo.setHours(23, 59, 59, 999);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="platform-wallet-transactions.csv"');
    return this.adminService.exportPlatformWalletTransactions({
      type: type || undefined,
      status: status || undefined,
      from: parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
      to: parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : undefined
    });
  }

  @Get('zikopay/transactions')
  getZikopayTransactions(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('method') method?: string
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    if (parsedTo && to && to.length === 10) {
      parsedTo.setHours(23, 59, 59, 999);
    }
    return this.adminService.getZikopayTransactions({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
      status: (status as any) || undefined,
      from: parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
      to: parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : undefined,
      search: search || undefined,
      method: method || undefined
    });
  }

  @Get('zikopay/transactions/export')
  async exportZikopayTransactions(
    @Res({ passthrough: true }) res: Response,
    @Query('status') status: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('search') search: string | undefined,
    @Query('method') method: string | undefined
  ) {
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    if (parsedTo && to && to.length === 10) {
      parsedTo.setHours(23, 59, 59, 999);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="zikopay-transactions.csv"');
    return this.adminService.exportZikopayTransactions({
      status: (status as any) || undefined,
      from: parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
      to: parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : undefined,
      search: search || undefined,
      method: method || undefined
    });
  }

  @Get('audit/:scope')
  getAuditTrail(
    @Param('scope') scopeParam: string,
    @Query('targetId') targetId?: string,
    @Query('limit') limit?: string
  ) {
    const scope = this.resolveScope(scopeParam);
    const parsedLimit = limit ? Number(limit) : undefined;
    if (parsedLimit !== undefined && Number.isNaN(parsedLimit)) {
      throw new BadRequestException('Invalid limit parameter.');
    }
    return this.adminService.getAuditTrail({
      scope,
      targetId,
      limit: parsedLimit
    });
  }

  @Post('settings/:key')
  updateSetting(@Param('key') key: string, @Body() body: UpdateSettingValueDto) {
    return this.adminService.updateSetting(key, body.value);
  }

  @Post('settings')
  updateSettingsBatch(@Body() payload: UpdateSettingsBatchDto) {
    return this.adminService.updateSettingsBatch(payload.updates);
  }

  private resolveScope(value: string): AuditScope {
    const normalized = value.toLowerCase() as AuditScope;
    if (!Object.values(AuditScope).includes(normalized)) {
      throw new BadRequestException(`Unknown audit scope "${value}".`);
    }
    return normalized;
  }
}
