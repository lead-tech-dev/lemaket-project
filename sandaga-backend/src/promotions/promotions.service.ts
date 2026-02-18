import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from './promotion.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionStatus } from '../common/enums/promotion-status.enum';
import { PromotionType } from '../common/enums/promotion-type.enum';
import { Listing } from '../listings/listing.entity';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionsRepository: Repository<Promotion>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>
  ) {}

  create(dto: CreatePromotionDto): Promise<Promotion> {
    const promotion = this.promotionsRepository.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      budget: dto.budget.toFixed(2)
    });
    return this.promotionsRepository.save(promotion).then(async saved => {
      await this.syncListingPromotionFlags(saved.listingId);
      return saved;
    });
  }

  findAll(): Promise<Promotion[]> {
    return this.promotionsRepository.find({
      order: { startDate: 'DESC' },
      relations: { listing: true }
    });
  }

  async findOne(id: string): Promise<Promotion> {
    const promotion = await this.promotionsRepository.findOne({
      where: { id },
      relations: { listing: true }
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found.');
    }

    return promotion;
  }

  async update(id: string, dto: UpdatePromotionDto): Promise<Promotion> {
    const promotion = await this.findOne(id);
    const previousListingId = promotion.listingId;
    Object.assign(promotion, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : promotion.startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : promotion.endDate,
      budget: dto.budget !== undefined ? dto.budget.toFixed(2) : promotion.budget
    });

    const saved = await this.promotionsRepository.save(promotion);
    if (previousListingId && previousListingId !== saved.listingId) {
      await this.syncListingPromotionFlags(previousListingId);
    }
    await this.syncListingPromotionFlags(saved.listingId);
    return saved;
  }

  async transitionStatus(
    id: string,
    status: PromotionStatus
  ): Promise<Promotion> {
    const promotion = await this.findOne(id);
    const allowedTransitions: Record<PromotionStatus, PromotionStatus[]> = {
      [PromotionStatus.DRAFT]: [
        PromotionStatus.SCHEDULED,
        PromotionStatus.ACTIVE,
        PromotionStatus.CANCELLED
      ],
      [PromotionStatus.SCHEDULED]: [
        PromotionStatus.ACTIVE,
        PromotionStatus.CANCELLED
      ],
      [PromotionStatus.ACTIVE]: [
        PromotionStatus.COMPLETED,
        PromotionStatus.CANCELLED
      ],
      [PromotionStatus.COMPLETED]: [],
      [PromotionStatus.CANCELLED]: []
    };

    const allowedTargets = allowedTransitions[promotion.status] ?? [];
    if (!allowedTargets.includes(status)) {
      throw new BadRequestException(
        `Transition from ${promotion.status} to ${status} is not permitted.`
      );
    }

    promotion.status = status;
    if (status === PromotionStatus.CANCELLED) {
      promotion.endDate = new Date();
    }
    if (status === PromotionStatus.ACTIVE && promotion.startDate > new Date()) {
      promotion.startDate = new Date();
    }
    if (status === PromotionStatus.COMPLETED && promotion.endDate < new Date()) {
      promotion.endDate = new Date();
    }

    const saved = await this.promotionsRepository.save(promotion);
    await this.syncListingPromotionFlags(saved.listingId);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const promotion = await this.findOne(id);
    const listingId = promotion.listingId;
    await this.promotionsRepository.remove(promotion);
    await this.syncListingPromotionFlags(listingId);
  }

  private async syncListingPromotionFlags(listingId?: string | null): Promise<void> {
    if (!listingId) {
      return;
    }

    const listing = await this.listingsRepository.findOne({
      where: { id: listingId }
    });
    if (!listing) {
      return;
    }

    const now = new Date();
    const activePromotions = await this.promotionsRepository.find({
      where: { listingId, status: PromotionStatus.ACTIVE }
    });

    const validPromotions = activePromotions.filter(
      promo => promo.startDate <= now && promo.endDate >= now
    );
    const expiredPromotions = activePromotions.filter(promo => promo.endDate < now);
    if (expiredPromotions.length) {
      await this.promotionsRepository.save(
        expiredPromotions.map(promo => ({
          ...promo,
          status: PromotionStatus.COMPLETED
        }))
      );
    }

    const hasFeatured = validPromotions.some(
      promo => promo.type === PromotionType.FEATURED || promo.type === PromotionType.PREMIUM
    );
    const hasBoosted = validPromotions.some(
      promo =>
        promo.type === PromotionType.BOOST ||
        promo.type === PromotionType.PREMIUM ||
        promo.type === PromotionType.HIGHLIGHT
    );

    if (listing.isFeatured === hasFeatured && listing.isBoosted === hasBoosted) {
      return;
    }

    listing.isFeatured = hasFeatured;
    listing.isBoosted = hasBoosted;
    await this.listingsRepository.save(listing);
  }
}
