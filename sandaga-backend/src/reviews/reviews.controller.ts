import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateUserReviewDto } from './dto/create-user-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('sellers/:sellerId')
  getSellerReviews(
    @Param('sellerId') sellerId: string,
    @Query('limit') limit?: string
  ) {
    const parsedLimit = limit ? Number(limit) : NaN;
    const resolvedLimit =
      Number.isFinite(parsedLimit) && parsedLimit
        ? Math.min(Math.max(parsedLimit, 1), 20)
        : 6;
    return this.reviewsService.getSellerReviews(sellerId, resolvedLimit);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createReview(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto
  ) {
    return this.reviewsService.createReview(user.id, dto);
  }

  @Post('users')
  @UseGuards(JwtAuthGuard)
  createUserReview(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateUserReviewDto
  ) {
    return this.reviewsService.createUserReview(user.id, dto);
  }
}
