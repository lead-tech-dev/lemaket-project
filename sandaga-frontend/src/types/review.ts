export type ReviewAuthor = {
  id: string
  name: string
  avatarUrl?: string | null
}

export type Review = {
  id: string
  rating: number
  comment: string
  location?: string | null
  createdAt: string
  reviewer: ReviewAuthor
}

export type ReviewSummary = {
  averageRating: number
  totalReviews: number
  positiveCount: number
  negativeCount: number
  successfulSales: number
}

export type SellerReviewsResponse = {
  items: Review[]
  summary: ReviewSummary
}
