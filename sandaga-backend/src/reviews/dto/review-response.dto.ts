export type ReviewAuthorDto = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type ReviewResponseDto = {
  id: string;
  rating: number;
  comment: string;
  location?: string | null;
  createdAt: string;
  reviewer: ReviewAuthorDto;
};

export type ReviewSummaryDto = {
  averageRating: number;
  totalReviews: number;
  positiveCount: number;
  negativeCount: number;
  successfulSales: number;
};

export type SellerReviewsResponseDto = {
  items: ReviewResponseDto[];
  summary: ReviewSummaryDto;
};
