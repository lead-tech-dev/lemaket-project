export type ListingContactDTO = {
  email?: string | null;
  phone?: string | null;
  phoneHidden?: boolean;
  noSalesmen?: boolean;
};

export type ListingLocationDTO = {
  address?: string | null;
  city?: string | null;
  zipcode?: string | null;
  lat?: number | null;
  lng?: number | null;
  label?: string | null;
  hideExact?: boolean;
};

export type ListingImageDTO = {
  id?: string;
  url: string;
  position?: number;
  isCover?: boolean;
};

export type ListingCategoryDTO = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  gradient?: string | null;
  parentId?: string | null;
};

export type ListingOwnerDTO = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  isPro?: boolean;
  isCompanyVerified?: boolean;
  listingCount?: number;
};

export type ListingPriceDTO = {
  amount: number;
  currency: string;
  newItemPrice?: number | null;
};

export type ListingResponseDTO = {
  id: string;
  title: string;
  description: string;
  price: string;
  priceDetails: ListingPriceDTO;
  currency: string;
  flow: 'sell' | 'buy' | 'let' | 'rent' | null;
  status: string;
  location: ListingLocationDTO;
  contact: ListingContactDTO;
  category: ListingCategoryDTO;
  owner?: ListingOwnerDTO;
  images: ListingImageDTO[];
  attributes: Record<string, unknown>;
  meta?: Record<string, unknown>;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  created_at: Date;
  updatedAt: Date;
};
