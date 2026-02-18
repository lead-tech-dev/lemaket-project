import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { AdminService } from '../admin/admin.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly adminService: AdminService
  ) {}

  @Post()
  create(
    @Body() createReportDto: CreateReportDto,
    @CurrentUser() user?: AuthUser
  ) {
    return this.reportsService.create(createReportDto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  findAll(@Query() query: ListReportsDto) {
    return this.reportsService.findAll(query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async update(
    @Param('id') id: string,
    @Body() updateReportDto: UpdateReportDto,
    @CurrentUser() actor: AuthUser
  ) {
    const report = await this.reportsService.update(id, updateReportDto);
    await this.adminService.recordLog({
      action: 'reports.update',
      actorName: actor.email,
      actorRole: actor.role,
      details: `Signalement ${id} mis à jour (${report.status})`
    });
    return report;
  }
}
