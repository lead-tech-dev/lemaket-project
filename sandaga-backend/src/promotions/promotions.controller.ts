import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminService } from '../admin/admin.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Promotion } from './promotion.entity';
import { UpdatePromotionStatusDto } from './dto/update-promotion-status.dto';

@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly adminService: AdminService
  ) {}

  @Get()
  async findAll() {
    const promotions = await this.promotionsService.findAll();
    return promotions.map(promotion => this.mapPromotion(promotion));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const promotion = await this.promotionsService.findOne(id);
    return this.mapPromotion(promotion);
  }

  @Post()
  async create(
    @Body() dto: CreatePromotionDto,
    @CurrentUser() user: AuthUser
  ) {
    const promotion = await this.promotionsService.create(dto);
    await this.adminService.recordLog({
      action: 'promotions.create',
      actorName: user.email,
      actorRole: user.role,
      details: `Création campagne "${promotion.name}" (${promotion.id})`
    });
    return this.mapPromotion(promotion);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
    @CurrentUser() user: AuthUser
  ) {
    const promotion = await this.promotionsService.update(id, dto);
    await this.adminService.recordLog({
      action: 'promotions.update',
      actorName: user.email,
      actorRole: user.role,
      details: `Mise à jour campagne "${promotion.name}" (${promotion.id})`
    });
    return this.mapPromotion(promotion);
  }

  @Patch(':id/status')
  async transitionStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionStatusDto,
    @CurrentUser() user: AuthUser
  ) {
    const promotion = await this.promotionsService.transitionStatus(id, dto.status);
    await this.adminService.recordLog({
      action: 'promotions.status',
      actorName: user.email,
      actorRole: user.role,
      details: `Statut ${promotion.status} appliqué à "${promotion.name}" (${promotion.id})`
    });
    return this.mapPromotion(promotion);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser
  ) {
    const promotion = await this.promotionsService.findOne(id);
    await this.promotionsService.remove(id);
    await this.adminService.recordLog({
      action: 'promotions.delete',
      actorName: user.email,
      actorRole: user.role,
      details: `Suppression campagne "${promotion.name}" (${promotion.id})`
    });
    return { success: true };
  }

  private mapPromotion(promotion: Promotion) {
    return {
      id: promotion.id,
      name: promotion.name,
      type: promotion.type,
      status: promotion.status,
      startDate: promotion.startDate?.toISOString?.() ?? promotion.startDate,
      endDate: promotion.endDate?.toISOString?.() ?? promotion.endDate,
      budget: Number(promotion.budget),
      description: promotion.description,
      listingId: promotion.listingId,
      listing: promotion.listing
        ? {
            id: promotion.listing.id,
            title: promotion.listing.title,
            ownerId: promotion.listing.owner?.id
          }
        : null,
      created_at: promotion.created_at,
      updatedAt: promotion.updatedAt
    };
  }
}
