import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { ListingsService } from '../listings/listings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { IdentityVerificationStatus } from '../users/enums/identity-verification-status.enum';
import { CompanyVerificationStatus } from '../users/enums/company-verification-status.enum';
import { UserFollow } from '../users/user-follow.entity';
import type { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import type { ListingResponseDTO } from '../listings/dto/listing-response.dto';
import { StorefrontListingsQueryDto } from './dto/storefront-listings.dto';
import {
  StorefrontCategorySummaryDto,
  StorefrontResponseDto
} from './dto/storefront-response.dto';

@Injectable()
export class StorefrontsService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Listing) private readonly listingRepository: Repository<Listing>,
    @InjectRepository(UserFollow) private readonly userFollowsRepository: Repository<UserFollow>,
    private readonly listingsService: ListingsService,
    private readonly reviewsService: ReviewsService
  ) {}

  async getStorefront(slug: string, viewerId?: string): Promise<StorefrontResponseDto> {
    const user = await this.findStorefrontOwner(slug);
    const listingCount = await this.listingRepository.count({
      where: { owner: { id: user.id }, status: ListingStatus.PUBLISHED }
    });

    const rawCategories = await this.listingRepository
      .createQueryBuilder('listing')
      .innerJoin('listing.category', 'category')
      .select('category.id', 'id')
      .addSelect('category.name', 'name')
      .addSelect('category.slug', 'slug')
      .addSelect('COUNT(listing.id)', 'count')
      .where('listing.owner_id = :ownerId', { ownerId: user.id })
      .andWhere('listing.status = :status', { status: ListingStatus.PUBLISHED })
      .groupBy('category.id')
      .addGroupBy('category.name')
      .addGroupBy('category.slug')
      .orderBy('COUNT(listing.id)', 'DESC')
      .getRawMany<StorefrontCategorySummaryDto>();

    const categories = rawCategories.map(category => ({
      ...category,
      count: Number(category.count) || 0
    }));

    const reviews = await this.reviewsService.getSellerReviews(user.id, 0);
    const nameFallback = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    const storefrontName =
      user.companyName?.trim() || nameFallback || 'Boutique';
    const followersCount = await this.userFollowsRepository.count({
      where: { sellerId: user.id }
    });
    const isFollowed = viewerId
      ? Boolean(
          await this.userFollowsRepository.findOne({
            where: { sellerId: user.id, followerId: viewerId },
            select: ['id']
          })
        )
      : false;

    return {
      id: user.id,
      slug: user.storefrontSlug ?? '',
      name: storefrontName,
      tagline: user.storefrontTagline ?? null,
      description: user.businessDescription ?? null,
      heroUrl: user.storefrontHeroUrl ?? null,
      theme: user.storefrontTheme ?? null,
      avatarUrl: user.avatarUrl ?? null,
      location: user.location ?? null,
      website: user.businessWebsite ?? null,
      companyId: user.companyId ?? null,
      phoneNumber: user.phoneNumber ?? null,
      isPro: user.isPro,
      isVerified:
        user.isVerified ||
        user.identityVerificationStatus === IdentityVerificationStatus.APPROVED,
      isCompanyVerified:
        user.companyVerificationStatus === CompanyVerificationStatus.APPROVED,
      identityStatus: user.identityVerificationStatus,
      storefrontShowReviews: user.storefrontShowReviews,
      followersCount,
      isFollowed,
      stats: {
        listingCount,
        averageRating: reviews.summary.averageRating,
        totalReviews: reviews.summary.totalReviews
      },
      categories
    };
  }

  async getStorefrontListings(
    slug: string,
    query: StorefrontListingsQueryDto
  ): Promise<PaginatedResult<ListingResponseDTO>> {
    const user = await this.findStorefrontOwner(slug);
    const normalizedCategory = query.categorySlug?.trim().toLowerCase();
    return this.listingsService.listPublishedByOwner(user.id, {
      page: query.page ?? 1,
      limit: query.limit ?? 12,
      categorySlug: normalizedCategory,
      sort: query.sort
    });
  }

  private async findStorefrontOwner(slug: string): Promise<User> {
    const normalizedSlug = slug.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { storefrontSlug: normalizedSlug }
    });

    if (!user || !user.isActive || !user.isPro || !user.storefrontSlug) {
      throw new NotFoundException('Storefront not found.');
    }

    return user;
  }
}
