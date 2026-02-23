import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { Conversation } from '../messages/conversation.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateUserReviewDto } from './dto/create-user-review.dto';
import {
  ReviewResponseDto,
  SellerReviewsResponseDto
} from './dto/review-response.dto';
import { ReviewStatus } from '../common/enums/review-status.enum';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Listing) private readonly listingRepository: Repository<Listing>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>
  ) {}

  async createReview(reviewerId: string, dto: CreateReviewDto): Promise<ReviewResponseDto> {
    const listing = await this.listingRepository.findOne({
      where: { id: dto.listingId },
      relations: ['owner']
    });

    if (!listing) {
      throw new NotFoundException("L'annonce n'existe pas.");
    }

    if (!listing.owner?.id) {
      throw new BadRequestException("Impossible d'identifier le vendeur.");
    }

    if (listing.owner.id === reviewerId) {
      throw new BadRequestException("Vous ne pouvez pas évaluer votre propre annonce.");
    }

    const conversation = await this.conversationRepository.findOne({
      where: {
        listingId: listing.id,
        buyerId: reviewerId,
        sellerId: listing.owner.id
      }
    });

    if (!conversation) {
      throw new BadRequestException(
        "Vous devez échanger avec le vendeur avant de laisser un avis."
      );
    }

    const existing = await this.reviewRepository.findOne({
      where: { listingId: dto.listingId, reviewerId }
    });

    if (existing) {
      throw new BadRequestException("Vous avez déjà laissé un avis pour cette annonce.");
    }

    const reviewer = await this.userRepository.findOne({ where: { id: reviewerId } });
    if (!reviewer) {
      throw new NotFoundException("Utilisateur introuvable.");
    }

    const comment = dto.comment?.trim() ?? '';
    const review = this.reviewRepository.create({
      listingId: listing.id,
      sellerId: listing.owner.id,
      reviewerId,
      rating: dto.rating,
      comment,
      location: dto.location?.trim() || null,
      isTestimonial: dto.isTestimonial ?? false,
      status: ReviewStatus.APPROVED
    });

    const saved = await this.reviewRepository.save(review);

    return this.toReviewResponse(saved, reviewer);
  }

  async getSellerReviews(
    sellerId: string,
    limit = 6
  ): Promise<SellerReviewsResponseDto> {
    const reviews = await this.reviewRepository.find({
      where: { sellerId, status: ReviewStatus.APPROVED },
      relations: ['reviewer'],
      order: { created_at: 'DESC' },
      take: limit
    });

    const summary = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(review.id)', 'count')
      .addSelect("SUM(CASE WHEN review.rating >= 4 THEN 1 ELSE 0 END)", 'positive')
      .addSelect("SUM(CASE WHEN review.rating <= 2 THEN 1 ELSE 0 END)", 'negative')
      .where('review.seller_id = :sellerId', { sellerId })
      .andWhere('review.status = :status', { status: ReviewStatus.APPROVED })
      .getRawOne<{
        average: string | null;
        count: string | null;
        positive: string | null;
        negative: string | null;
      }>();

    const averageRating = summary?.average ? Number(summary.average) : 0;
    const totalReviews = summary?.count ? Number(summary.count) : 0;
    const positiveCount = summary?.positive ? Number(summary.positive) : 0;
    const negativeCount = summary?.negative ? Number(summary.negative) : 0;
    // MVP: use review count as a proxy for successful sales.
    const successfulSales = totalReviews;

    return {
      items: reviews.map(review => this.toReviewResponse(review, review.reviewer)),
      summary: {
        averageRating: Number.isFinite(averageRating) ? averageRating : 0,
        totalReviews: Number.isFinite(totalReviews) ? totalReviews : 0,
        positiveCount: Number.isFinite(positiveCount) ? positiveCount : 0,
        negativeCount: Number.isFinite(negativeCount) ? negativeCount : 0,
        successfulSales: Number.isFinite(successfulSales) ? successfulSales : 0
      }
    };
  }

  async createUserReview(
    reviewerId: string,
    dto: CreateUserReviewDto
  ): Promise<ReviewResponseDto> {
    if (reviewerId === dto.sellerId) {
      throw new BadRequestException("Vous ne pouvez pas vous évaluer vous-même.");
    }

    const seller = await this.userRepository.findOne({
      where: { id: dto.sellerId, isActive: true }
    });
    if (!seller) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const existing = await this.reviewRepository.findOne({
      where: {
        sellerId: dto.sellerId,
        reviewerId,
        listingId: null
      }
    });
    if (existing) {
      throw new BadRequestException('Vous avez déjà laissé un avis pour cet utilisateur.');
    }

    const reviewer = await this.userRepository.findOne({ where: { id: reviewerId } });
    if (!reviewer) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const comment = dto.comment?.trim() ?? '';
    const review = this.reviewRepository.create({
      sellerId: dto.sellerId,
      reviewerId,
      rating: dto.rating,
      comment,
      location: dto.location?.trim() || null,
      isTestimonial: dto.isTestimonial ?? false,
      status: ReviewStatus.APPROVED
    });

    const saved = await this.reviewRepository.save(review);
    return this.toReviewResponse(saved, reviewer);
  }

  private toReviewResponse(review: Review, reviewer?: User): ReviewResponseDto {
    const fallbackReviewer: User | undefined = reviewer;
    const reviewerName = fallbackReviewer
      ? `${fallbackReviewer.firstName} ${fallbackReviewer.lastName}`.trim()
      : 'Utilisateur';

    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      location: review.location ?? null,
      createdAt: review.created_at?.toISOString?.() ?? new Date().toISOString(),
      reviewer: {
        id: review.reviewerId,
        name: reviewerName || 'Utilisateur',
        avatarUrl: fallbackReviewer?.avatarUrl ?? null
      }
    };
  }
}
