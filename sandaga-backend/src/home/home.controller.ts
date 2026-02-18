import { Controller, Get, Headers, Query } from '@nestjs/common';
import { HomeService } from './home.service';
import {
  ListingSort,
  SellerTypeFilter
} from '../listings/dto/filter-listings.dto';
import { resolvePreferredHomeLocale } from './home.translations';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  getHome(
    @Query('featuredSort') featuredSort?: string,
    @Query('latestSort') latestSort?: string,
    @Query('sellerType') sellerType?: string,
    @Query('locale') locale?: string,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    const resolvedLocale = this.resolveLocale(locale, acceptLanguage);
    return this.homeService.getHome(
      this.parseSort(featuredSort),
      this.parseSort(latestSort),
      this.parseSellerType(sellerType),
      resolvedLocale
    );
  }

  @Get('hero')
  getHero(
    @Query('locale') locale?: string,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    return this.homeService.getHero(this.resolveLocale(locale, acceptLanguage));
  }

  @Get('categories')
  getCategories() {
    return this.homeService.getCategories();
  }

  @Get('services')
  getServices(
    @Query('locale') locale?: string,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    return this.homeService.getServices(
      this.resolveLocale(locale, acceptLanguage)
    );
  }

  @Get('listings')
  getListings(
    @Query('featuredSort') featuredSort?: string,
    @Query('latestSort') latestSort?: string,
    @Query('sellerType') sellerType?: string,
    @Query('locale') locale?: string,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    const resolvedLocale = this.resolveLocale(locale, acceptLanguage);
    return this.homeService.getListingCollections(
      this.parseSort(featuredSort),
      this.parseSort(latestSort),
      this.parseSellerType(sellerType),
      resolvedLocale
    );
  }

  @Get('listings/featured')
  getFeaturedListings(
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('sellerType') sellerType?: string,
    @Query('locale') locale?: string,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    return this.homeService.getFeaturedListings(
      this.parsePositiveInteger(limit),
      this.parseSort(sort),
      this.parseSellerType(sellerType),
      this.resolveLocale(locale, acceptLanguage)
    );
  }

  @Get('listings/latest')
  getLatestListings(
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('sellerType') sellerType?: string,
    @Query('locale') locale?: string,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    return this.homeService.getLatestListings(
      this.parsePositiveInteger(limit),
      this.parseSort(sort),
      this.parseSellerType(sellerType),
      this.resolveLocale(locale, acceptLanguage)
    );
  }

  @Get('seller-split')
  getSellerSplit() {
    return this.homeService.getSellerSplit();
  }

  @Get('testimonials')
  getTestimonials(
    @Query('locale') locale?: string,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    return this.homeService.getTestimonials(
      this.resolveLocale(locale, acceptLanguage)
    );
  }

  @Get('trending-searches')
  getTrendingSearches(
    @Query('locale') locale?: string,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    return this.homeService.getTrendingSearches(
      this.resolveLocale(locale, acceptLanguage)
    );
  }

  @Get('storefronts')
  getStorefronts(@Query('limit') limit?: string) {
    return this.homeService.getStorefronts(this.parsePositiveInteger(limit));
  }

  private parsePositiveInteger(value?: string): number | undefined {
    if (!value?.trim()) {
      return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return undefined;
    }

    return parsed;
  }

  private parseSort(value?: string): ListingSort | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    const match = (Object.values(ListingSort) as string[]).find(
      option => option.toLowerCase() === normalized
    );
    return match as ListingSort | undefined;
  }

  private parseSellerType(value?: string): SellerTypeFilter | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    const match = (Object.values(SellerTypeFilter) as string[]).find(
      option => option.toLowerCase() === normalized
    );
    return match as SellerTypeFilter | undefined;
  }

  private resolveLocale(
    locale?: string,
    acceptLanguage?: string
  ) {
    return resolvePreferredHomeLocale(locale, acceptLanguage);
  }
}
