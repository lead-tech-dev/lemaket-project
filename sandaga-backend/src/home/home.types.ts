export type HomeHeroStat = {
  label: string;
  value: string;
  detail?: string;
};

export type HomeHero = {
  eyebrow: string;
  title: string;
  subtitle: string;
  tags: string[];
  stats: HomeHeroStat[];
};

export type HomeCategoryCard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  gradient: string | null;
  parentId: string | null;
  listingCount: number;
  children: Array<{
    id: string;
    name: string;
    slug: string;
    parentId?: string | null;
  }>;
};

export type HomeListingCard = {
  id: string;
  title: string;
  price: string;
  currency: string;
  city: string;
  location: string;
  tag: string | null;
  ribbon: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  coverImage: string | null;
  owner: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isPro: boolean;
    isCompanyVerified: boolean;
  } | null;
  publishedAt: string | null;
  isFeatured: boolean;
  isBoosted: boolean;
};

export type HomeServiceCard = {
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
};

export type HomeSellerSplit = {
  proListings: number;
  individualListings: number;
  proShare: number;
  individualShare: number;
};

export type HomeTestimonial = {
  id: string;
  quote: string;
  author: string;
  location?: string | null;
  avatarUrl?: string | null;
};

export type HomeTrendingSearch = {
  id: string;
  label: string;
  query: string;
  resultCount: number;
};

export type HomeStorefrontCard = {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  location?: string | null;
  avatarUrl?: string | null;
  heroUrl?: string | null;
  listingCount: number;
  averageRating: number;
  totalReviews: number;
  isVerified: boolean;
  isCompanyVerified: boolean;
};
