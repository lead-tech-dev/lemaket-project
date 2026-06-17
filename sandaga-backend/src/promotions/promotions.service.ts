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
import { ListingStatus } from '../common/enums/listing-status.enum';
import type { PromotionPaymentStatus } from './promotion.entity';

@Injectable()
export class PromotionsService {
  private maintenanceRunning = false;
  private lastMaintenanceRunAt = 0;
  private readonly maintenanceMinIntervalMs = 60 * 1000;

  constructor(
    @InjectRepository(Promotion)
    private readonly promotionsRepository: Repository<Promotion>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>
  ) {}

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    await this.assertPromotionPayloadValid({
      ...dto,
      startDate,
      endDate
    });
    const promotion = this.promotionsRepository.create({
      ...dto,
      startDate,
      endDate,
      budget: dto.budget.toFixed(2),
      paymentStatus: 'unpaid',
      paymentId: null
    });
    const saved = await this.promotionsRepository.save(promotion);
    await this.syncListingPromotionFlags(saved.listingId);
    return saved;
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
    const nextStartDate = dto.startDate
      ? new Date(dto.startDate)
      : promotion.startDate;
    const nextEndDate = dto.endDate ? new Date(dto.endDate) : promotion.endDate;
    const nextStatus = dto.status ?? promotion.status;
    const nextBudget = dto.budget ?? Number(promotion.budget);
    const nextListingId =
      dto.listingId !== undefined ? dto.listingId : promotion.listingId;
    const nextPaymentStatus = promotion.paymentStatus ?? 'unpaid';
    const nextPaymentId = promotion.paymentId ?? null;

    await this.assertPromotionPayloadValid({
      status: nextStatus,
      startDate: nextStartDate,
      endDate: nextEndDate,
      budget: nextBudget,
      listingId: nextListingId,
      paymentStatus: nextPaymentStatus,
      paymentId: nextPaymentId
    });

    Object.assign(promotion, {
      ...dto,
      startDate: nextStartDate,
      endDate: nextEndDate,
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
    if (status === PromotionStatus.ACTIVE && promotion.paymentStatus !== 'paid') {
      throw new BadRequestException(
        'Cette campagne doit être payée avant activation.'
      );
    }
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

  async runAutomationsIfDue(force = false): Promise<void> {
    const nowMs = Date.now();
    if (!force && nowMs - this.lastMaintenanceRunAt < this.maintenanceMinIntervalMs) {
      return;
    }
    if (this.maintenanceRunning) {
      return;
    }
    this.maintenanceRunning = true;
    try {
      await this.processMaintenance(new Date(nowMs));
      this.lastMaintenanceRunAt = nowMs;
    } finally {
      this.maintenanceRunning = false;
    }
  }

  private async processMaintenance(now: Date): Promise<void> {
    const promotions = await this.promotionsRepository.find({
      where: [
        { status: PromotionStatus.ACTIVE },
        { status: PromotionStatus.SCHEDULED }
      ],
      relations: { listing: true }
    });

    if (!promotions.length) {
      return;
    }

    const promotionsToSave: Promotion[] = [];
    const listingsToSave = new Map<string, Listing>();
    const impactedListingIds = new Set<string>();

    for (const promotion of promotions) {
      let changed = false;

      if (promotion.status === PromotionStatus.SCHEDULED && promotion.startDate <= now) {
        if (promotion.paymentStatus === 'paid') {
          promotion.status = PromotionStatus.ACTIVE;
          changed = true;
        }
      }

      if (promotion.status === PromotionStatus.ACTIVE && promotion.endDate < now) {
        promotion.status = PromotionStatus.COMPLETED;
        changed = true;
      }

      if (
        promotion.status === PromotionStatus.ACTIVE &&
        promotion.autoBumpIntervalHours &&
        promotion.autoBumpIntervalHours > 0 &&
        promotion.nextAutoBumpAt &&
        promotion.nextAutoBumpAt <= now
      ) {
        const listing = promotion.listing;
        if (listing && listing.status === ListingStatus.PUBLISHED) {
          listing.publishedAt = now;
          listingsToSave.set(listing.id, listing);
        }

        const intervalMs = promotion.autoBumpIntervalHours * 60 * 60 * 1000;
        let next = promotion.nextAutoBumpAt;
        while (next <= now) {
          next = new Date(next.getTime() + intervalMs);
        }
        promotion.nextAutoBumpAt = next;
        changed = true;
      }

      if (changed) {
        promotionsToSave.push(promotion);
        if (promotion.listingId) {
          impactedListingIds.add(promotion.listingId);
        }
      }
    }

    if (promotionsToSave.length > 0) {
      await this.promotionsRepository.save(promotionsToSave);
    }
    if (listingsToSave.size > 0) {
      await this.listingsRepository.save(Array.from(listingsToSave.values()));
    }

    for (const listingId of impactedListingIds) {
      await this.syncListingPromotionFlags(listingId);
    }
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
    const hasPremium = validPromotions.some(
      promo => promo.type === PromotionType.PREMIUM
    );

    if (
      listing.isFeatured === hasFeatured &&
      listing.isBoosted === hasBoosted &&
      listing.isPremium === hasPremium
    ) {
      return;
    }

    listing.isFeatured = hasFeatured;
    listing.isBoosted = hasBoosted;
    listing.isPremium = hasPremium;
    await this.listingsRepository.save(listing);
  }

  private async assertPromotionPayloadValid(params: {
    status: PromotionStatus;
    startDate: Date;
    endDate: Date;
    budget: number;
    listingId?: string | null;
    paymentStatus?: PromotionPaymentStatus;
    paymentId?: string | null;
  }): Promise<void> {
    const {
      status,
      startDate,
      endDate,
      budget,
      listingId,
      paymentStatus = 'unpaid',
      paymentId
    } = params;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid promotion schedule.');
    }
    if (startDate >= endDate) {
      throw new BadRequestException('Promotion end date must be after start date.');
    }
    if (!Number.isFinite(budget) || budget < 0) {
      throw new BadRequestException('Promotion budget must be a positive number.');
    }

    const now = new Date();
    if (status === PromotionStatus.SCHEDULED && startDate <= now) {
      throw new BadRequestException(
        'Scheduled promotions must start in the future.'
      );
    }
    if (
      (status === PromotionStatus.SCHEDULED || status === PromotionStatus.ACTIVE) &&
      paymentStatus !== 'paid'
    ) {
      throw new BadRequestException(
        'Campaign must be paid before scheduling or activation.'
      );
    }
    if (status === PromotionStatus.ACTIVE && startDate > now) {
      throw new BadRequestException(
        'Active promotions cannot start in the future.'
      );
    }
    if (
      (status === PromotionStatus.COMPLETED || status === PromotionStatus.CANCELLED) &&
      endDate > now
    ) {
      throw new BadRequestException(
        `Promotions with status "${status}" must have an end date in the past.`
      );
    }
    if (paymentStatus === 'paid' && !paymentId) {
      throw new BadRequestException(
        'A paid campaign requires a payment reference.'
      );
    }
    if (paymentStatus !== 'paid' && paymentId) {
      throw new BadRequestException(
        'Payment reference is allowed only for paid campaigns.'
      );
    }

    if (listingId) {
      const listing = await this.listingsRepository.findOne({
        where: { id: listingId },
        select: { id: true, status: true, expiresAt: true }
      });
      if (!listing) {
        throw new NotFoundException('Promotion listing not found.');
      }
      if (listing.status !== ListingStatus.PUBLISHED) {
        throw new BadRequestException(
          'Only published listings are eligible for campaign promotions.'
        );
      }
      if (listing.expiresAt && listing.expiresAt < now) {
        throw new BadRequestException('Expired listings are not eligible for promotions.');
      }
    }
  }

  async updatePaymentStatus(
    id: string,
    paymentStatus: PromotionPaymentStatus,
    paymentId?: string | null
  ): Promise<Promotion> {
    const promotion = await this.findOne(id);

    if (
      paymentStatus !== 'paid' &&
      (promotion.status === PromotionStatus.ACTIVE ||
        promotion.status === PromotionStatus.SCHEDULED)
    ) {
      throw new BadRequestException(
        'Campaign payment status cannot be downgraded while scheduled/active.'
      );
    }

    const normalizedPaymentId =
      paymentStatus === 'paid'
        ? paymentId?.trim() || promotion.paymentId || null
        : null;

    if (paymentStatus === 'paid' && !normalizedPaymentId) {
      throw new BadRequestException(
        'Payment reference is required when campaign is marked as paid.'
      );
    }

    promotion.paymentStatus = paymentStatus;
    promotion.paymentId = normalizedPaymentId;

    const saved = await this.promotionsRepository.save(promotion);
    await this.syncListingPromotionFlags(saved.listingId);
    return saved;
  }
}
