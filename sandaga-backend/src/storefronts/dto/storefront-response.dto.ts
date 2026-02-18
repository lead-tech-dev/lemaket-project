import { IdentityVerificationStatus } from '../../users/enums/identity-verification-status.enum';

export type StorefrontCategorySummaryDto = {
  id: string;
  name: string;
  slug: string;
  count: number;
};

export type StorefrontStatsDto = {
  listingCount: number;
  averageRating: number;
  totalReviews: number;
};

export type StorefrontResponseDto = {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  heroUrl?: string | null;
  theme?: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  website?: string | null;
  companyId?: string | null;
  phoneNumber?: string | null;
  isPro: boolean;
  isVerified: boolean;
  isCompanyVerified: boolean;
  identityStatus: IdentityVerificationStatus;
  storefrontShowReviews: boolean;
  followersCount: number;
  isFollowed?: boolean;
  stats: StorefrontStatsDto;
  categories: StorefrontCategorySummaryDto[];
};
