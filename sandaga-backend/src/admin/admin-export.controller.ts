import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards
} from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { AdminExportService } from './admin-export.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditScope } from './dto/audit-query.dto';
import { ExportRequestDto } from './dto/export-request.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';

@Controller('admin/export')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminExportController {
  constructor(
    private readonly adminExportService: AdminExportService,
    private readonly adminService: AdminService
  ) {}

  @Post(':scope')
  async startExport(
    @Param('scope') scopeParam: string,
    @Body() body: ExportRequestDto,
    @CurrentUser() user: AuthUser
  ) {
    const scope = this.resolveScope(scopeParam);
    const job = this.adminExportService.startExport(scope, body.format);
    await this.adminService.recordLog({
      action: `${scope}.export`,
      actorName: user.email,
      actorRole: user.role,
      details: `Export ${body.format.toUpperCase()} démarré (${job.id})`
    });
    return job;
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string) {
    return this.adminExportService.getJob(jobId);
  }

  @Get('jobs/:jobId/download')
  download(@Param('jobId') jobId: string) {
    const file = this.adminExportService.getJobFile(jobId);
    return new StreamableFile(file.buffer, {
      disposition: `attachment; filename="${file.filename}"`,
      type: file.mime
    });
  }

  private resolveScope(value: string): AuditScope {
    const normalized = value.toLowerCase() as AuditScope;
    if (!Object.values(AuditScope).includes(normalized)) {
      throw new BadRequestException(`Unknown export scope "${value}".`);
    }
    return normalized;
  }
}
