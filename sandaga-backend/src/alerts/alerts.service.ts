import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './alert.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertsRepository: Repository<Alert>
  ) {}

  async create(dto: CreateAlertDto, user: AuthUser): Promise<Alert> {
    const term = dto.term?.trim() || null;
    const location = dto.location?.trim() || null;
    const categorySlug = dto.categorySlug?.trim() || null;

    const sellerType =
      dto.sellerType && dto.sellerType !== 'all' ? dto.sellerType : null;
    const priceBand =
      dto.priceBand && dto.priceBand !== 'all' ? dto.priceBand : null;
    const radiusKm = Number.isFinite(dto.radius)
      ? Math.round(dto.radius as number)
      : null;

    if (
      !term &&
      !location &&
      !categorySlug &&
      !sellerType &&
      !priceBand &&
      !radiusKm
    ) {
      throw new BadRequestException(
        'Please provide at least one alert criterion.'
      );
    }

    const alert = this.alertsRepository.create({
      userId: user.id,
      term,
      location,
      categorySlug,
      sellerType,
      priceBand,
      radiusKm
    });

    return this.alertsRepository.save(alert);
  }

  async findForUser(user: AuthUser): Promise<Alert[]> {
    return this.alertsRepository.find({
      where: { userId: user.id },
      order: { created_at: 'DESC' }
    });
  }

  async removeForUser(id: string, user: AuthUser): Promise<{ success: true }> {
    const alert = await this.alertsRepository.findOne({
      where: { id, userId: user.id }
    });

    if (!alert) {
      throw new NotFoundException('Alert not found.');
    }

    await this.alertsRepository.remove(alert);
    return { success: true };
  }

  async updateForUser(
    id: string,
    user: AuthUser,
    dto: UpdateAlertDto
  ): Promise<Alert> {
    const alert = await this.alertsRepository.findOne({
      where: { id, userId: user.id }
    });

    if (!alert) {
      throw new NotFoundException('Alert not found.');
    }

    const update: Partial<Alert> = {};

    if (dto.term !== undefined) {
      update.term = dto.term?.trim() || null;
    }
    if (dto.location !== undefined) {
      update.location = dto.location?.trim() || null;
    }
    if (dto.categorySlug !== undefined) {
      update.categorySlug = dto.categorySlug?.trim() || null;
    }
    if (dto.sellerType !== undefined) {
      update.sellerType =
        dto.sellerType && dto.sellerType !== 'all' ? dto.sellerType : null;
    }
    if (dto.priceBand !== undefined) {
      update.priceBand =
        dto.priceBand && dto.priceBand !== 'all' ? dto.priceBand : null;
    }
    if (dto.radius !== undefined) {
      const radiusValue = Number(dto.radius);
      update.radiusKm =
        Number.isFinite(radiusValue) && radiusValue > 0
          ? Math.round(radiusValue)
          : null;
    }
    if (dto.isActive !== undefined) {
      update.isActive = dto.isActive;
    }

    const resolvedTerm = update.term ?? alert.term ?? null;
    const resolvedLocation = update.location ?? alert.location ?? null;
    const resolvedCategory = update.categorySlug ?? alert.categorySlug ?? null;
    const resolvedSellerType = update.sellerType ?? alert.sellerType ?? null;
    const resolvedPriceBand = update.priceBand ?? alert.priceBand ?? null;
    const resolvedRadius = update.radiusKm ?? alert.radiusKm ?? null;
    if (
      !resolvedTerm &&
      !resolvedLocation &&
      !resolvedCategory &&
      !resolvedSellerType &&
      !resolvedPriceBand &&
      !resolvedRadius
    ) {
      throw new BadRequestException(
        'Please provide at least one alert criterion.'
      );
    }

    Object.assign(alert, update);
    return this.alertsRepository.save(alert);
  }
}
