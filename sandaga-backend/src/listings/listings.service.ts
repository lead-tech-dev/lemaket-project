import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { Category } from '../categories/category.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  FilterListingsDto,
  ListingSort,
  SellerTypeFilter
} from './dto/filter-listings.dto';
import { CategoriesService } from '../categories/categories.service';
import { UsersService } from '../users/users.service';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { getListingFormSchemaForCategory } from './form-schemas/listing-form-schemas';
import { ListingFormSchema } from './form-schemas/listing-form-schema.type';
import { FormStep } from '../forms/entities/form-step.entity';
import { FormSchemaDTO } from './dto/form-schema.dto';
import { ListingResponseDTO } from './dto/listing-response.dto';
import { PriceSuggestionQueryDto } from './dto/price-suggestion-query.dto';
import { ListingPdfDto } from './dto/listing-pdf.dto';
import PDFDocument from 'pdfkit';
import { SearchLogsService, SearchSynonymsMap } from '../search-logs/search-logs.service';
import { SearchRelevanceSettingsService } from '../search-logs/search-relevance-settings.service';
import { CompanyVerificationStatus } from '../users/enums/company-verification-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { GeoService } from '../geo/geo.service';
import { PromotionsService } from '../promotions/promotions.service';
import { MonitoringMetricsService } from '../monitoring/monitoring.metrics.service';

const FREE_LISTINGS_LIMIT = Number(process.env.FREE_LISTINGS_LIMIT ?? 5);
const MAX_FREE_LISTINGS = Number.isFinite(FREE_LISTINGS_LIMIT)
  ? Math.max(0, FREE_LISTINGS_LIMIT)
  : 5;
const MAX_LISTINGS_PAGE_SIZE = 100;
const SEARCH_SYNONYMS: Record<string, string[]> = {
  voiture: ['automobile', 'auto', 'vehicule', 'véhicule', 'car'],
  auto: ['automobile', 'voiture', 'vehicule', 'véhicule', 'car'],
  appartement: ['appart', 'flat', 'logement'],
  maison: ['villa', 'habitation', 'domicile'],
  telephone: ['téléphone', 'smartphone', 'mobile', 'tel', 'tél'],
  smartphone: ['telephone', 'téléphone', 'mobile'],
  ordinateur: ['pc', 'laptop', 'computer'],
  emploi: ['job', 'travail', 'poste'],
  moto: ['motocyclette', 'scooter', 'motorbike'],
  location: ['louer', 'locatif', 'rent'],
  louer: ['location', 'locatif', 'rent']
};
const SEARCH_STOP_WORDS = new Set([
  'a',
  'au',
  'aux',
  'avec',
  'ce',
  'ces',
  'dans',
  'de',
  'des',
  'du',
  'en',
  'et',
  'la',
  'le',
  'les',
  'ou',
  'par',
  'pour',
  'sur',
  'the',
  'un',
  'une'
]);

type ParsedSearchQuery = {
  includeTerms: string[];
  excludeTerms: string[];
  includePhrases: string[];
  excludePhrases: string[];
};

type SearchBusinessRankConfig = {
  popularCityBoost: number;
  proSellerBoost: number;
  categoryPriorityWeights: Record<string, number>;
};

type ListingsSearchMeta = {
  appliedFilters: Record<string, unknown>;
  warnings?: string[];
};

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    @InjectRepository(ListingImage)
    private readonly listingImagesRepository: Repository<ListingImage>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(FormStep)
    private readonly formStepRepository: Repository<FormStep>,
    private readonly categoriesService: CategoriesService,
    private readonly usersService: UsersService,
    private readonly searchLogsService: SearchLogsService,
    private readonly searchRelevanceSettingsService: SearchRelevanceSettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly geoService: GeoService,
    private readonly promotionsService: PromotionsService,
    private readonly monitoringMetricsService: MonitoringMetricsService
  ) {}

  async findPublicForOg(id: string): Promise<Listing> {
    const listing = await this.listingsRepository.findOne({
      where: { id },
      relations: ['images', 'category', 'owner']
    });
    if (!listing) {
      throw new NotFoundException('Annonce introuvable');
    }
    return listing;
  }

  async create(
    createListingDto: CreateListingDto,
    requester: AuthUser
  ): Promise<ListingResponseDTO> {
    const category = await this.categoriesService.findOne(
      createListingDto.subCategoryId ?? createListingDto.categoryId
    );
    const owner = createListingDto.ownerId
      ? await this.usersService.findOne(createListingDto.ownerId)
      : await this.usersService.findOne(requester.id);

    if (
      !owner.isPro &&
      owner.role !== UserRole.ADMIN &&
      owner.role !== UserRole.MODERATOR &&
      MAX_FREE_LISTINGS > 0
    ) {
      const activeCount = await this.listingsRepository.count({
        where: {
          owner: { id: owner.id },
          status: In([
            ListingStatus.DRAFT,
            ListingStatus.PENDING,
            ListingStatus.PUBLISHED,
            ListingStatus.REJECTED
          ])
        }
      });

      if (activeCount >= MAX_FREE_LISTINGS) {
        throw new ForbiddenException(
          'Limite d’annonces atteinte. Passez au compte Pro pour publier plus d’annonces.'
        );
      }
    }

    const priceAmount = createListingDto.price?.amount ?? 0;
    const currency = createListingDto.price?.currency ?? 'XAF';
    const newItemPrice =
      typeof createListingDto.price?.newItemPrice === 'number'
        ? createListingDto.price.newItemPrice
        : undefined;

    const locationDto = createListingDto.location ?? {};
    const contactDto = createListingDto.contact ?? {};
    const attributes = createListingDto.attributes ?? {};
    const resolvedGeoSelection = await this.geoService.resolveSelection(
      locationDto.cityId,
      locationDto.neighborhoodId
    );

      const locationString =
        locationDto.address ||
        locationDto.city ||
        locationDto.zipcode ||
        '';

    const mergedDetails: Record<string, unknown> = {
      ...attributes,
      _contact: {
        email: contactDto.email,
        phone: contactDto.phone,
        phoneHidden: contactDto.phoneHidden ?? false,
        noSalesmen: contactDto.noSalesmen ?? false
      },
      _geo: {
        lat: locationDto.lat,
        lng: locationDto.lng,
        address: locationDto.address,
        city: locationDto.city,
        zipcode: locationDto.zipcode,
        cityId: resolvedGeoSelection.cityId,
        neighborhoodId: resolvedGeoSelection.neighborhoodId
      },
      _meta: createListingDto.meta ?? {}
    };

    if ((locationDto.address || locationDto.city || locationDto.zipcode) &&
      (locationDto.lat === undefined || locationDto.lng === undefined)) {
      throw new BadRequestException('Latitude et longitude sont requises pour une adresse.');
    }

    const listing = this.listingsRepository.create({
      title: createListingDto.title,
      description: createListingDto.description,
      price: Number(priceAmount),
      currency,
      location: {
        ...locationDto,
        cityId: resolvedGeoSelection.cityId,
        neighborhoodId: resolvedGeoSelection.neighborhoodId,
        address: locationDto.address ?? (locationString || undefined),
        hideExact: locationDto.hideExact ?? false
      },
      cityId: resolvedGeoSelection.cityId ?? null,
      neighborhoodId: resolvedGeoSelection.neighborhoodId ?? null,
      contact: {
        email: contactDto.email,
        phone: contactDto.phone,
        phoneHidden: contactDto.phoneHidden ?? false,
        noSalesmen: contactDto.noSalesmen ?? false
      },
      formData: mergedDetails,
      status: ListingStatus.PENDING,
      flow:
        typeof createListingDto.adType === 'string' && createListingDto.adType.trim()
          ? (createListingDto.adType.trim().toUpperCase() as any)
          : undefined,
      category,
      owner
    });

    if (listing.status === ListingStatus.PUBLISHED) {
      listing.publishedAt = new Date();
    }

    const savedListing = await this.listingsRepository.save(listing);

    // Attach images if provided
    if (createListingDto.images && createListingDto.images.length) {
      const hasCover = createListingDto.images.some(img => img.isCover);
      const imagesToSave = createListingDto.images
        .slice(0, 8)
        .map((img, index) =>
          this.listingImagesRepository.create({
            url: img.url,
            position: img.position ?? index,
            isCover: hasCover ? Boolean(img.isCover) : index === 0,
            listingId: savedListing.id
          })
        );
      await this.listingImagesRepository.save(imagesToSave);
      savedListing.images = imagesToSave;
    } else {
      savedListing.images = [];
    }

    return this.mapListingToDto(savedListing, requester);
  }

  async getFormSchema(categoryId: string): Promise<FormSchemaDTO | ListingFormSchema> {
    const category = await this.categoriesService.findOne(categoryId);
    const extractAdTypes = (raw: unknown) => {
      const parseMaybeJson = (value: unknown) => {
        if (typeof value !== 'string') return value;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      };

      const parsedRaw = parseMaybeJson(raw);
      let adTypes =
        parsedRaw && typeof parsedRaw === 'object' && !Array.isArray(parsedRaw)
          ? (parsedRaw as any).ad_types ?? (parsedRaw as any).adTypes ?? null
          : null;

      if (!adTypes && Array.isArray(parsedRaw)) {
        for (const entry of parsedRaw) {
          if (!entry) continue;
          const parsedEntry = parseMaybeJson(entry);
          if (parsedEntry && typeof parsedEntry === 'object' && 'ad_types' in parsedEntry) {
            adTypes = (parsedEntry as any).ad_types;
            break;
          }
        }
      }

      const parsedAdTypes = parseMaybeJson(adTypes);
      return parsedAdTypes && typeof parsedAdTypes === 'object' && !Array.isArray(parsedAdTypes)
        ? (parsedAdTypes as Record<string, { label?: string; description?: string }>)
        : undefined;
    };

    const adTypes = extractAdTypes((category as any).extraFields);

    const steps = await this.formStepRepository.find({
      where: { category: { id: category.id } },
      relations: { fields: true },
      order: { order: 'ASC', created_at: 'ASC' }
    });

    if (steps.length) {
      const mapOptions = (value: any): Array<{ value: string; label: string }> | undefined => {
        if (!value) return undefined;

        // Already an array of options
        if (Array.isArray(value)) {
          return value.map((option: any) => {
            const optionValue = option?.value ?? option?.id ?? option?.key ?? option?.name ?? '';
            const rawLabel = option?.label ?? option?.name ?? optionValue;
            const label =
              typeof rawLabel === 'string'
                ? rawLabel
                : rawLabel && typeof rawLabel === 'object'
                ? JSON.stringify(rawLabel)
                : String(optionValue);

          return {
              value: String(optionValue),
              label: label
            };
          });
        }

        // Structures like { values: [...] }
        if (typeof value === 'object' && Array.isArray((value as any).values)) {
          return mapOptions((value as any).values);
        }

        // Structures like { grouped_values: { ...arrays... } }
        if (typeof value === 'object' && (value as any).grouped_values) {
          const grouped = (value as any).grouped_values;
          const collected: Array<{ value: string; label: string }> = [];
          Object.values(grouped as Record<string, any>).forEach(group => {
            const opts = mapOptions(group);
            if (opts) {
              collected.push(...opts);
            }
          });
          return collected.length ? collected : undefined;
        }

        // Map-like { key: "Label" }
        if (typeof value === 'object') {
          return Object.entries(value as Record<string, any>).map(([key, val]) => ({
            value: String(key),
            label:
              typeof val === 'string'
                ? val
                : val && typeof val === 'object'
                ? JSON.stringify(val)
                : String(val ?? key)
          }));
        }

        return undefined;
      };

      const resolveNumber = (v: unknown) =>
        typeof v === 'number' && Number.isFinite(v) ? v : undefined;

      const isFieldEnabled = (field: Record<string, unknown>): boolean => {
        if (field.disabled === true) return false;
        if (field.active === false) return false;
        if (field.isActive === false) return false;
        return true;
      };

      const mappedSteps = steps
        .map(step => {
          const fields = (step.fields ?? [])
            .filter(field => isFieldEnabled(field as unknown as Record<string, unknown>))
            .map(field => {
          const rules = (field.rules ?? {}) as Record<string, unknown>;
          const info = (field.info ?? {}) as Record<string, unknown>;
          const rawValues = field.values ?? (field.rules as any)?.options;

          // Conditional options
          let dependsOn: string | undefined;
          let conditionalOptions: Record<string, Array<{ value: string; label: string }>> | undefined;
          if (rawValues && typeof rawValues === 'object' && 'conditional_values' in (rawValues as any)) {
            dependsOn = (rawValues as any).depends_on;
            conditionalOptions = Object.entries((rawValues as any).conditional_values || {}).reduce(
              (acc, [key, val]) => {
                const opts = mapOptions(val);
                if (opts && opts.length) {
                  acc[key] = opts;
                }
                return acc;
              },
              {} as Record<string, Array<{ value: string; label: string }>>
            );
          }

          const options = conditionalOptions ? undefined : mapOptions(rawValues);

            return {
              id: field.id,
              name: field.name,
              label: field.label,
              type: (field.type as any) ?? 'text',
              unit: field.unit ?? undefined,
              info: Array.isArray(field.info) ? (field.info as string[]) : undefined,
              rules: {
                mandatory: typeof rules.mandatory === 'boolean' ? rules.mandatory : undefined,
                max_length: resolveNumber(rules.max_length),
                min_length: resolveNumber(rules.min_length),
                min: resolveNumber(rules.min),
                max: resolveNumber(rules.max),
                regexp: typeof rules.regexp === 'string' ? rules.regexp : undefined,
                err_mandatory: typeof rules.err_mandatory === 'string' ? rules.err_mandatory : undefined,
                err_regexp: typeof rules.err_regexp === 'string' ? rules.err_regexp : undefined
              },
              options,
              conditionalOptions,
              dependsOn,
              ui: {
                placeholder:
                  typeof rules.placeholder === 'string'
                    ? rules.placeholder
                    : typeof info.placeholder === 'string'
                    ? (info.placeholder as string)
                    : undefined
              }
            };
          });

          return {
            id: step.id,
            name: step.name,
            label: step.label,
            order: step.order ?? 0,
            info: Array.isArray(step.info) ? (step.info as string[]) : undefined,
            flow: step.flow ?? null,
            fields
          };
        })
        .filter(step => step.fields.length > 0);

      const dto: FormSchemaDTO = {
        categoryId: category.id,
        subCategoryId: category.id,
        flow: null,
        adTypes,
        steps: mappedSteps
      };

      return dto;
    }

    // Fallback statique si aucun formulaire configuré, converti au format DTO minimal
    const fallback = getListingFormSchemaForCategory(category.id, category.slug);
    const dto: FormSchemaDTO = {
      categoryId: fallback.categoryId,
      subCategoryId: fallback.categoryId,
      flow: null,
      adTypes,
      steps: (fallback.steps || [])
        .map(step => ({
          id: step.id,
          name: (step as any).name ?? step.title ?? step.id,
          label: step.title ?? (step as any).label ?? step.id,
          order: (step as any).order ?? 0,
          info: (step as any).description ? [String((step as any).description)] : undefined,
          flow: (step as any).flow ?? null,
          fields: (step.fields || [])
            .filter(field => {
              const raw = field as unknown as Record<string, unknown>;
              return raw.disabled !== true && raw.active !== false && raw.isActive !== false;
            })
            .map(field => ({
              id: (field as any).id ?? `${step.id}-${field.name}`,
              name: field.name,
              label: field.label,
              type: (field as any).type ?? 'text',
              info: Array.isArray((field as any).info) ? (field as any).info : undefined,
              rules: {
                mandatory: (field as any).required,
                max_length: (field as any).maxLength,
                min_length: (field as any).minLength,
                min: (field as any).min,
                max: (field as any).max
              },
              options: (field as any).options,
              ui: {
                placeholder: (field as any).placeholder
              }
            }))
        }))
        .filter(step => step.fields.length > 0)
    };
    return dto;
  }

  async getPriceSuggestion(query: PriceSuggestionQueryDto) {
    const qb = this.listingsRepository
      .createQueryBuilder('listing')
      .select(['listing.price', 'listing.currency'])
      .where('listing.status = :status', { status: ListingStatus.PUBLISHED })
      .andWhere('listing.price IS NOT NULL');

    if (query.subCategoryId) {
      qb.andWhere('listing.category_id = :subCategoryId', { subCategoryId: query.subCategoryId });
    } else if (query.categoryId) {
      qb.andWhere('listing.category_id = :categoryId', { categoryId: query.categoryId });
    }

    if (query.city) {
      qb.andWhere(`COALESCE(listing.location->>'city', '') ILIKE :city`, {
        city: `%${query.city}%`
      });
    }

    const limit = query.sampleSize ?? 200;
    qb.orderBy('listing.created_at', 'DESC').take(limit);

    const rows = await qb.getRawMany<{ listing_price: string; listing_currency: string }>();
    const prices = rows
      .map(row => Number(row.listing_price))
      .filter(v => Number.isFinite(v))
      .sort((a, b) => a - b);

    if (!prices.length) {
      return {
        suggested: null,
        min: null,
        max: null,
        currency: 'XAF',
        sampleSize: 0
      };
    }

    const percentile = (p: number) => {
      if (!prices.length) return null;
      const idx = (p / 100) * (prices.length - 1);
      const lower = Math.floor(idx);
      const upper = Math.ceil(idx);
      if (lower === upper) return prices[lower];
      return prices[lower] + (prices[upper] - prices[lower]) * (idx - lower);
    };

    const median = percentile(50) ?? prices[Math.floor(prices.length / 2)];
    const p25 = percentile(25) ?? prices[0];
    const p75 = percentile(75) ?? prices[prices.length - 1];
    const currency = rows.find(r => r.listing_currency)?.listing_currency ?? 'XAF';

    return {
      suggested: Number(median.toFixed(0)),
      min: Number(p25.toFixed(0)),
      max: Number(p75.toFixed(0)),
      currency,
      sampleSize: prices.length
    };
  }

  async exportPdf(id: string): Promise<Buffer> {
    const listing = await this.listingsRepository.findOne({
      where: { id },
      relations: ['images', 'owner', 'category']
    });
    if (!listing) {
      throw new NotFoundException('Annonce introuvable');
    }

    const dto: ListingPdfDto = {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      currency: listing.currency,
      location: listing.location as any,
      coverImage: listing.images?.find(img => img.isCover)?.url ?? listing.images?.[0]?.url ?? null,
      images: (listing.images ?? []).map(img => img.url).filter(Boolean),
      publishedAt: listing.publishedAt,
      ownerName: listing.owner ? `${listing.owner.firstName ?? ''} ${listing.owner.lastName ?? ''}`.trim() : null
    };

    return await new Promise<Buffer>((resolvePromise, rejectPromise) => {
      const doc = new PDFDocument({ autoFirstPage: false });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk as Buffer));
      doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
      doc.on('error', rejectPromise);

      doc.addPage({ margin: 50 });
      doc.fontSize(22).text(dto.title, { width: 500, continued: false });

      if (dto.price) {
        const priceLine = `${dto.price} ${dto.currency ?? ''}`.trim();
        doc.moveDown(0.5).fontSize(16).fillColor('#444').text(priceLine);
      }

      const locationText =
        dto.location?.city && dto.location?.zipcode
          ? `${dto.location.city} (${dto.location.zipcode})`
          : dto.location?.city || dto.location?.address || '';
      if (locationText) {
        doc.moveDown(0.25).fontSize(12).fillColor('#666').text(locationText);
      }

      doc.moveDown(1).fontSize(12).fillColor('#000').text(dto.description ?? '', {
        width: 500
      });

      if (dto.images && dto.images.length) {
        doc.addPage({ margin: 50 });
        doc.fontSize(16).text('Photos', { underline: true });
        const imagesToShow = dto.images.slice(0, 6);
        imagesToShow.forEach((url, idx) => {
          doc
            .moveDown(0.5)
            .fontSize(10)
            .fillColor('#0070dd')
            .text(`Image ${idx + 1}: ${url}`, { link: url, underline: true });
        });
      }

      if (dto.ownerName) {
        doc.addPage({ margin: 50 });
        doc.fontSize(16).fillColor('#000').text('Vendeur', { underline: true });
        doc.moveDown(0.5).fontSize(12).fillColor('#444').text(dto.ownerName);
      }

      doc.end();
    });
  }

  buildOgHtml(listing: Listing, absoluteUrl: string): string {
    const title = listing.title ?? 'Annonce';
    const description = (listing.description ?? '').slice(0, 200);
    const image = listing.images?.find(img => img.isCover) ?? listing.images?.[0];
    const imageUrl = image?.url ?? '';
    const price =
      listing.price && Number.isFinite(Number(listing.price))
        ? `${listing.price} ${listing.currency ?? ''}`.trim()
        : '';
    const locationObj = listing.location as any;
    const locationText = locationObj?.city
      ? locationObj.zipcode
        ? `${locationObj.city} (${locationObj.zipcode})`
        : locationObj.city
      : '';

    const safe = (value: string) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const ogTitle = safe(title);
    const ogDesc = safe(description || title);
    const ogImage = safe(imageUrl);
    const ogUrl = safe(absoluteUrl);

    const priceLine = price ? `<meta property="product:price:amount" content="${safe(price)}" />` : '';
    const locLine = locationText
      ? `<meta property="place:location:street-address" content="${safe(locationText)}" />`
      : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:url" content="${ogUrl}" />
  ${ogImage ? `<meta property="og:image" content="${ogImage}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDesc}" />
  ${ogImage ? `<meta name="twitter:image" content="${ogImage}" />` : ''}
  ${priceLine}
  ${locLine}
  <meta http-equiv="refresh" content="0;url=${ogUrl}" />
  <title>${ogTitle}</title>
</head>
<body>
  <p>Redirection vers l'annonce…</p>
</body>
</html>`;
  }

  async findAll(
    filter: FilterListingsDto
  ): Promise<PaginatedResult<Listing, ListingsSearchMeta>> {
    await this.refreshPromotionAutomations();
    const page = Math.max(filter.page ?? 1, 1);
    const limit = Math.min(Math.max(filter.limit ?? 20, 1), MAX_LISTINGS_PAGE_SIZE);
    const normalizedSearch = this.normalizeTextFilter(filter.search, 255);
    const normalizedCity = this.normalizeTextFilter(filter.city, 120);

    this.validatePriceRange(filter.minPrice, filter.maxPrice);
    this.validateGeoRadiusFilter(filter.lat, filter.lng, filter.radiusKm);

    const cityIds = Array.from(
      new Set([filter.cityId, ...(filter.cityIds ?? [])].filter((value): value is string => Boolean(value)))
    );
    const neighborhoodIds = Array.from(
      new Set(
        [filter.neighborhoodId, ...(filter.neighborhoodIds ?? [])].filter((value): value is string => Boolean(value))
      )
    );
    const warnings = this.buildAppliedFilterWarnings(filter.search, normalizedSearch, filter.city, normalizedCity);
    const appliedFilters = this.buildAppliedFiltersMeta(
      filter,
      normalizedSearch,
      normalizedCity,
      cityIds,
      neighborhoodIds,
      page,
      limit
    );

    const categoryScopeIds = filter.categorySlug
      ? await this.resolveCategoryScopeIds(filter.categorySlug)
      : null;

    if (filter.categorySlug && (!categoryScopeIds || categoryScopeIds.length === 0)) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        meta: {
          appliedFilters,
          ...(warnings.length ? { warnings } : {})
        }
      };
    }

    const query = this.listingsRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'image')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.owner', 'owner');

    if (normalizedSearch) {
      const [searchSynonymsMap, searchRelevanceSettings] = await Promise.all([
        this.searchLogsService.getSearchSynonymsMap(),
        this.searchRelevanceSettingsService.getSettings()
      ]);
      query.leftJoin('geo_cities', 'geoCity', 'geoCity.id = listing.city_id');
      const searchBusinessRankConfig = this.buildSearchBusinessRankConfig(searchRelevanceSettings);
      this.applySearchFilter(
        query,
        normalizedSearch,
        Boolean(filter.titleOnly),
        searchSynonymsMap,
        searchBusinessRankConfig
      );
    }

    if (categoryScopeIds && categoryScopeIds.length > 0) {
      query.andWhere('category.id IN (:...categoryScopeIds)', {
        categoryScopeIds
      });
    }

    if (filter.categoryId) {
      query.andWhere('category.id = :categoryId', {
        categoryId: filter.categoryId
      });
    }

    if (cityIds.length > 0 || neighborhoodIds.length > 0) {
      query.andWhere(
        new Brackets(locationQuery => {
          if (cityIds.length > 0) {
            locationQuery.where('listing.city_id IN (:...cityIds)', {
              cityIds
            });
          }

          if (neighborhoodIds.length > 0) {
            const clause = 'listing.neighborhood_id IN (:...neighborhoodIds)';
            if (cityIds.length > 0) {
              locationQuery.orWhere(clause, {
                neighborhoodIds
              });
            } else {
              locationQuery.where(clause, {
                neighborhoodIds
              });
            }
          }
        })
      );
    } else if (filter.cityId) {
      query.andWhere('listing.city_id = :cityId', {
        cityId: filter.cityId
      });
    } else if (filter.neighborhoodId) {
      query.andWhere('listing.neighborhood_id = :neighborhoodId', {
        neighborhoodId: filter.neighborhoodId
      });
    }

    if (normalizedCity) {
      query.andWhere(
        `(
          COALESCE(listing.location->>'city', '') ILIKE :city
          OR COALESCE(listing.location->>'address', '') ILIKE :city
          OR COALESCE(listing.location->>'label', '') ILIKE :city
        )`,
        {
          city: `%${normalizedCity}%`
        }
      );
    }

    if (filter.status) {
      query.andWhere('listing.status = :status', { status: filter.status });
    } else {
      query.andWhere('listing.status = :defaultStatus', {
        defaultStatus: ListingStatus.PUBLISHED
      });
    }

    if (filter.tag) {
      query.andWhere('listing.tag = :tag', { tag: filter.tag });
    }

    if (filter.minPrice !== undefined) {
      query.andWhere('listing.price >= :minPrice', {
        minPrice: filter.minPrice
      });
    }

    if (filter.maxPrice !== undefined) {
      query.andWhere('listing.price <= :maxPrice', {
        maxPrice: filter.maxPrice
      });
    }

    if (filter.ownerId) {
      query.andWhere('listing.owner = :ownerId', { ownerId: filter.ownerId });
    }

    if (
      filter.lat !== undefined &&
      filter.lng !== undefined &&
      filter.radiusKm !== undefined &&
      filter.radiusKm > 0
    ) {
      const radiusCondition = `(
        111.045 * DEGREES(
          ACOS(
            LEAST(
              1.0,
              COS(RADIANS(:lat)) * COS(RADIANS(CAST(listing.location->>'lat' AS DOUBLE PRECISION)))
              * COS(RADIANS(CAST(listing.location->>'lng' AS DOUBLE PRECISION)) - RADIANS(:lng))
              + SIN(RADIANS(:lat)) * SIN(RADIANS(CAST(listing.location->>'lat' AS DOUBLE PRECISION)))
            )
          )
        )
      ) <= :radiusKm`;

      if (filter.city) {
        query.andWhere(
          `(
            ((listing.location->>'lat') IS NOT NULL AND (listing.location->>'lng') IS NOT NULL AND ${radiusCondition})
            OR (listing.location->>'lat') IS NULL
            OR (listing.location->>'lng') IS NULL
          )`,
          {
            lat: filter.lat,
            lng: filter.lng,
            radiusKm: filter.radiusKm
          }
        );
      } else {
        query.andWhere(`(listing.location->>'lat') IS NOT NULL AND (listing.location->>'lng') IS NOT NULL`);
        query.andWhere(radiusCondition, {
          lat: filter.lat,
          lng: filter.lng,
          radiusKm: filter.radiusKm
        });
      }
    }

    if (filter.isFeatured !== undefined) {
      query.andWhere('listing.isFeatured = :isFeatured', {
        isFeatured: filter.isFeatured
      });
    }

    if (filter.isBoosted !== undefined) {
      query.andWhere('listing.isBoosted = :isBoosted', {
        isBoosted: filter.isBoosted
      });
    }

    if (filter.sellerType) {
      query.andWhere('owner.isPro = :isProFilter', {
        isProFilter: filter.sellerType === SellerTypeFilter.PRO
      });
    }

    if (filter.adType) {
      query.andWhere('listing.flow = :flow', { flow: filter.adType });
    }

    if (filter.attributes && typeof filter.attributes === 'object') {
      Object.entries(filter.attributes).forEach(([key, value], index) => {
        if (value === null || value === undefined) {
          return;
        }
        if (typeof value === 'string' && value.trim() === '') {
          return;
        }
        if (Array.isArray(value) && value.length === 0) {
          return;
        }
        const paramName = `attr_${index}`;
        query.andWhere(`listing.details @> :${paramName}`, {
          [paramName]: { [key]: value }
        });
      });
    }

    this.applySortOrder(query, filter.sort, 'listing.publishedAt', Boolean(normalizedSearch));

    query.skip((page - 1) * limit).take(limit);

    const searchStart = process.hrtime.bigint()
    const [data, total] = await query.getManyAndCount();
    const searchDurationSeconds = Number(process.hrtime.bigint() - searchStart) / 1e9
    this.monitoringMetricsService.observeSearchListingsQuery(
      Boolean(normalizedSearch),
      searchDurationSeconds,
      total
    )
    data.forEach(listing => this.applyLocationMask(listing));

    if (normalizedSearch && page === 1) {
      void this.searchLogsService.recordSearch(normalizedSearch, total);
    }

    return {
      data,
      total,
      page,
      limit,
      meta: {
        appliedFilters,
        ...(warnings.length ? { warnings } : {})
      }
    };
  }

  async listPublishedByOwner(
    ownerId: string,
    options: {
      page?: number;
      limit?: number;
      categorySlug?: string;
      sort?: 'recent' | 'priceAsc' | 'priceDesc' | 'popular';
    }
  ): Promise<PaginatedResult<ListingResponseDTO>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 12;
    const categoryScopeIds = options.categorySlug
      ? await this.resolveCategoryScopeIds(options.categorySlug)
      : null;

    if (options.categorySlug && (!categoryScopeIds || categoryScopeIds.length === 0)) {
      return {
        data: [],
        total: 0,
        page,
        limit
      };
    }

    const query = this.listingsRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'image')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.owner', 'owner')
      .where('listing.owner_id = :ownerId', { ownerId })
      .andWhere('listing.status = :status', { status: ListingStatus.PUBLISHED });

    if (categoryScopeIds && categoryScopeIds.length > 0) {
      query.andWhere('category.id IN (:...categoryScopeIds)', {
        categoryScopeIds
      });
    }

    const sort = options.sort ?? 'recent';
    if (sort === 'priceAsc') {
      query.orderBy('listing.price', 'ASC');
    } else if (sort === 'priceDesc') {
      query.orderBy('listing.price', 'DESC');
    } else if (sort === 'popular') {
      query
        .orderBy('listing.views', 'DESC')
        .addOrderBy('listing.messagesCount', 'DESC')
        .addOrderBy('listing.publishedAt', 'DESC');
    } else {
      query
        .orderBy('listing.publishedAt', 'DESC')
        .addOrderBy('listing.created_at', 'DESC');
    }

    query.skip((page - 1) * limit).take(limit);

    const [listings, total] = await query.getManyAndCount();

    return {
      data: listings.map(listing => this.mapListingToDto(listing)),
      total,
      page,
      limit
    };
  }

  async findOne(id: string): Promise<Listing> {
    await this.refreshPromotionAutomations();
    const listing = await this.listingsRepository.findOne({
      where: { id },
      relations: {
        images: true,
        category: true,
        owner: true,
        promotions: true
      }
    });

    if (!listing) {
      throw new NotFoundException('Listing not found.');
    }

    if (listing.images) {
      listing.images.sort((a, b) => a.position - b.position);
    }

    return listing;
  }

  async findOneDto(id: string, viewer?: AuthUser): Promise<ListingResponseDTO> {
    const listing = await this.findOne(id);
    const ownerListingCount = listing.owner
      ? await this.listingsRepository.count({
          where: {
            owner: { id: listing.owner.id },
            status: ListingStatus.PUBLISHED
          }
        })
      : undefined;
    return this.mapListingToDto(listing, viewer, ownerListingCount);
  }

  async update(
    id: string,
    updateListingDto: UpdateListingDto,
    requester: AuthUser
  ): Promise<ListingResponseDTO> {
    const listing = await this.findOne(id);

    if (listing.owner.id !== requester.id && requester.role === UserRole.USER) {
      throw new ForbiddenException('You are not allowed to update this listing.');
    }

    if (updateListingDto.subCategoryId || updateListingDto.categoryId) {
      listing.category = await this.categoriesService.findOne(
        updateListingDto.subCategoryId ?? updateListingDto.categoryId!
      );
    }

    if (updateListingDto.ownerId && requester.role !== 'user') {
      listing.owner = await this.usersService.findOne(updateListingDto.ownerId);
    }

    const priceAmount = updateListingDto.price?.amount;
    if (priceAmount !== undefined) {
      listing.price = Number(priceAmount);
    }
    if (updateListingDto.price?.currency) {
      listing.currency = updateListingDto.price.currency;
    }

    const locationDto = updateListingDto.location;
    const hasLocationCityId =
      !!locationDto && Object.prototype.hasOwnProperty.call(locationDto, 'cityId');
    const hasLocationNeighborhoodId =
      !!locationDto && Object.prototype.hasOwnProperty.call(locationDto, 'neighborhoodId');
    if (locationDto) {
      if ((locationDto.address || locationDto.city || locationDto.zipcode) &&
        (locationDto.lat === undefined || locationDto.lng === undefined)) {
        throw new BadRequestException('Latitude et longitude sont requises pour une adresse.');
      }
      const resolvedGeoSelection = await this.geoService.resolveSelection(
        hasLocationCityId ? locationDto.cityId : listing.cityId ?? undefined,
        hasLocationNeighborhoodId ? locationDto.neighborhoodId : listing.neighborhoodId ?? undefined
      );
      listing.cityId = resolvedGeoSelection.cityId ?? null;
      listing.neighborhoodId = resolvedGeoSelection.neighborhoodId ?? null;
      listing.location = {
        ...(listing.location ?? {}),
        ...locationDto,
        cityId: listing.cityId ?? undefined,
        neighborhoodId: listing.neighborhoodId ?? undefined
      };
    }

    if (updateListingDto.title !== undefined) {
      listing.title = updateListingDto.title;
    }
    if (updateListingDto.description !== undefined) {
      listing.description = updateListingDto.description;
    }

    // Merge details/attributes
    const details = { ...(listing.formData ?? {}) };
    if (updateListingDto.attributes) {
      Object.assign(details, updateListingDto.attributes);
    }
    if (updateListingDto.contact) {
      listing.contact = { ...(listing.contact ?? {}), ...updateListingDto.contact };
    }
    if (locationDto) {
      details['_geo'] = {
        ...(details as any)._geo,
        lat: locationDto.lat,
        lng: locationDto.lng,
        address: locationDto.address ?? (details as any)._geo?.address,
        city: locationDto.city ?? (details as any)._geo?.city,
        zipcode: locationDto.zipcode ?? (details as any)._geo?.zipcode,
        cityId: listing.cityId ?? undefined,
        neighborhoodId: listing.neighborhoodId ?? undefined,
        hideExact:
          locationDto.hideExact ?? (details as any)._geo?.hideExact ?? (listing.location as any)?.hideExact
      };
    }
    if (updateListingDto.meta) {
      details['_meta'] = { ...(details as any)._meta, ...updateListingDto.meta };
    }
    listing.formData = details;

    if (updateListingDto.status && updateListingDto.status !== listing.status) {
      listing.status = updateListingDto.status;
      listing.publishedAt =
        updateListingDto.status === ListingStatus.PUBLISHED
          ? new Date()
          : listing.publishedAt;
    }

    const savedListing = await this.listingsRepository.save(listing);

    if (updateListingDto.images) {
      const incomingImages = updateListingDto.images
        .slice(0, 8)
        .filter(image => typeof image.url === 'string' && image.url.trim().length > 0)
        .map(image => ({
          url: image.url.trim(),
          position:
            typeof image.position === 'number' && Number.isFinite(image.position)
              ? image.position
              : undefined,
          isCover: Boolean(image.isCover)
        }));

      await this.listingImagesRepository.delete({ listingId: savedListing.id });

      if (incomingImages.length > 0) {
        const hasCover = incomingImages.some(image => image.isCover);
        const imagesToSave = incomingImages.map((image, index) =>
          this.listingImagesRepository.create({
            listingId: savedListing.id,
            url: image.url,
            position: image.position ?? index,
            isCover: hasCover ? image.isCover : index === 0
          })
        );

        await this.listingImagesRepository.save(imagesToSave);
      }
    }

    savedListing.images = await this.listingImagesRepository.find({
      where: { listingId: savedListing.id },
      order: { position: 'ASC' }
    });

    return this.mapListingToDto(savedListing, requester);
  }

  async remove(id: string, requester: AuthUser): Promise<void> {
    const listing = await this.findOne(id);
    if (listing.owner.id !== requester.id && requester.role === UserRole.USER) {
      throw new ForbiddenException('You are not allowed to delete this listing.');
    }
    await this.listingsRepository.remove(listing);
  }

  async getFeatured(
    limit = 4,
    sort: ListingSort = ListingSort.RECENT,
    sellerType?: SellerTypeFilter
  ): Promise<Listing[]> {
    await this.refreshPromotionAutomations();
    const query = this.listingsRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'image')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.owner', 'owner')
      .where('listing.isFeatured = :isFeatured', { isFeatured: true })
      .andWhere('listing.status = :status', {
        status: ListingStatus.PUBLISHED
      });

    if (sellerType) {
      query.andWhere('owner.isPro = :isProFilter', {
        isProFilter: sellerType === SellerTypeFilter.PRO
      });
    }

    this.applySortOrder(query, sort, 'listing.publishedAt');

    const listings = await query.take(limit).getMany();
    listings.forEach(listing => this.applyLocationMask(listing));
    return listings;
  }

  async getLatest(
    limit = 10,
    sort: ListingSort = ListingSort.RECENT,
    sellerType?: SellerTypeFilter
  ): Promise<Listing[]> {
    await this.refreshPromotionAutomations();
    const query = this.listingsRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'image')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.owner', 'owner')
      .where('listing.status = :status', {
        status: ListingStatus.PUBLISHED
      });

    if (sellerType) {
      query.andWhere('owner.isPro = :isProFilter', {
        isProFilter: sellerType === SellerTypeFilter.PRO
      });
    }

    this.applySortOrder(query, sort);

    const listings = await query.take(limit).getMany();
    listings.forEach(listing => this.applyLocationMask(listing));
    return listings;
  }

  async countPublished(): Promise<number> {
    return this.listingsRepository.count({
      where: { status: ListingStatus.PUBLISHED }
    });
  }

  async countFeatured(): Promise<number> {
    return this.listingsRepository.count({
      where: { status: ListingStatus.PUBLISHED, isFeatured: true }
    });
  }

  async getPopularCategories(limit = 5): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      icon: string | null;
      color: string | null;
      gradient: string | null;
      description: string | null;
      listingCount: number;
    }>
  > {
    const rows = await this.listingsRepository
      .createQueryBuilder('listing')
      .innerJoin('listing.category', 'category')
      .select('category.id', 'id')
      .addSelect('category.name', 'name')
      .addSelect('category.slug', 'slug')
      .addSelect('category.icon', 'icon')
      .addSelect('category.color', 'color')
      .addSelect('category.gradient', 'gradient')
      .addSelect('category.description', 'description')
      .addSelect('COUNT(listing.id)', 'listingCount')
      .where('listing.status = :status', { status: ListingStatus.PUBLISHED })
      .groupBy('category.id')
      .orderBy('"listingCount"', 'DESC')
      .addOrderBy('category.position', 'ASC')
      .limit(limit)
      .getRawMany<{
        id: string;
        name: string;
        slug: string;
        icon: string | null;
        color: string | null;
        gradient: string | null;
        description: string | null;
        listingCount: string;
      }>();

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      color: row.color,
      gradient: row.gradient,
      description: row.description,
      listingCount: Number(row.listingCount)
    }));
  }

  async findMine(userId: string, status?: ListingStatus): Promise<Listing[]> {
    const where: Record<string, unknown> = { owner: { id: userId } };
    if (status) {
      where.status = status;
    }

    return this.listingsRepository.find({
      where,
      relations: { category: true, images: true },
      order: { updatedAt: 'DESC' }
    });
  }

  findPending(limit = 50): Promise<Listing[]> {
    return this.listingsRepository.find({
      where: { status: ListingStatus.PENDING },
      relations: {
        owner: true,
        category: true,
        reports: { reporter: true }
      },
      order: { created_at: 'ASC' },
      take: limit
    });
  }

  async updateStatus(
    id: string,
    status: ListingStatus,
    reviewer: AuthUser
  ): Promise<Listing> {
    if (reviewer.role === UserRole.USER) {
      throw new ForbiddenException('Only moderators can change status.');
    }

    const listing = await this.findOne(id);
    const wasPublished = listing.status === ListingStatus.PUBLISHED;
    listing.status = status;
    listing.publishedAt =
      status === ListingStatus.PUBLISHED ? new Date() : listing.publishedAt;
    const saved = await this.listingsRepository.save(listing);

    if (!wasPublished && status === ListingStatus.PUBLISHED && listing.owner?.isPro) {
      const followers = await this.usersService.getFollowersForSeller(listing.owner.id);
      await Promise.all(
        followers.map(follower =>
          this.notificationsService.notifyFollowedSellerListing(
            follower,
            listing.owner,
            saved
          )
        )
      );
    }

    return saved;
  }

  async getSimilar(listingId: string, limit = 6): Promise<Listing[]> {
    const listing = await this.findOne(listingId);
    const listings = await this.listingsRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'image')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.owner', 'owner')
      .where('listing.status = :status', {
        status: ListingStatus.PUBLISHED
      })
      .andWhere('category.id = :categoryId', {
        categoryId: listing.category.id
      })
      .andWhere('listing.id <> :listingId', { listingId })
      .orderBy('listing.created_at', 'DESC')
      .take(limit)
      .getMany();
    listings.forEach(item => this.applyLocationMask(item));
    return listings;
  }

  private applySortOrder(
    query: SelectQueryBuilder<Listing>,
    sort?: ListingSort,
    defaultField: string = 'listing.publishedAt',
    hasSearch = false
  ): void {
    if (hasSearch) {
      query.orderBy('search_rank', 'DESC');
    } else {
      query.orderBy('listing.isPremium', 'DESC');
    }
    query.addOrderBy('listing.isPremium', 'DESC');
    query.addOrderBy('listing.isFeatured', 'DESC');
    query.addOrderBy('listing.isBoosted', 'DESC');
    switch (sort) {
      case ListingSort.PRICE_ASC:
        query.addOrderBy('listing.price', 'ASC');
        query.addOrderBy(defaultField, 'DESC');
        query.addOrderBy('listing.created_at', 'DESC');
        query.addOrderBy('listing.id', 'DESC');
        break;
      case ListingSort.PRICE_DESC:
        query.addOrderBy('listing.price', 'DESC');
        query.addOrderBy(defaultField, 'DESC');
        query.addOrderBy('listing.created_at', 'DESC');
        query.addOrderBy('listing.id', 'DESC');
        break;
      default:
        query.addOrderBy(defaultField, 'DESC');
        query.addOrderBy('listing.created_at', 'DESC');
        query.addOrderBy('listing.id', 'DESC');
    }
  }

  private applySearchFilter(
    query: SelectQueryBuilder<Listing>,
    searchTerm: string,
    titleOnly: boolean,
    searchSynonymsMap: SearchSynonymsMap,
    searchBusinessRankConfig: SearchBusinessRankConfig
  ): void {
    const parsedSearch = this.parseSearchQuery(searchTerm);
    const fallbackIncludeTerms =
      parsedSearch.includeTerms.length === 0 && parsedSearch.includePhrases.length === 0
        ? this.tokenizeSearchTerms(searchTerm.replace(/[-!]/g, ' '))
        : [];
    const includeTerms = parsedSearch.includeTerms.length
      ? parsedSearch.includeTerms
      : fallbackIncludeTerms;
    const normalizedSearch = this.normalizeSearchToken(searchTerm);
    const normalizedPhraseParamName = 'searchNormalizedPhrase';
    const normalizedRankTerm = this.resolveSearchRankTerm(normalizedSearch, parsedSearch);
    const normalizedPhraseValue = `%${normalizedRankTerm}%`;
    const searchExactParamName = 'searchNormalizedExact';
    const searchPrefixParamName = 'searchNormalizedPrefix';
    const searchContainsParamName = 'searchNormalizedContains';
    const searchFields = titleOnly
      ? ['listing.title']
      : [
          'listing.title',
          'listing.description',
          `COALESCE(listing.location->>'city', '')`,
          `COALESCE(listing.location->>'address', '')`,
          `COALESCE(listing.location->>'label', '')`
        ];
    const normalizedSearchFields = searchFields.map(field => this.toNormalizedSearchExpression(field));

    includeTerms.forEach((token, index) => {
      const normalizedToken = this.normalizeSearchToken(token);
      const candidates = this.expandSearchToken(token, searchSynonymsMap)
        .map(candidate => this.normalizeSearchToken(candidate))
        .filter(candidate => candidate.length > 0);
      const uniqueCandidates = Array.from(new Set(candidates));

      if (!uniqueCandidates.length && !normalizedToken) {
        return;
      }

      const params = Object.fromEntries(
        uniqueCandidates.map((candidate, candidateIndex) => [
          `searchToken${index}_${candidateIndex}`,
          `%${candidate}%`
        ])
      );

      query.andWhere(
        new Brackets(tokenQuery => {
          let hasClause = false;

          normalizedSearchFields.forEach(field => {
            uniqueCandidates.forEach((_, candidateIndex) => {
              const tokenParamName = `searchToken${index}_${candidateIndex}`;
              const clause = `${field} LIKE :${tokenParamName}`;

              if (!hasClause) {
                tokenQuery.where(clause, params);
                hasClause = true;
              } else {
                tokenQuery.orWhere(clause);
              }
            });
          });

          if (normalizedToken) {
            const fuzzyParamName = `searchTokenFuzzy${index}`;
            const fuzzyThresholdParamName = `searchTokenFuzzyThreshold${index}`;
            const fuzzyThreshold = this.resolveTokenSimilarityThreshold(normalizedToken);
            const fuzzyParams = {
              [fuzzyParamName]: normalizedToken,
              [fuzzyThresholdParamName]: fuzzyThreshold
            };

            const fuzzyClauses = [
              `lemaket_similarity(${this.toNormalizedSearchExpression('listing.title')}, :${fuzzyParamName}) >= :${fuzzyThresholdParamName}`
            ];

            if (!titleOnly) {
              fuzzyClauses.push(
                `lemaket_similarity(${this.toNormalizedSearchExpression(`COALESCE(listing.description, '')`)}, :${fuzzyParamName}) >= :${fuzzyThresholdParamName}`
              );
            }

            fuzzyClauses.forEach(clause => {
              if (!hasClause) {
                tokenQuery.where(clause, fuzzyParams);
                hasClause = true;
              } else {
                tokenQuery.orWhere(clause, fuzzyParams);
              }
            });
          }
        })
      );
    });

    parsedSearch.includePhrases.forEach((phrase, index) => {
      const normalizedPhrase = this.normalizeSearchToken(phrase);
      if (!normalizedPhrase) {
        return;
      }

      const phraseParamName = `searchIncludePhrase${index}`;
      const params = { [phraseParamName]: `%${normalizedPhrase}%` };
      const clauses = normalizedSearchFields.map(field => `${field} LIKE :${phraseParamName}`);
      query.andWhere(`(${clauses.join(' OR ')})`, params);
    });

    parsedSearch.excludeTerms.forEach((token, index) => {
      const candidates = this.expandSearchToken(token, searchSynonymsMap)
        .map(candidate => this.normalizeSearchToken(candidate))
        .filter(candidate => candidate.length > 0);
      const uniqueCandidates = Array.from(new Set(candidates));
      if (!uniqueCandidates.length) {
        return;
      }

      const params: Record<string, string> = {};
      const clauses: string[] = [];
      uniqueCandidates.forEach((candidate, candidateIndex) => {
        const tokenParamName = `searchExcludeToken${index}_${candidateIndex}`;
        params[tokenParamName] = `%${candidate}%`;
        normalizedSearchFields.forEach(field => {
          clauses.push(`${field} LIKE :${tokenParamName}`);
        });
      });

      if (clauses.length > 0) {
        query.andWhere(`NOT (${clauses.join(' OR ')})`, params);
      }
    });

    parsedSearch.excludePhrases.forEach((phrase, index) => {
      const normalizedPhrase = this.normalizeSearchToken(phrase);
      if (!normalizedPhrase) {
        return;
      }
      const phraseParamName = `searchExcludePhrase${index}`;
      const params = { [phraseParamName]: `%${normalizedPhrase}%` };
      const clauses = normalizedSearchFields.map(field => `${field} LIKE :${phraseParamName}`);
      query.andWhere(`NOT (${clauses.join(' OR ')})`, params);
    });

    const normalizedTitleExpression = this.toNormalizedSearchExpression('listing.title');
    const normalizedDescriptionExpression = this.toNormalizedSearchExpression(`COALESCE(listing.description, '')`);
    const normalizedCityExpression = this.toNormalizedSearchExpression(`COALESCE(listing.location->>'city', '')`);
    const normalizedAddressExpression = this.toNormalizedSearchExpression(`COALESCE(listing.location->>'address', '')`);
    const normalizedLabelExpression = this.toNormalizedSearchExpression(`COALESCE(listing.location->>'label', '')`);
    const normalizedCategorySlugExpression = this.toCompactNormalizedSearchExpression(`COALESCE(category.slug, '')`);
    const categoryPriorityCase = this.buildCategoryPriorityCaseExpression(
      normalizedCategorySlugExpression,
      searchBusinessRankConfig.categoryPriorityWeights
    );

    query.addSelect(
      `
        (
          CASE WHEN ${normalizedTitleExpression} = :${searchExactParamName} THEN 400 ELSE 0 END
          + CASE WHEN ${normalizedTitleExpression} LIKE :${searchPrefixParamName} THEN 250 ELSE 0 END
          + CASE WHEN ${normalizedTitleExpression} LIKE :${searchContainsParamName} THEN 150 ELSE 0 END
          + CASE WHEN ${normalizedDescriptionExpression} LIKE :${searchContainsParamName} THEN 80 ELSE 0 END
          + CASE WHEN ${normalizedCityExpression} LIKE :${searchContainsParamName} THEN 40 ELSE 0 END
          + CASE WHEN ${normalizedAddressExpression} LIKE :${searchContainsParamName} THEN 30 ELSE 0 END
          + CASE WHEN ${normalizedLabelExpression} LIKE :${searchContainsParamName} THEN 30 ELSE 0 END
          + CASE WHEN ${normalizedTitleExpression} LIKE :${normalizedPhraseParamName} THEN 20 ELSE 0 END
          + (lemaket_similarity(${normalizedTitleExpression}, :${searchExactParamName}) * 120)
          + (lemaket_similarity(${normalizedDescriptionExpression}, :${searchExactParamName}) * 50)
          + CASE WHEN COALESCE(geoCity.is_popular, false) = true THEN :searchPopularCityBoost ELSE 0 END
          + CASE WHEN owner."isPro" = true THEN :searchProSellerBoost ELSE 0 END
          + ${categoryPriorityCase.expression}
        )
      `,
      'search_rank'
    );

    query.setParameters({
      [searchExactParamName]: normalizedRankTerm,
      [searchPrefixParamName]: `${normalizedRankTerm}%`,
      [searchContainsParamName]: `%${normalizedRankTerm}%`,
      [normalizedPhraseParamName]: normalizedPhraseValue,
      searchPopularCityBoost: searchBusinessRankConfig.popularCityBoost,
      searchProSellerBoost: searchBusinessRankConfig.proSellerBoost,
      ...categoryPriorityCase.params
    });
  }

  private expandSearchToken(token: string, searchSynonymsMap: SearchSynonymsMap): string[] {
    const normalized = this.normalizeSearchToken(token);
    if (!normalized) {
      return token.trim() ? [token.trim()] : [];
    }

    const staticSynonyms = SEARCH_SYNONYMS[normalized] ?? [];
    const dynamicSynonyms = searchSynonymsMap[normalized] ?? [];
    const synonyms = [...staticSynonyms, ...dynamicSynonyms];
    const merged = new Set<string>([token, normalized, ...synonyms.map(entry => entry.trim()).filter(Boolean)]);
    return Array.from(merged);
  }

  private normalizeSearchToken(token: string): string {
    return token
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private tokenizeSearchTerms(
    searchTerm: string,
    options?: { fallbackToFullQuery?: boolean }
  ): string[] {
    const fallbackToFullQuery = options?.fallbackToFullQuery ?? true;
    const rawTokens = searchTerm
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length > 0);

    const meaningfulTokens = rawTokens.filter(token => {
      const normalizedToken = this.normalizeSearchToken(token);
      if (normalizedToken.length < 2) {
        return false;
      }
      return !SEARCH_STOP_WORDS.has(normalizedToken);
    });

    if (meaningfulTokens.length > 0) {
      return meaningfulTokens;
    }

    if (fallbackToFullQuery && searchTerm.trim()) {
      return [searchTerm.trim()];
    }

    return [];
  }

  private parseSearchQuery(searchTerm: string): ParsedSearchQuery {
    const includePhrases: string[] = [];
    const excludePhrases: string[] = [];
    const phraseMatches = Array.from(searchTerm.matchAll(/(-?)"([^"]+)"/g));

    phraseMatches.forEach(match => {
      const prefix = match[1];
      const phrase = this.normalizeTextFilter(match[2], 120);
      if (!phrase) {
        return;
      }
      if (prefix === '-') {
        excludePhrases.push(phrase);
      } else {
        includePhrases.push(phrase);
      }
    });

    const withoutQuotedPhrases = searchTerm.replace(/(-?)"([^"]+)"/g, ' ');
    const includeRawTokens: string[] = [];
    const excludeRawTokens: string[] = [];

    withoutQuotedPhrases
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean)
      .forEach(token => {
        if ((token.startsWith('-') || token.startsWith('!')) && token.length > 1) {
          excludeRawTokens.push(token.slice(1));
          return;
        }
        includeRawTokens.push(token);
      });

    return {
      includeTerms: this.tokenizeSearchTerms(includeRawTokens.join(' ')),
      excludeTerms: this.tokenizeSearchTerms(excludeRawTokens.join(' '), { fallbackToFullQuery: false }),
      includePhrases,
      excludePhrases
    };
  }

  private resolveSearchRankTerm(normalizedSearch: string, parsedSearch: ParsedSearchQuery): string {
    for (const phrase of parsedSearch.includePhrases) {
      const normalizedPhrase = this.normalizeSearchToken(phrase);
      if (normalizedPhrase) {
        return normalizedPhrase;
      }
    }

    for (const term of parsedSearch.includeTerms) {
      const normalizedTerm = this.normalizeSearchToken(term);
      if (normalizedTerm) {
        return normalizedTerm;
      }
    }

    return normalizedSearch || 'search';
  }

  private toNormalizedSearchExpression(fieldExpression: string): string {
    return `LOWER(lemaket_unaccent(COALESCE(${fieldExpression}, '')))`;
  }

  private toCompactNormalizedSearchExpression(fieldExpression: string): string {
    return `REGEXP_REPLACE(${this.toNormalizedSearchExpression(fieldExpression)}, '[^a-z0-9]', '', 'g')`;
  }

  private buildSearchBusinessRankConfig(
    settings: {
      enableBusinessBoost: boolean;
      popularCityBoost: number;
      proSellerBoost: number;
      categoryPriorityWeights: Record<string, number>;
    }
  ): SearchBusinessRankConfig {
    const isEnabled = Boolean(settings.enableBusinessBoost);
    return {
      popularCityBoost: isEnabled ? settings.popularCityBoost : 0,
      proSellerBoost: isEnabled ? settings.proSellerBoost : 0,
      categoryPriorityWeights: isEnabled ? settings.categoryPriorityWeights : {}
    };
  }

  private buildCategoryPriorityCaseExpression(
    normalizedCategorySlugExpression: string,
    weights: Record<string, number>
  ): { expression: string; params: Record<string, string[]> } {
    const grouped = new Map<number, string[]>();
    Object.entries(weights).forEach(([slug, weight]) => {
      const normalized = this.normalizeSearchToken(slug);
      if (!normalized || !Number.isFinite(weight) || weight <= 0) {
        return;
      }
      if (!grouped.has(weight)) {
        grouped.set(weight, []);
      }
      grouped.get(weight)?.push(normalized);
    });

    if (!grouped.size) {
      return {
        expression: '0',
        params: {}
      };
    }

    const params: Record<string, string[]> = {};
    const clauses: string[] = [];
    Array.from(grouped.entries())
      .sort((a, b) => b[0] - a[0])
      .forEach(([weight, slugs], index) => {
        const paramName = `searchCategoryPriorityGroup${index}`;
        params[paramName] = Array.from(new Set(slugs));
        clauses.push(`WHEN ${normalizedCategorySlugExpression} IN (:...${paramName}) THEN ${weight}`);
      });

    return {
      expression: `(CASE ${clauses.join(' ')} ELSE 0 END)`,
      params
    };
  }

  private resolveTokenSimilarityThreshold(token: string): number {
    if (token.length <= 4) {
      return 0.75;
    }
    if (token.length <= 7) {
      return 0.55;
    }
    return 0.34;
  }

  private normalizeTextFilter(value?: string | null, maxLength = 255): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, maxLength);

    return normalized.length > 0 ? normalized : undefined;
  }

  private buildAppliedFilterWarnings(
    rawSearch: string | undefined,
    normalizedSearch: string | undefined,
    rawCity: string | undefined,
    normalizedCity: string | undefined
  ): string[] {
    const warnings: string[] = [];
    if (
      typeof rawSearch === 'string' &&
      rawSearch.trim().length > 0 &&
      normalizedSearch &&
      normalizedSearch !== rawSearch
    ) {
      warnings.push('search query was normalized.');
    }

    if (typeof rawCity === 'string' && rawCity.trim().length > 0 && normalizedCity && normalizedCity !== rawCity) {
      warnings.push('city filter was normalized.');
    }

    return warnings;
  }

  private buildAppliedFiltersMeta(
    filter: FilterListingsDto,
    normalizedSearch: string | undefined,
    normalizedCity: string | undefined,
    cityIds: string[],
    neighborhoodIds: string[],
    page: number,
    limit: number
  ): Record<string, unknown> {
    const applied: Record<string, unknown> = {
      search: normalizedSearch,
      titleOnly: normalizedSearch ? Boolean(filter.titleOnly) : undefined,
      categorySlug: this.normalizeTextFilter(filter.categorySlug, 120),
      categoryId: filter.categoryId,
      city: normalizedCity,
      cityIds: cityIds.length > 0 ? cityIds : undefined,
      neighborhoodIds: neighborhoodIds.length > 0 ? neighborhoodIds : undefined,
      minPrice: filter.minPrice,
      maxPrice: filter.maxPrice,
      sellerType: filter.sellerType,
      adType: filter.adType,
      sort: filter.sort ?? ListingSort.RECENT,
      lat: filter.lat,
      lng: filter.lng,
      radiusKm: filter.radiusKm,
      attributes:
        filter.attributes && Object.keys(filter.attributes).length > 0
          ? filter.attributes
          : undefined,
      page,
      limit
    };

    return Object.fromEntries(
      Object.entries(applied).filter(([, value]) => {
        if (value === undefined || value === null) {
          return false;
        }
        if (typeof value === 'string') {
          return value.trim().length > 0;
        }
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return true;
      })
    );
  }

  private validatePriceRange(minPrice?: number, maxPrice?: number): void {
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      Number.isFinite(minPrice) &&
      Number.isFinite(maxPrice) &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException('minPrice must be less than or equal to maxPrice.');
    }
  }

  private validateGeoRadiusFilter(lat?: number, lng?: number, radiusKm?: number): void {
    const hasLat = lat !== undefined;
    const hasLng = lng !== undefined;

    if (hasLat !== hasLng) {
      throw new BadRequestException('lat and lng must be provided together.');
    }

    if (radiusKm !== undefined && radiusKm > 0 && (!hasLat || !hasLng)) {
      throw new BadRequestException('lat and lng are required when radiusKm is provided.');
    }
  }

  private async refreshPromotionAutomations(): Promise<void> {
    try {
      await this.promotionsService.runAutomationsIfDue();
    } catch (error) {
      console.error('Unable to refresh promotion automations', error);
    }
  }

  private async resolveCategoryScopeIds(categoryFilter: string): Promise<string[]> {
    const normalizedFilter = categoryFilter.trim();
    if (!normalizedFilter) {
      return [];
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedFilter
    );

    const query = this.categoriesRepository
      .createQueryBuilder('category')
      .where('LOWER(category.slug) = LOWER(:filter)', { filter: normalizedFilter });

    if (isUuid) {
      query.orWhere('category.id = :categoryId', { categoryId: normalizedFilter });
    }

    const rootCategory = await query.getOne();

    if (!rootCategory) {
      return [];
    }

    const treeRepository = this.listingsRepository.manager.getTreeRepository(Category);
    const descendants = await treeRepository.findDescendants(rootCategory);

    // Fallback when closure-table data is stale/missing: walk via parent relations.
    if (descendants.length <= 1) {
      const categories = await this.categoriesRepository.find({ relations: ['parent'] });
      const categoryIds = new Set<string>([rootCategory.id]);
      const queue: string[] = [rootCategory.id];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        categories.forEach(category => {
          const parentId = category.parent?.id;
          if (parentId === currentId && !categoryIds.has(category.id)) {
            categoryIds.add(category.id);
            queue.push(category.id);
          }
        });
      }

      return Array.from(categoryIds);
    }

    const categoryIds = new Set<string>([rootCategory.id]);
    descendants.forEach(category => {
      categoryIds.add(category.id);
    });
    return Array.from(categoryIds);
  }

  async incrementViews(id: string): Promise<void> {
    await this.listingsRepository.increment({ id }, 'views', 1);
  }

  async recordMessage(id: string): Promise<void> {
    await this.listingsRepository.increment({ id }, 'messagesCount', 1);
  }

  async countBySellerType(): Promise<{
    proListings: number;
    individualListings: number;
  }> {
    const baseQuery = this.listingsRepository
      .createQueryBuilder('listing')
      .leftJoin('listing.owner', 'owner')
      .where('listing.status = :status', {
        status: ListingStatus.PUBLISHED
      });

    const [proListings, individualListings] = await Promise.all([
      baseQuery
        .clone()
        .andWhere('owner.isPro = :isPro', { isPro: true })
        .getCount(),
      baseQuery
        .clone()
        .andWhere('(owner.isPro = :isPro OR owner.isPro IS NULL)', {
          isPro: false
        })
        .getCount()
    ]);

    return {
      proListings,
      individualListings
    };
  }

  async addImage(listingId: string, imageUrl: string, requester: AuthUser): Promise<ListingImage> {
    const listing = await this.findOne(listingId);

    if (listing.owner.id !== requester.id && requester.role === UserRole.USER) {
      throw new ForbiddenException('You are not allowed to add images to this listing.');
    }

    const image = this.listingImagesRepository.create({
      url: imageUrl,
      listing: listing,
    });

    return this.listingImagesRepository.save(image);
  }

  async removeImage(listingId: string, imageId: string, requester: AuthUser): Promise<void> {
    const listing = await this.findOne(listingId);

    if (listing.owner.id !== requester.id && requester.role === UserRole.USER) {
      throw new ForbiddenException('You are not allowed to remove images from this listing.');
    }

    const image = await this.listingImagesRepository.findOne({ where: { id: imageId, listing: { id: listingId } } });

    if (!image) {
      throw new NotFoundException('Image not found.');
    }

    await this.listingImagesRepository.remove(image);
  }

  private mapListingToDto(
    listing: Listing,
    viewer?: AuthUser,
    ownerListingCount?: number
  ): ListingResponseDTO {
    this.applyLocationMask(listing, viewer);
    const formData = { ...(listing.formData ?? {}) } as Record<string, unknown>;
    const geo = (formData as any)._geo ?? {};
    const contactData = listing.contact ?? (formData as any)._contact ?? {};
    const meta = (formData as any)._meta ?? {};

    const attributes = { ...formData };
    delete (attributes as any)._contact;
    delete (attributes as any)._geo;
    delete (attributes as any)._meta;

    const locationLabel =
      typeof (formData as any).location_label === 'string'
        ? (formData as any).location_label
        : undefined;

    const location = {
      cityId:
        listing.cityId ??
        (typeof (listing.location as any)?.cityId === 'string'
          ? (listing.location as any).cityId
          : null),
      neighborhoodId:
        listing.neighborhoodId ??
        (typeof (listing.location as any)?.neighborhoodId === 'string'
          ? (listing.location as any).neighborhoodId
          : null),
      address:
        listing.location?.address ??
        geo.address ??
        locationLabel ??
        null,
      city: listing.location?.city ?? geo.city ?? null,
      zipcode:
        listing.location?.zipcode ??
        geo.zipcode ??
        (geo as any)?.zipCode ??
        null,
      lat:
        listing.location?.lat ??
        (typeof geo.lat === 'number' ? geo.lat : null),
      lng:
        listing.location?.lng ??
        (typeof geo.lng === 'number' ? geo.lng : null),
      label: locationLabel ?? null,
      hideExact:
        listing.location?.hideExact ??
        (typeof (geo as any)?.hideExact === 'boolean' ? (geo as any).hideExact : false)
    };

    const newItemPrice =
      typeof (attributes as any).new_item_price === 'number'
        ? (attributes as any).new_item_price
        : undefined;

    const categoryParentId =
      (listing as any).category?.parent?.id ??
      (listing as any).category?.parentId ??
      null;

    const images = (listing.images ?? []).slice().sort((a, b) => a.position - b.position).map(img => ({
      id: img.id,
      url: img.url,
      position: img.position,
      isCover: img.isCover
    }));

    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: listing.price != null ? String(listing.price) : '0',
      priceDetails: {
        amount: Number(listing.price ?? 0),
        currency: listing.currency ?? 'XAF',
        newItemPrice: newItemPrice ?? null
      },
      currency: listing.currency ?? 'XAF',
      flow: listing.flow
        ? (listing.flow.toLowerCase() as 'sell' | 'buy' | 'let' | 'rent')
        : null,
      status: listing.status,
      location,
      contact: {
        email: (contactData as any).email ?? null,
        phone: (contactData as any).phone ?? null,
        phoneHidden: (contactData as any).phoneHidden ?? false,
        noSalesmen: (contactData as any).noSalesmen ?? false
      },
      category: {
        id: listing.category.id,
        name: listing.category.name,
        slug: listing.category.slug,
        description: listing.category.description ?? null,
        icon: listing.category.icon ?? null,
        color: listing.category.color ?? null,
        gradient: listing.category.gradient ?? null,
        parentId: categoryParentId
      },
      owner: listing.owner
        ? {
            id: listing.owner.id,
            firstName: (listing.owner as any).firstName ?? (listing.owner as any).firstname ?? null,
            lastName: (listing.owner as any).lastName ?? (listing.owner as any).lastname ?? null,
            avatarUrl: (listing.owner as any).avatarUrl ?? null,
            isPro: (listing.owner as any).isPro ?? false,
            isCompanyVerified:
              (listing.owner as any).companyVerificationStatus === CompanyVerificationStatus.APPROVED,
            listingCount: ownerListingCount
          }
        : undefined,
      images,
      attributes,
      meta: meta ?? {},
      isFeatured: Boolean(listing.isFeatured),
      isBoosted: Boolean(listing.isBoosted),
      isPremium: Boolean(listing.isPremium),
      publishedAt: listing.publishedAt ?? null,
      expiresAt: listing.expiresAt ?? null,
      created_at: listing.created_at,
      updatedAt: listing.updatedAt
    };
  }

  private applyLocationMask(listing: Listing, viewer?: AuthUser) {
    const settings = (listing.owner?.settings ?? {}) as Record<string, unknown>;
    const hasListingMask =
      listing.location && typeof listing.location === 'object' && (listing.location as any).hideExact === true;
    const shouldMask = hasListingMask || settings.maskPreciseLocation === true;
    if (!shouldMask) {
      return;
    }

    const isStaff = viewer?.role && viewer.role !== UserRole.USER;
    if (isStaff) {
      return;
    }

    const geo = listing.formData && typeof listing.formData === 'object' ? (listing.formData as any)._geo : null;
    const geoCity = geo && typeof geo.city === 'string' ? geo.city : null;
    const geoZipcode =
      geo && typeof geo.zipcode === 'string'
        ? geo.zipcode
        : geo && typeof geo.zipCode === 'string'
        ? geo.zipCode
        : null;
    const addressSource =
      typeof (listing.location as any)?.address === 'string'
        ? (listing.location as any).address
        : geo && typeof geo.address === 'string'
        ? geo.address
        : null;
    const parsedFromAddress = addressSource ? this.parseCityZipFromAddress(addressSource) : null;

    const safeString = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };

    if (typeof listing.location === 'string') {
      listing.location = { address: null, city: geoCity, zipcode: geoZipcode };
    } else if (listing.location && typeof listing.location === 'object') {
      const existingCity = safeString((listing.location as any).city);
      const existingZip = safeString((listing.location as any).zipcode);
      listing.location = {
        ...listing.location,
        city:
          existingCity ??
          safeString(geoCity) ??
          safeString(parsedFromAddress?.city) ??
          null,
        zipcode:
          existingZip ??
          safeString(geoZipcode) ??
          safeString(parsedFromAddress?.zipcode) ??
          null,
        address: null,
        lat: null,
        lng: null,
        hideExact: true
      };
    }

    if (listing.formData && typeof listing.formData === 'object') {
      const geo = (listing.formData as any)._geo;
      if (geo && typeof geo === 'object') {
        (listing.formData as any)._geo = {
          ...geo,
          address: null,
          lat: null,
          lng: null
        };
      }
      if ('location_label' in (listing.formData as any)) {
        (listing.formData as any).location_label = null;
      }
      const fieldsToNull = [
        'lat',
        'lng',
        'latitude',
        'longitude',
        'address',
        'locationLabel',
        'location_label'
      ];
      fieldsToNull.forEach(field => {
        if (field in (listing.formData as any)) {
          (listing.formData as any)[field] = null;
        }
      });
    }
  }

  private parseCityZipFromAddress(address: string): { city: string | null; zipcode: string | null } | null {
    const value = address.trim();
    if (!value) return null;
    const zipMatch = value.match(/\b(\d{4,6})\b/);
    if (!zipMatch) {
      return { city: null, zipcode: null };
    }
    const zipcode = zipMatch[1];
    const afterZip = value.slice(zipMatch.index! + zipcode.length).trim();
    const cityMatch = afterZip.match(/^([A-Za-zÀ-ÖØ-öø-ÿ' -]+)/);
    const city = cityMatch ? cityMatch[1].trim().replace(/,+$/, '') : null;
    return { city: city || null, zipcode };
  }
}
