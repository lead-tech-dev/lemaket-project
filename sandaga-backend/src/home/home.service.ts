import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { ListingsService } from '../listings/listings.service';
import { UsersService } from '../users/users.service';
import { SearchLogsService } from '../search-logs/search-logs.service';
import { Category } from '../categories/category.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { Review } from '../reviews/review.entity';
import {
  ListingSort,
  SellerTypeFilter
} from '../listings/dto/filter-listings.dto';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { ReviewStatus } from '../common/enums/review-status.enum';
import { CompanyVerificationStatus } from '../users/enums/company-verification-status.enum';
import {
  HomeCategoryCard,
  HomeHero,
  HomeListingCard,
  HomeSellerSplit,
  HomeServiceCard,
  HomeTestimonial,
  HomeTrendingSearch,
  HomeStorefrontCard
} from './home.types';
import {
  getHomeTranslations,
  HomeLocale,
  HomeLocaleStrings
} from './home.translations';

const TEMPLATE_PATTERN = /{{\s*(\w+)\s*}}/g;

function interpolateTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(TEMPLATE_PATTERN, (_, key) =>
    values[key] !== undefined ? String(values[key]) : ''
  );
}

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly categoriesService: CategoriesService,
    private readonly listingsService: ListingsService,
    private readonly usersService: UsersService,
    private readonly searchLogsService: SearchLogsService
  ) {}

  async getHome(
    featuredSort?: ListingSort,
    latestSort?: ListingSort,
    sellerType?: SellerTypeFilter,
    locale: HomeLocale = 'fr'
  ): Promise<{
    hero: HomeHero;
    categories: HomeCategoryCard[];
    featuredListings: HomeListingCard[];
    latestListings: HomeListingCard[];
    services: HomeServiceCard[];
    sellerSplit: HomeSellerSplit;
    testimonials: HomeTestimonial[];
    trendingSearches: HomeTrendingSearch[];
    generatedAt: string;
  }> {
    const categories = await this.categoriesService.findActive();
    const localeStrings = getHomeTranslations(locale);

    const [hero, categoriesCards, listingCollections, sellerSplit, trendingSearches, testimonials] =
      await Promise.all([
        this.buildHero(categories, localeStrings),
        this.buildCategoryCards(categories),
        this.getListingCollections(
          featuredSort,
          latestSort,
          sellerType,
          locale
        ),
        this.getSellerSplit(),
        this.searchLogsService.getTrendingSearches().catch(() => []),
        this.getTestimonials(locale)
      ]);

    return {
      hero,
      categories: categoriesCards,
      featuredListings: listingCollections.featured,
      latestListings: listingCollections.latest,
      services: localeStrings.services,
      sellerSplit,
      testimonials,
      trendingSearches,
      generatedAt: new Date().toISOString()
    };
  }

  async getHero(locale: HomeLocale = 'fr'): Promise<HomeHero> {
    const categories = await this.categoriesService.findActive();
    return this.buildHero(categories, getHomeTranslations(locale));
  }

  async getCategories(): Promise<HomeCategoryCard[]> {
    const categories = await this.categoriesService.findActive();
    return this.buildCategoryCards(categories);
  }

  async getFeaturedListings(
    limit?: number,
    sort: ListingSort = ListingSort.RECENT,
    sellerType?: SellerTypeFilter,
    locale: HomeLocale = 'fr'
  ): Promise<HomeListingCard[]> {
    const take = limit && limit > 0 ? limit : 4;
    const listings = await this.listingsService.getFeatured(
      take,
      sort,
      sellerType
    );
    const localeStrings = getHomeTranslations(locale);
    return listings.map((listing, index) =>
      this.mapListingCard(listing, index, localeStrings)
    );
  }

  async getLatestListings(
    limit?: number,
    sort: ListingSort = ListingSort.RECENT,
    sellerType?: SellerTypeFilter,
    locale: HomeLocale = 'fr'
  ): Promise<HomeListingCard[]> {
    const take = limit && limit > 0 ? limit : 10;
    const listings = await this.listingsService.getLatest(
      take,
      sort,
      sellerType
    );
    const localeStrings = getHomeTranslations(locale);
    return listings.map((listing, index) =>
      this.mapListingCard(listing, index, localeStrings)
    );
  }

  getServices(locale: HomeLocale = 'fr'): HomeServiceCard[] {
    return getHomeTranslations(locale).services;
  }

  private async buildHero(
    categories: Category[],
    localeStrings: HomeLocaleStrings
  ): Promise<HomeHero> {
    const [publishedCount, featuredCount, proCount, popularCategories] =
      await Promise.all([
        this.listingsService.countPublished(),
        this.listingsService.countFeatured(),
        this.usersService.countActivePros(),
        this.listingsService.getPopularCategories(5)
      ]);

    const tags =
      popularCategories.length > 0
        ? popularCategories.map(category => category.name)
        : categories.slice(0, 5).map(category => category.name);

    const heroStrings = localeStrings.hero;

    return {
      eyebrow: heroStrings.eyebrow,
      title: heroStrings.title,
      subtitle: heroStrings.subtitle,
      tags,
      stats: [
        {
          label: heroStrings.stats.activeListings.label,
          value: publishedCount.toString(),
          detail:
            featuredCount > 0
              ? interpolateTemplate(
                  heroStrings.stats.activeListings.detailWithFeatured,
                  { count: featuredCount }
                )
              : heroStrings.stats.activeListings.detailDefault
        },
        {
          label: heroStrings.stats.categories.label,
          value: categories.length.toString(),
          detail:
            tags.length > 0
              ? interpolateTemplate(
                  heroStrings.stats.categories.detailWithExamples,
                  { examples: tags.slice(0, 3).join(', ') }
                )
              : undefined
        },
        {
          label: heroStrings.stats.proSellers.label,
          value: proCount.toString(),
          detail:
            proCount > 0
              ? heroStrings.stats.proSellers.detailWithPros
              : heroStrings.stats.proSellers.detailFallback
        }
      ]
    };
  }

  async getSellerSplit(): Promise<HomeSellerSplit> {
    const { proListings, individualListings } =
      await this.listingsService.countBySellerType();
    const total = proListings + individualListings;
    const computeShare = (value: number) =>
      total ? Math.round((value / total) * 1000) / 10 : 0;

    return {
      proListings,
      individualListings,
      proShare: computeShare(proListings),
      individualShare: computeShare(individualListings)
    };
  }

  async getListingCollections(
    featuredSort?: ListingSort,
    latestSort?: ListingSort,
    sellerType?: SellerTypeFilter,
    locale: HomeLocale = 'fr'
  ): Promise<{ featured: HomeListingCard[]; latest: HomeListingCard[] }> {
    const [featured, latest] = await Promise.all([
      this.getFeaturedListings(undefined, featuredSort, sellerType, locale),
      this.getLatestListings(undefined, latestSort, sellerType, locale)
    ]);

    return {
      featured,
      latest
    };
  }

  async getTestimonials(locale: HomeLocale = 'fr'): Promise<HomeTestimonial[]> {
    const fallback = getHomeTranslations(locale).testimonials;

    const reviews = await this.reviewRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      .where('review.status = :status', { status: ReviewStatus.APPROVED })
      .andWhere('review.isTestimonial = true')
      .andWhere("COALESCE(TRIM(review.comment), '') <> ''")
      .orderBy('review.created_at', 'DESC')
      .limit(30)
      .getMany()
      .catch(() => []);

    if (!reviews.length) {
      return fallback;
    }

    const testimonials: HomeTestimonial[] = [];
    const seenReviewers = new Set<string>();

    for (const review of reviews) {
      const reviewerId = review.reviewerId;
      if (reviewerId && seenReviewers.has(reviewerId)) {
        continue;
      }

      const quote = review.comment?.trim();
      if (!quote || quote.length < 10) {
        continue;
      }

      const reviewer = review.reviewer;
      const authorName = reviewer
        ? `${reviewer.firstName ?? ''} ${reviewer.lastName ?? ''}`.trim()
        : '';

      testimonials.push({
        id: review.id,
        quote,
        author: authorName || 'Utilisateur',
        location: review.location ?? reviewer?.location ?? null,
        avatarUrl: reviewer?.avatarUrl ?? null
      });

      if (reviewerId) {
        seenReviewers.add(reviewerId);
      }
      if (testimonials.length >= 6) {
        break;
      }
    }

    return testimonials.length ? testimonials : fallback;
  }

  async getTrendingSearches(_locale: HomeLocale = 'fr'): Promise<HomeTrendingSearch[]> {
    const loggedTrends = await this.searchLogsService.getTrendingSearches().catch(() => []);
    return loggedTrends;
  }

  async getStorefronts(limit = 6): Promise<HomeStorefrontCard[]> {
    const take = limit > 0 ? limit : 6;
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.isActive = true')
      .andWhere('user.isPro = true')
      .andWhere('user.storefrontSlug IS NOT NULL')
      .andWhere("TRIM(user.storefrontSlug) <> ''")
      .addSelect(
        subQuery =>
          subQuery
            .select('COUNT(listing.id)')
            .from(Listing, 'listing')
            .where('listing.owner_id = user.id')
            .andWhere('listing.status = :listingStatus', {
              listingStatus: ListingStatus.PUBLISHED
            }),
        'listingCount'
      )
      .addSelect(
        subQuery =>
          subQuery
            .select('AVG(review.rating)')
            .from(Review, 'review')
            .where('review.seller_id = user.id')
            .andWhere('review.status = :reviewStatus', {
              reviewStatus: ReviewStatus.APPROVED
            }),
        'averageRating'
      )
      .addSelect(
        subQuery =>
          subQuery
            .select('COUNT(review.id)')
            .from(Review, 'review')
            .where('review.seller_id = user.id')
            .andWhere('review.status = :reviewStatus', {
              reviewStatus: ReviewStatus.APPROVED
            }),
        'totalReviews'
      )
      .orderBy('"listingCount"', 'DESC')
      .addOrderBy('user.created_at', 'DESC')
      .limit(take);

    const { entities, raw } = await query.getRawAndEntities();

    return entities.map((user, index) => {
      const rawRow = raw[index] ?? {};
      const listingCount = Number(rawRow.listingCount ?? 0);
      const averageRating = Number(rawRow.averageRating ?? 0);
      const totalReviews = Number(rawRow.totalReviews ?? 0);
      const nameFallback = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      const storefrontName =
        user.companyName?.trim() || nameFallback || 'Boutique';

      return {
        id: user.id,
        slug: user.storefrontSlug ?? '',
        name: storefrontName,
        tagline: user.storefrontTagline ?? null,
        location: user.location ?? null,
        avatarUrl: user.avatarUrl ?? null,
        heroUrl: user.storefrontHeroUrl ?? null,
        listingCount: Number.isFinite(listingCount) ? listingCount : 0,
        averageRating: Number.isFinite(averageRating) ? averageRating : 0,
        totalReviews: Number.isFinite(totalReviews) ? totalReviews : 0,
        isVerified: Boolean(user.isVerified),
        isCompanyVerified: user.companyVerificationStatus === 'approved'
      };
    });
  }

  private async buildCategoryCards(
    categories: Category[]
  ): Promise<HomeCategoryCard[]> {
    const popular = await this.listingsService.getPopularCategories(
      categories.length || 5
    );

    const countById = new Map<string, number>();
    popular.forEach(category => {
      countById.set(category.id, category.listingCount);
    });

    const childrenByParent = new Map<string, string[]>();
    categories.forEach(category => {
      const parentId = category.parent?.id ?? null;
      if (!parentId) {
        return;
      }
      const bucket = childrenByParent.get(parentId);
      if (bucket) {
        bucket.push(category.id);
      } else {
        childrenByParent.set(parentId, [category.id]);
      }
    });

    const aggregatedCounts = new Map<string, number>();
    const getAggregateCount = (categoryId: string): number => {
      const cached = aggregatedCounts.get(categoryId);
      if (cached !== undefined) {
        return cached;
      }
      const ownCount = countById.get(categoryId) ?? 0;
      const children = childrenByParent.get(categoryId) ?? [];
      const total =
        ownCount +
        children.reduce((sum, childId) => sum + getAggregateCount(childId), 0);
      aggregatedCounts.set(categoryId, total);
      return total;
    };

    return categories.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
      icon: category.icon ?? null,
      color: category.color ?? null,
      gradient: category.gradient ?? null,
      parentId: category.parent?.id ?? null,
      listingCount: getAggregateCount(category.id),
      children:
        category.children?.map(child => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          parentId: category.id
        })) ?? []
    }));
  }

  private mapListingCard(
    listing: Listing,
    index: number,
    localeStrings: HomeLocaleStrings
  ): HomeListingCard {
    const cover =
      listing.images?.find(image => image.isCover) ??
      listing.images?.[0] ??
      null;

    return {
      id: listing.id,
      title: listing.title,
      price: String(listing.price ?? ''),
      currency: listing.currency,
      city: (listing.location as any)?.city ?? '',
      location:
        (listing.location as any)?.address ??
        (listing.location as any)?.city ??
        '',
      tag: null,
      ribbon: this.resolveRibbon(listing, index, localeStrings.ribbons),
      category: listing.category
        ? {
            id: listing.category.id,
            name: listing.category.name,
            slug: listing.category.slug
          }
        : null,
      coverImage: cover?.url ?? null,
      owner: listing.owner
        ? {
            id: listing.owner.id,
            name: listing.owner.firstName,
            avatarUrl: listing.owner.avatarUrl ?? null,
            isPro: listing.owner.isPro,
            isCompanyVerified:
              listing.owner.companyVerificationStatus ===
              CompanyVerificationStatus.APPROVED
          }
        : null,
      publishedAt: listing.publishedAt
        ? listing.publishedAt.toISOString()
        : null,
      isFeatured: listing.isFeatured,
      isBoosted: listing.isBoosted
    };
  }

  private resolveRibbon(
    listing: Listing,
    index: number,
    ribbons: HomeLocaleStrings['ribbons']
  ): string {
    if (listing.isBoosted) {
      return ribbons.boosted;
    }

    if (listing.owner?.isPro) {
      return ribbons.pro;
    }

    return index === 0 ? ribbons.featured : ribbons.recommended;
  }
}
