import { Controller, Get, Patch, Query, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ModerationFiltersDto } from './dto/moderation-filters.dto';
import { BulkUpdateListingStatusDto } from './dto/bulk-update-listing-status.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminModerationController {
  constructor(private readonly adminService: AdminService) {}

  @Get('listings')
  async getListings(@Query() filters: ModerationFiltersDto) {
    const [items, options] = await Promise.all([
      this.adminService.getModerationQueue(filters),
      this.adminService.getModerationFilters()
    ]);

    return {
      items,
      total: items.length,
      filters: options
    };
  }

  @Patch('listings/status')
  updateListingsStatus(
    @Body() dto: BulkUpdateListingStatusDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.adminService.bulkUpdateListingStatus(dto, {
      email: user.email,
      role: user.role
    });
  }
}
