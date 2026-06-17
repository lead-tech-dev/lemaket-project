
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, Repository } from 'typeorm';
import Stripe from 'stripe';
import { Payment } from './payment.entity';
import { PaymentEvent } from './payment-event.entity';
import { PaymentMethodEntity } from './payment-method.entity';
import { Subscription } from './subscription.entity';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PaymentMethodVerificationStatus } from '../common/enums/payment-method-verification-status.enum';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { RequestProPlanDto, ProPlanRequestMode } from './dto/request-pro-plan.dto';
import { UsersService } from '../users/users.service';
import { Listing } from '../listings/listing.entity';
import { Promotion } from '../promotions/promotion.entity';
import { PromotionStatus } from '../common/enums/promotion-status.enum';
import { PromotionType } from '../common/enums/promotion-type.enum';
import { MtnInitDto } from './dto/mtn-init.dto';
import { OrangeInitDto } from './dto/orange-init.dto';
import { WalletTopupDto } from './dto/wallet-topup.dto';
import { WalletWithdrawDto } from './dto/wallet-withdraw.dto';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { randomUUID } from 'crypto';
import { URL } from 'url';
import { Delivery } from '../deliveries/delivery.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletsService } from './wallets.service';
import { WalletTransactionType } from '../common/enums/wallet-transaction-type.enum';
import { WalletTransaction } from './wallet-transaction.entity';
import { NotificationCategory } from '../notifications/notification-category.enum';
import { DeliveryStatus } from '../common/enums/delivery-status.enum';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { OrdersService } from '../orders/orders.service';
import { MessagesService } from '../messages/messages.service';
import { PaymentMethodType } from '../common/enums/payment-method-type.enum';
import { Category } from '../categories/category.entity';

type CourierCandidate = {
  id: string;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  zipcode?: string | null;
  radiusKm?: number | null;
};

type PromotionOption = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  categories: string[];
  stripePriceId?: string | null;
  isIncluded?: boolean;
  monthlyLimit?: number;
};

type ProPlanOption = {
  id: string;
  name: string;
  price: number;
  currency: string;
  trialDurationDays: number;
  stripePriceId?: string | null;
};

const PROMOTION_ELIGIBLE_CATEGORIES = [
  'emploi',
  'maison',
  'vacances',
  'immobilier',
  'vehicules',
  'multimedia',
  'animaux',
  'loisirs',
  'mode',
  'materiel-professionnel',
  'services',
  'divers'
] as const;

const PROMOTION_ELIGIBLE_CATEGORY_SET = new Set<string>(PROMOTION_ELIGIBLE_CATEGORIES);

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe | null;
  private readonly checkoutSuccessUrl: string;
  private readonly checkoutCancelUrl: string;
  private promotionOptions: PromotionOption[];
  private proPlans: ProPlanOption[];
  private readonly flutterwaveSecretKey: string;
  private readonly flutterwavePublicKey: string;
  private readonly flutterwaveWebhookHash: string;
  private readonly flutterwaveBaseUrl: string;
  private readonly flutterwaveRedirectUrl: string;
  private readonly flutterwaveMomoBankCodes: Record<string, string>;
  private readonly zikopayApiKey: string;
  private readonly zikopayApiSecret: string;
  private readonly zikopayBaseUrl: string;
  private readonly zikopayReturnUrl: string;
  private readonly zikopayCancelUrl: string;
  private readonly zikopayCallbackUrl: string;
  private readonly campayPermanentToken: string;
  private readonly campayBaseUrl: string;
  private readonly campayWebhookKey: string;
  private readonly tranzakAppId: string;
  private readonly tranzakAppKey: string;
  private readonly tranzakBaseUrl: string;
  private readonly tranzakReturnUrl: string;
  private readonly tranzakCallbackUrl: string;
  // Cache du token d'accès Tranzak (valable ~2h) : on le réutilise jusqu'à
  // expiration pour éviter un POST /auth/token à chaque appel.
  private tranzakToken: string | null = null;
  private tranzakTokenExpiresAt = 0;
  // Provider Mobile Money actif (collecte + payout). Carte: toujours Zikopay.
  private readonly momoProvider: 'campay' | 'zikopay' | 'tranzak';
  private readonly zeroDecimalCurrencies = new Set([
    'BIF',
    'CLP',
    'DJF',
    'GNF',
    'JPY',
    'KMF',
    'KRW',
    'MGA',
    'PYG',
    'RWF',
    'UGX',
    'VND',
    'VUV',
    'XAF',
    'XPF'
  ]);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(PaymentEvent)
    private readonly paymentEventsRepository: Repository<PaymentEvent>,
    @InjectRepository(PaymentMethodEntity)
    private readonly paymentMethodsRepository: Repository<PaymentMethodEntity>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Promotion)
    private readonly promotionsRepository: Repository<Promotion>,
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionsRepository: Repository<WalletTransaction>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly walletsService: WalletsService,
    private readonly ordersService: OrdersService,
    private readonly messagesService: MessagesService,
    private readonly configService: ConfigService
  ) {
    const stripeSecret = this.configService.get<string>('payments.stripeSecretKey');
    this.stripe = stripeSecret
      ? new Stripe(stripeSecret, {
          apiVersion: '2024-10-28' as Stripe.LatestApiVersion
        })
      : null;

    this.checkoutSuccessUrl =
      this.configService.get<string>('payments.checkoutSuccessUrl') ??
      'http://localhost:3000/dashboard/payments?status=success&session_id={CHECKOUT_SESSION_ID}';
    this.checkoutCancelUrl =
      this.configService.get<string>('payments.checkoutCancelUrl') ??
      'http://localhost:3000/dashboard/payments?status=cancel&session_id={CHECKOUT_SESSION_ID}';

    const flutterwaveConfig =
      this.configService.get<Record<string, any>>('payments.flutterwave') ?? {};
    this.flutterwaveSecretKey = flutterwaveConfig.secretKey ?? '';
    this.flutterwavePublicKey = flutterwaveConfig.publicKey ?? '';
    this.flutterwaveWebhookHash = flutterwaveConfig.webhookHash ?? '';
    this.flutterwaveBaseUrl = flutterwaveConfig.baseUrl ?? 'https://api.flutterwave.com';
    this.flutterwaveRedirectUrl = flutterwaveConfig.redirectUrl ?? '';
    this.flutterwaveMomoBankCodes = flutterwaveConfig.momoBankCodes ?? {};

    const zikopayConfig =
      this.configService.get<Record<string, any>>('payments.zikopay') ?? {};
    this.zikopayApiKey = zikopayConfig.apiKey ?? '';
    this.zikopayApiSecret = zikopayConfig.apiSecret ?? '';
    this.zikopayBaseUrl = zikopayConfig.baseUrl ?? 'https://api.payment.zikopay.com/v1';
    this.zikopayReturnUrl = zikopayConfig.returnUrl ?? '';
    this.zikopayCancelUrl = zikopayConfig.cancelUrl ?? '';
    this.zikopayCallbackUrl = zikopayConfig.callbackUrl ?? '';
    const campayConfig =
      this.configService.get<Record<string, any>>('payments.campay') ?? {};
    this.campayPermanentToken = campayConfig.permanentToken ?? '';
    this.campayBaseUrl = campayConfig.baseUrl ?? 'https://www.campay.net/api';
    this.campayWebhookKey = campayConfig.webhookKey ?? '';

    const tranzakConfig =
      this.configService.get<Record<string, any>>('payments.tranzak') ?? {};
    this.tranzakAppId = tranzakConfig.appId ?? '';
    this.tranzakAppKey = tranzakConfig.appKey ?? '';
    this.tranzakBaseUrl = tranzakConfig.baseUrl ?? 'https://sandbox.dsapi.tranzak.me';
    this.tranzakReturnUrl = tranzakConfig.returnUrl ?? '';
    this.tranzakCallbackUrl = tranzakConfig.callbackUrl ?? '';

    const configuredMomoProvider = String(
      this.configService.get<string>('payments.momoProvider') ?? 'campay'
    ).toLowerCase();
    this.momoProvider =
      configuredMomoProvider === 'zikopay' || configuredMomoProvider === 'tranzak'
        ? (configuredMomoProvider as 'zikopay' | 'tranzak')
        : 'campay';

    const promotionPriceMap =
      this.configService.get<Record<string, string>>('payments.promotionPriceMap') ?? {};
    this.promotionOptions = [
      {
        id: 'boost-monthly',
        title: 'Boost mensuel inclus',
        description: 'Un boost offert chaque mois pour maintenir votre visibilité.',
        price: 0,
        currency: 'XAF',
        categories: [...PROMOTION_ELIGIBLE_CATEGORIES],
        isIncluded: true,
        monthlyLimit: 1
      },
      {
        id: 'boost-7',
        title: 'Boost 7 jours',
        description: 'Positionnez votre annonce en tête de liste pendant 7 jours.',
        price: 4900,
        currency: 'XAF',
        categories: [...PROMOTION_ELIGIBLE_CATEGORIES],
        stripePriceId: promotionPriceMap['boost-7'] || null
      },
      {
        id: 'boost-14',
        title: 'Boost 14 jours',
        description: 'Gagnez en visibilité pendant deux semaines complètes.',
        price: 8900,
        currency: 'XAF',
        categories: [...PROMOTION_ELIGIBLE_CATEGORIES],
        stripePriceId: promotionPriceMap['boost-14'] || null
      },
      {
        id: 'pack-premium',
        title: 'Pack Premium',
        description: 'Inclut boost, remontées automatiques et badge Premium.',
        price: 14900,
        currency: 'XAF',
        categories: [...PROMOTION_ELIGIBLE_CATEGORIES],
        stripePriceId: promotionPriceMap['pack-premium'] || null
      }
    ];

    const proPlanPriceMap =
      this.configService.get<Record<string, string>>('payments.proPlanPriceMap') ?? {};
    this.proPlans = [
      {
        id: 'starter',
        name: 'Pro Starter',
        price: 5000,
        currency: 'XAF',
        trialDurationDays: 0,
        stripePriceId: proPlanPriceMap.starter || null
      },
      {
        id: 'business',
        name: 'Pro Business',
        price: 10000,
        currency: 'XAF',
        trialDurationDays: 0,
        stripePriceId: proPlanPriceMap.business || null
      },
      {
        id: 'premium',
        name: 'Pro Premium',
        price: 20000,
        currency: 'XAF',
        trialDurationDays: 0,
        stripePriceId: proPlanPriceMap.premium || null
      }
    ];
  }

  private haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  private async notifyNearbyCouriersForDelivery(params: {
    deliveryId: string;
    pickupLat: number;
    pickupLng: number;
    city?: string | null;
    zipcode?: string | null;
  }) {
    const candidates = await this.usersService.listCouriersNearby({
      city: params.city ?? undefined,
      zipcode: params.zipcode ?? undefined,
      limit: 25
    });
    const nearby = (candidates as CourierCandidate[]).filter(courier => {
      if (!courier.lat || !courier.lng) return false;
      const radiusKm =
        typeof courier.radiusKm === 'number' && Number.isFinite(courier.radiusKm)
          ? courier.radiusKm
          : 15;
      return this.haversineKm(
        { lat: params.pickupLat, lng: params.pickupLng },
        { lat: courier.lat, lng: courier.lng }
      ) <= radiusKm;
    });
    await Promise.all(
      nearby.map(courier =>
        this.notificationsService.createNotification({
          userId: courier.id,
          category: NotificationCategory.SYSTEM,
          title: 'Nouvelle course disponible',
          body: 'Une livraison est disponible près de vous.',
          metadata: { deliveryId: params.deliveryId }
        })
      )
    );
  }

  async getPromotionOptions(category?: string) {
    if (!category) {
      return this.promotionOptions;
    }

    const resolvedCategory = await this.resolvePromotionCategoryKey(category);
    if (!resolvedCategory) {
      return [];
    }

    return this.promotionOptions.filter(option =>
      this.resolveOptionCategoryKeys(option).has('all') ||
      this.resolveOptionCategoryKeys(option).has(resolvedCategory)
    );
  }

  private normalizeCategoryToken(raw?: string | null): string {
    if (!raw) {
      return '';
    }
    return raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private resolveCategoryAlias(raw?: string | null): string {
    const normalized = this.normalizeCategoryToken(raw);
    if (!normalized) {
      return '';
    }

    const aliases: Record<string, string> = {
      vehicule: 'vehicules',
      vehicules: 'vehicules',
      voiture: 'vehicules',
      voitures: 'vehicules',
      moto: 'vehicules',
      motos: 'vehicules',
      multimedia: 'multimedia',
      'high-tech': 'multimedia',
      hightech: 'multimedia',
      hitech: 'multimedia',
      loisir: 'loisirs',
      loisirs: 'loisirs',
      mode: 'mode',
      'loisirs-mode': 'loisirs',
      'materiel-professionnel': 'materiel-professionnel',
      materielpro: 'materiel-professionnel',
      service: 'services',
      services: 'services'
    };

    return aliases[normalized] ?? normalized;
  }

  private resolveOptionCategoryKeys(option: PromotionOption): Set<string> {
    const keys = option.categories
      .map(category => this.resolveCategoryAlias(category))
      .filter(Boolean);
    return new Set(keys);
  }

  private async resolvePromotionCategoryKey(category: string): Promise<string | null> {
    const direct = this.resolveCategoryAlias(category);
    if (PROMOTION_ELIGIBLE_CATEGORY_SET.has(direct)) {
      return direct;
    }

    const input = category.trim();
    if (!input) {
      return null;
    }

    const categoryEntity =
      (await this.categoriesRepository.findOne({
        where: { slug: input },
        relations: { parent: true }
      })) ??
      (await this.categoriesRepository.findOne({
        where: { slug: this.normalizeCategoryToken(input) },
        relations: { parent: true }
      })) ??
      (await this.categoriesRepository.findOne({
        where: { name: ILike(input) },
        relations: { parent: true }
      }));

    if (!categoryEntity) {
      return null;
    }

    const candidates = [
      this.resolveCategoryAlias(categoryEntity.slug),
      this.resolveCategoryAlias(categoryEntity.name),
      this.resolveCategoryAlias(categoryEntity.parent?.slug),
      this.resolveCategoryAlias(categoryEntity.parent?.name)
    ].filter(Boolean);

    const match = candidates.find(candidate =>
      PROMOTION_ELIGIBLE_CATEGORY_SET.has(candidate)
    );
    return match ?? null;
  }

  getMethods(user: AuthUser): Promise<PaymentMethodEntity[]> {
    return this.paymentMethodsRepository.find({
      where: { userId: user.id },
      order: { isDefault: 'DESC', created_at: 'DESC' }
    });
  }

  async addMethod(user: AuthUser, dto: CreatePaymentMethodDto): Promise<PaymentMethodEntity> {
    const provider = this.normalizeMethodProvider(dto.type, dto.provider, false);
    const holderName = this.normalizeText(dto.holderName);
    const externalId = this.normalizeMethodExternalId(dto.type, provider, dto.externalId, true);

    if (dto.isDefault) {
      await this.paymentMethodsRepository.update({ userId: user.id }, { isDefault: false });
    }

    const labelFromInput = this.normalizeText(dto.label);
    const method = this.paymentMethodsRepository.create({
      ...dto,
      provider,
      holderName,
      externalId,
      label: labelFromInput ?? this.buildMethodLabel({ ...dto, provider }),
      verificationStatus: this.resolveInitialVerificationStatus(dto),
      userId: user.id
    });

    if (!dto.isDefault) {
      const existingDefault = await this.paymentMethodsRepository.findOne({
        where: { userId: user.id, isDefault: true }
      });
      if (!existingDefault) {
        method.isDefault = true;
      }
    }

    return this.paymentMethodsRepository.save(method);
  }

  async updateMethod(
    id: string,
    user: AuthUser,
    dto: UpdatePaymentMethodDto
  ): Promise<PaymentMethodEntity> {
    const method = await this.findMethod(id, user);
    const nextType = dto.type ?? method.type;
    const provider = this.normalizeMethodProvider(nextType, dto.provider ?? method.provider, false);
    const holderName = this.normalizeText(dto.holderName ?? method.holderName);
    const externalId =
      dto.externalId !== undefined
        ? this.normalizeMethodExternalId(nextType, provider, dto.externalId, false)
        : method.externalId;

    if (dto.isDefault) {
      await this.paymentMethodsRepository.update({ userId: user.id }, { isDefault: false });
    }

    const labelFromInput =
      dto.label !== undefined
        ? this.normalizeText(dto.label)
        : this.normalizeText(method.label);

    Object.assign(method, {
      ...dto,
      type: nextType,
      provider,
      holderName,
      externalId,
      label:
        labelFromInput ??
        this.buildMethodLabel({
          type: nextType,
          brand: dto.brand ?? method.brand,
          last4: dto.last4 ?? method.last4,
          provider
        })
    });

    return this.paymentMethodsRepository.save(method);
  }

  async removeMethod(id: string, user: AuthUser): Promise<void> {
    const method = await this.findMethod(id, user);
    const wasDefault = method.isDefault;
    await this.paymentMethodsRepository.remove(method);

    if (wasDefault) {
      const fallback = await this.paymentMethodsRepository.findOne({
        where: { userId: user.id },
        order: { created_at: 'DESC' }
      });
      if (fallback) {
        fallback.isDefault = true;
        await this.paymentMethodsRepository.save(fallback);
      }
    }
  }

  private async findMethod(id: string, user: AuthUser): Promise<PaymentMethodEntity> {
    const method = await this.paymentMethodsRepository.findOne({
      where: { id, userId: user.id }
    });

    if (!method) {
      throw new NotFoundException('Payment method not found.');
    }

    return method;
  }

  private normalizeText(value?: string | null): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private normalizeMethodProvider(
    type: PaymentMethodType,
    provider?: string | null,
    requireIfWallet = false
  ): string | undefined {
    const normalized = this.normalizeText(provider)?.toLowerCase();
    if (type !== PaymentMethodType.WALLET) {
      return normalized;
    }

    if (!normalized) {
      if (requireIfWallet) {
        throw new BadRequestException('Opérateur Mobile Money requis.');
      }
      return undefined;
    }

    if (!['mtn', 'orange'].includes(normalized)) {
      throw new BadRequestException('Opérateur Mobile Money invalide. Utilisez MTN ou Orange.');
    }

    return normalized;
  }

  private normalizeMethodExternalId(
    type: PaymentMethodType,
    provider: string | undefined,
    externalId?: string | null,
    requireIfWallet = false
  ): string | undefined {
    if (type !== PaymentMethodType.WALLET) {
      return this.normalizeText(externalId);
    }

    const normalized = this.normalizeText(externalId);
    if (!normalized) {
      if (requireIfWallet) {
        throw new BadRequestException('Numéro Mobile Money requis.');
      }
      return undefined;
    }
    return this.normalizeCameroonMobileNumber(normalized, provider);
  }

  private normalizeCameroonMobileNumber(raw: string, provider?: string): string {
    const digits = raw.replace(/\D/g, '');
    const local = digits.startsWith('237') ? digits.slice(3) : digits;
    if (!/^6\d{8}$/.test(local)) {
      throw new BadRequestException(
        'Numéro camerounais invalide. Format attendu: +2376XXXXXXXX.'
      );
    }
    const normalizedProvider = provider?.toLowerCase();
    if (
      normalizedProvider === 'mtn' &&
      !this.isProviderPhonePrefixMatch(normalizedProvider, local)
    ) {
      throw new BadRequestException(
        'Numéro MTN invalide. Utilisez un numéro MTN Cameroon.'
      );
    }
    if (
      normalizedProvider === 'orange' &&
      !this.isProviderPhonePrefixMatch(normalizedProvider, local)
    ) {
      throw new BadRequestException(
        'Numéro Orange Money invalide. Utilisez un numéro Orange Cameroon.'
      );
    }
    return `+237${local}`;
  }

  private isProviderPhonePrefixMatch(
    provider: 'mtn' | 'orange',
    localNumber: string
  ): boolean {
    if (provider === 'mtn') {
      return /^(65[0-4]|67\d|68\d)\d{6}$/.test(localNumber);
    }
    return /^(65[5-9]|69\d)\d{6}$/.test(localNumber);
  }

  private async ensureListingEligibleForPromotion(
    listing: Listing | null,
    user: AuthUser,
    option: PromotionOption
  ): Promise<Listing> {
    if (!listing || listing.owner?.id !== user.id) {
      throw new NotFoundException('Annonce introuvable ou non autorisée.');
    }

    if (listing.status !== ListingStatus.PUBLISHED) {
      throw new BadRequestException('Seules les annonces publiées peuvent être promues.');
    }

    const allowedCategories = this.resolveOptionCategoryKeys(option);
    if (allowedCategories.has('all')) {
      return listing;
    }

    const listingCategoryKeys = await this.resolveListingPromotionCategoryKeys(listing);
    const matchesCategory = Array.from(listingCategoryKeys).some(key =>
      allowedCategories.has(key)
    );
    if (!matchesCategory) {
      throw new BadRequestException(
        'Cette annonce ne correspond pas aux catégories autorisées pour cette promotion.'
      );
    }

    return listing;
  }

  private async resolveListingPromotionCategoryKeys(listing: Listing): Promise<Set<string>> {
    const keys = new Set<string>();

    const addKey = (value?: string | null) => {
      const normalized = this.resolveCategoryAlias(value);
      if (normalized) {
        keys.add(normalized);
      }
    };

    addKey(listing.category?.slug);
    addKey(listing.category?.name);

    const categoryId = listing.category?.id;
    if (categoryId) {
      const category = await this.categoriesRepository.findOne({
        where: { id: categoryId },
        relations: { parent: true }
      });
      addKey(category?.slug);
      addKey(category?.name);
      addKey(category?.parent?.slug);
      addKey(category?.parent?.name);
    }

    return keys;
  }

  private ensurePromotionPaymentMethodUsable(method: PaymentMethodEntity): void {
    if (method.verificationStatus === PaymentMethodVerificationStatus.FAILED) {
      throw new BadRequestException(
        'Cette méthode de paiement a échoué à la vérification. Merci d’en ajouter une autre.'
      );
    }

    if (
      method.type === PaymentMethodType.CARD &&
      method.verificationStatus !== PaymentMethodVerificationStatus.VERIFIED
    ) {
      throw new BadRequestException(
        'La carte doit être vérifiée avant utilisation.'
      );
    }
  }

  private extractPromotionError(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return 'promotion_checkout_failed';
  }

  async beginVerification(id: string, user: AuthUser) {
    const method = await this.findMethod(id, user);
    method.verificationStatus = PaymentMethodVerificationStatus.PENDING;
    await this.paymentMethodsRepository.save(method);
    return {
      redirectUrl: `https://payments.example.com/verify/${method.id}`
    };
  }

  async confirmVerification(id: string, user: AuthUser, success: boolean) {
    const method = await this.findMethod(id, user);
    method.verificationStatus = success
      ? PaymentMethodVerificationStatus.VERIFIED
      : PaymentMethodVerificationStatus.FAILED;
    method.verifiedAt = success ? new Date() : null;
    await this.paymentMethodsRepository.save(method);

    if (!success) {
      throw new ForbiddenException('La vérification a échoué.');
    }

    return method;
  }

  getPayments(user: AuthUser): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { userId: user.id },
      relations: { paymentMethod: true },
      order: { created_at: 'DESC' }
    });
  }

  async getInvoice(user: AuthUser, invoiceId: string) {
    const invoice = await this.paymentsRepository.findOne({
      where: { id: invoiceId, userId: user.id },
      relations: { paymentMethod: true }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    return {
      invoice,
      downloadUrl: invoice.invoiceUrl ?? `https://payments.example.com/invoices/${invoice.id}.pdf`
    };
  }

  async createPayment(
    user: AuthUser,
    dto: CreatePaymentDto
  ): Promise<{
    paymentId: string;
    redirectUrl: string | null;
    sessionId?: string;
  }> {
    const option = this.promotionOptions.find(item => item.id === dto.optionId);
    if (!option) {
      throw new NotFoundException('Option de promotion introuvable.');
    }

    const listingCandidate = await this.listingsRepository.findOne({
      where: { id: dto.listingId }
    });
    const listing = await this.ensureListingEligibleForPromotion(listingCandidate, user, option);
    await this.ensureMonthlyPromotionEligibility(user, option);

    const isIncluded = this.isIncludedPromotion(option) || option.price <= 0;

    if (isIncluded) {
      const payment = await this.paymentsRepository.save(
        this.paymentsRepository.create({
          amount: option.price.toFixed(2),
          currency: option.currency,
          description: `Promotion – ${option.title}`,
          status: PaymentStatus.PENDING,
          provider: 'internal',
          userId: user.id,
          paymentMethodId: null,
          externalReference: null,
          metadata: {
            listingId: listing.id,
            promotionOptionId: option.id,
            paymentMode: 'included',
            promotionApplied: false
          }
        })
      );
      try {
        await this.applyPromotionForPayment(payment, user);
        payment.status = PaymentStatus.COMPLETED;
        payment.invoiceNumber = payment.invoiceNumber ?? payment.id;
        payment.externalReference = 'included';
        await this.paymentsRepository.save(payment);
        return {
          paymentId: payment.id,
          redirectUrl: null
        };
      } catch (error) {
        payment.status = PaymentStatus.FAILED;
        payment.metadata = {
          ...(payment.metadata ?? {}),
          promotionApplied: false,
          promotionError: this.extractPromotionError(error)
        };
        await this.paymentsRepository.save(payment);
        throw error;
      }
    }

    if (!dto.paymentMethodId) {
      throw new BadRequestException('Moyen de paiement requis pour cette promotion.');
    }

    const paymentMethod = await this.findMethod(dto.paymentMethodId, user);
    this.ensurePromotionPaymentMethodUsable(paymentMethod);

    if (paymentMethod.type === PaymentMethodType.WALLET) {
      const provider = paymentMethod.provider?.toLowerCase();
      if (provider !== 'mtn' && provider !== 'orange') {
        throw new BadRequestException(
          'Le paiement via solde wallet est désactivé en V1. Utilisez MTN ou Orange Mobile Money.'
        );
      }
      if (!paymentMethod.externalId) {
        throw new BadRequestException(
          'Numéro Mobile Money requis pour lancer le paiement de la promotion.'
        );
      }

      const checkout = await this.initEscrowPayment({
        user,
        amount: option.price,
        currency: option.currency,
        description: `Promotion – ${option.title}`,
        listingId: listing.id,
        paymentMethod: 'mobile_money',
        paymentOperator: provider,
        paymentPhone: paymentMethod.externalId,
        extraMeta: {
          type: 'promotion',
          listingId: listing.id,
          promotionOptionId: option.id,
          paymentMode: 'mobile_money',
          promotionApplied: false
        }
      });

      await this.paymentsRepository.update(
        { id: checkout.paymentId },
        { paymentMethodId: paymentMethod.id }
      );

      return {
        paymentId: checkout.paymentId,
        redirectUrl: checkout.paymentUrl ?? null
      };
    }

    if (paymentMethod.type !== PaymentMethodType.CARD) {
      throw new BadRequestException(
        "Ce moyen de paiement n'est pas supporté pour une promotion."
      );
    }

    if (!this.stripe) {
      throw new ServiceUnavailableException('Le paiement par carte est indisponible pour le moment.');
    }

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        amount: option.price.toFixed(2),
        currency: option.currency,
        description: `Promotion – ${option.title}`,
        status: PaymentStatus.PENDING,
        provider: 'stripe',
        userId: user.id,
        paymentMethodId: paymentMethod.id,
        externalReference: null,
        metadata: {
          listingId: listing.id,
          promotionOptionId: option.id,
          paymentMode: 'card',
          promotionApplied: false
        }
      })
    );

    const stripe = this.requireStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: this.checkoutSuccessUrl,
      cancel_url: this.checkoutCancelUrl,
      customer_email: user.email,
      line_items: [this.buildPromotionLineItem(option)],
      metadata: {
        paymentId: payment.id,
        userId: user.id,
        listingId: listing.id,
        promotionOptionId: option.id
      },
      payment_intent_data: {
        metadata: {
          paymentId: payment.id,
          promotionOptionId: option.id
        }
      }
    });

    payment.externalReference = session.id;
    await this.paymentsRepository.save(payment);

    return {
      paymentId: payment.id,
      sessionId: session.id,
      redirectUrl: session.url ?? null
    };
  }

  async requestProPlan(
    user: AuthUser,
    dto: RequestProPlanDto
  ): Promise<{
    redirectUrl: string | null;
    sessionId?: string;
    subscriptionId?: string;
    nextRenewalAt?: string | null;
  }> {
    const plan = this.proPlans.find(item => item.id === dto.planId);
    if (!plan) {
      throw new NotFoundException('Requested PRO plan was not found.');
    }

    if (dto.mode === ProPlanRequestMode.TRIAL && plan.trialDurationDays <= 0) {
      throw new BadRequestException('Cette offre ne propose pas de période d’essai.');
    }

    if (this.stripe && plan.stripePriceId) {
      const trialPeriod =
        dto.mode === ProPlanRequestMode.TRIAL && plan.trialDurationDays > 0
          ? plan.trialDurationDays
          : undefined;

      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: this.checkoutSuccessUrl,
        cancel_url: this.checkoutCancelUrl,
        customer_email: user.email,
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1
          }
        ],
        metadata: {
          planId: plan.id,
          mode: dto.mode,
          userId: user.id
        },
        subscription_data: {
          trial_period_days: trialPeriod,
          metadata: {
            planId: plan.id,
            mode: dto.mode,
            userId: user.id
          }
        }
      });

      return {
        redirectUrl: session.url ?? null,
        sessionId: session.id,
        nextRenewalAt: null
      };
    }

    const existing = await this.subscriptionsRepository.findOne({
      where: {
        userId: user.id,
        planName: plan.name,
        status: SubscriptionStatus.ACTIVE
      }
    });

    if (existing) {
      if (dto.mode === ProPlanRequestMode.TRIAL) {
        if (!existing.autoRenew) {
          throw new BadRequestException('Vous profitez déjà de cette période d’essai.');
        }
        throw new BadRequestException('Vous disposez déjà de cette offre.');
      }

      if (dto.mode === ProPlanRequestMode.SUBSCRIBE) {
        if (existing.autoRenew) {
          throw new BadRequestException('Vous disposez déjà de cette offre.');
        }

        existing.autoRenew = true;
        existing.amount = plan.price.toFixed(2);
        existing.currency = plan.currency;
        existing.description = `Abonnement ${plan.name}`;
        existing.nextRenewalAt = this.computeNextRenewalDate(30);
        const updated = await this.subscriptionsRepository.save(existing);
        await this.usersService.setProStatus(user.id, updated.nextRenewalAt ?? undefined);
        return {
          redirectUrl: null,
          subscriptionId: updated.id,
          nextRenewalAt: updated.nextRenewalAt?.toISOString() ?? null
        };
      }
    }

    const subscription = this.subscriptionsRepository.create({
      userId: user.id,
      planName: plan.name,
      amount:
        dto.mode === ProPlanRequestMode.TRIAL
          ? '0.00'
          : plan.price.toFixed(2),
      currency: plan.currency,
      status: SubscriptionStatus.ACTIVE,
      autoRenew: dto.mode === ProPlanRequestMode.SUBSCRIBE,
      description:
        dto.mode === ProPlanRequestMode.TRIAL
          ? `Essai ${plan.name}`
          : `Abonnement ${plan.name}`,
      nextRenewalAt:
        dto.mode === ProPlanRequestMode.SUBSCRIBE
          ? this.computeNextRenewalDate(30)
          : plan.trialDurationDays > 0
          ? this.computeNextRenewalDate(plan.trialDurationDays)
          : null
    });

    const saved = await this.subscriptionsRepository.save(subscription);
    await this.usersService.setProStatus(user.id, saved.nextRenewalAt ?? undefined);
    return {
      redirectUrl: null,
      subscriptionId: saved.id,
      nextRenewalAt: saved.nextRenewalAt?.toISOString() ?? null
    };
  }

  async finalizeCheckoutSession(
    user: AuthUser,
    sessionId: string
  ): Promise<{
    sessionId: string;
    mode: Stripe.Checkout.Session.Mode;
    paymentStatus: Stripe.Checkout.Session.PaymentStatus | null | undefined;
    paymentId?: string | null;
    subscriptionId?: string | null;
    subscriptionStatus?: SubscriptionStatus | null;
  }> {
    const stripe = this.requireStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'subscription']
    });

    if (!session) {
      throw new NotFoundException('Session Stripe introuvable.');
    }

    if (session.metadata?.userId && session.metadata.userId !== user.id) {
      throw new ForbiddenException('Session Stripe non autorisée.');
    }

    let paymentId: string | null = null;
    let subscriptionId: string | null = null;
    let subscriptionStatus: SubscriptionStatus | null = null;

    if (session.mode === 'payment') {
      const metadataPaymentId = session.metadata?.paymentId;
      if (metadataPaymentId) {
        const payment = await this.paymentsRepository.findOne({
          where: { id: metadataPaymentId, userId: user.id }
        });
        if (payment) {
          const stripeStatus = this.mapStripePaymentStatus(session.payment_status);
          if (stripeStatus) {
            payment.status = stripeStatus;
          }
          if (session.payment_intent) {
            if (typeof session.payment_intent === 'string') {
              payment.externalReference = session.payment_intent;
            } else {
              const intent = session.payment_intent as Stripe.PaymentIntent;
              payment.externalReference = intent.id;
              const intentWithCharges = intent as Stripe.PaymentIntent & {
                charges?: Stripe.ApiList<Stripe.Charge>;
              };
              const charge = intentWithCharges.charges?.data?.[0];
              if (charge?.receipt_url) {
                payment.invoiceUrl = charge.receipt_url;
              }
              if (charge?.id) {
                payment.invoiceNumber = charge.id;
              }
            }
          }
          await this.paymentsRepository.save(payment);
          if (payment.status === PaymentStatus.COMPLETED) {
            try {
              await this.applyPromotionForPayment(payment, user);
            } catch (error) {
              payment.status = PaymentStatus.PENDING;
              payment.metadata = {
                ...(payment.metadata ?? {}),
                promotionApplied: false,
                promotionError: this.extractPromotionError(error)
              };
              await this.paymentsRepository.save(payment);
              throw new ServiceUnavailableException(
                'Paiement confirmé, mais la promotion n’a pas encore pu être activée. Réessayez dans quelques secondes.'
              );
            }
          }
          paymentId = payment.id;
        }
      }
    } else if (session.mode === 'subscription' && session.subscription) {
      const subscription = await this.handleStripeSubscription(user, session);
      if (subscription) {
        subscriptionId = subscription.id;
        subscriptionStatus = subscription.status;
      }
    }

    return {
      sessionId: session.id,
      mode: session.mode,
      paymentStatus: session.payment_status,
      paymentId,
      subscriptionId,
      subscriptionStatus
    };
  }

  async getSubscriptions(user: AuthUser): Promise<Subscription[]> {
    return this.subscriptionsRepository.find({
      where: { userId: user.id },
      relations: { paymentMethod: true },
      order: { created_at: 'DESC' }
    });
  }

  async cancelSubscription(id: string, user: AuthUser): Promise<Subscription> {
    const subscription = await this.findSubscription(id, user);
    subscription.status = SubscriptionStatus.CANCELED;
    subscription.autoRenew = false;
    return this.subscriptionsRepository.save(subscription);
  }

  async resumeSubscription(id: string, user: AuthUser): Promise<Subscription> {
    const subscription = await this.findSubscription(id, user);
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.autoRenew = true;
    subscription.nextRenewalAt =
      subscription.nextRenewalAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return this.subscriptionsRepository.save(subscription);
  }

  async recordRenewal(user: AuthUser, subscriptionId: string) {
    const subscription = await this.findSubscription(subscriptionId, user);
    subscription.nextRenewalAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return this.subscriptionsRepository.save(subscription);
  }

  private buildPromotionLineItem(
    option: PromotionOption
  ): Stripe.Checkout.SessionCreateParams.LineItem {
    if (option.stripePriceId) {
      return {
        price: option.stripePriceId,
        quantity: 1
      };
    }
    return {
      price_data: {
        currency: option.currency.toLowerCase(),
        product_data: {
          name: option.title,
          description: option.description
        },
        unit_amount: this.resolveUnitAmount(option.currency, option.price)
      },
      quantity: 1
    };
  }

  private resolvePromotionDefinition(optionId: string): {
    type: PromotionType;
    durationDays: number;
    autoBumpIntervalHours?: number | null;
    enableBoost: boolean;
    enableFeatured: boolean;
    enablePremiumBadge: boolean;
  } | null {
    if (optionId.toLowerCase() === 'boost-monthly') {
      return {
        type: PromotionType.BOOST,
        durationDays: 7,
        autoBumpIntervalHours: null,
        enableBoost: true,
        enableFeatured: false,
        enablePremiumBadge: false
      };
    }
    const boostMatch = optionId.match(/^boost-(\d+)$/i);
    if (boostMatch) {
      const durationDays = Number(boostMatch[1]) || 7;
      return {
        type: PromotionType.BOOST,
        durationDays,
        autoBumpIntervalHours: durationDays >= 14 ? 24 * 7 : null,
        enableBoost: true,
        enableFeatured: false,
        enablePremiumBadge: false
      };
    }
    if (optionId.toLowerCase().includes('premium')) {
      return {
        type: PromotionType.PREMIUM,
        durationDays: 30,
        autoBumpIntervalHours: 24,
        enableBoost: true,
        enableFeatured: true,
        enablePremiumBadge: true
      };
    }
    if (optionId.toLowerCase().includes('featured')) {
      return {
        type: PromotionType.FEATURED,
        durationDays: 7,
        autoBumpIntervalHours: null,
        enableBoost: false,
        enableFeatured: true,
        enablePremiumBadge: false
      };
    }
    if (optionId.toLowerCase().includes('highlight')) {
      return {
        type: PromotionType.HIGHLIGHT,
        durationDays: 7,
        autoBumpIntervalHours: 24 * 3,
        enableBoost: true,
        enableFeatured: false,
        enablePremiumBadge: false
      };
    }
    return null;
  }

  private isIncludedPromotion(option: PromotionOption): boolean {
    return option.isIncluded === true || option.price <= 0;
  }

  private async ensureMonthlyPromotionEligibility(
    user: AuthUser,
    option: PromotionOption
  ): Promise<void> {
    if (!option.monthlyLimit || option.monthlyLimit <= 0) {
      return;
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const used = await this.paymentsRepository
      .createQueryBuilder('payment')
      .where('payment.user_id = :userId', { userId: user.id })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere("payment.metadata ->> 'promotionOptionId' = :optionId", { optionId: option.id })
      .andWhere('payment.created_at >= :since', { since: since.toISOString() })
      .getCount();

    if (used >= option.monthlyLimit) {
      throw new BadRequestException('Votre boost mensuel est déjà utilisé pour ce mois-ci.');
    }
  }

  private async applyPromotionForPayment(
    payment: Payment,
    user: AuthUser
  ): Promise<void> {
    const metadata = payment.metadata ?? {};
    if (metadata.promotionApplied === true) {
      return;
    }
    const listingId = typeof metadata.listingId === 'string' ? metadata.listingId : null;
    const optionId = typeof metadata.promotionOptionId === 'string' ? metadata.promotionOptionId : null;
    if (!listingId || !optionId) {
      throw new BadRequestException('Métadonnées de promotion invalides pour ce paiement.');
    }

    const option = this.promotionOptions.find(item => item.id === optionId);
    const definition = option ? this.resolvePromotionDefinition(option.id) : null;
    if (!option || !definition) {
      throw new NotFoundException('Option de promotion introuvable pour ce paiement.');
    }

    const listingCandidate = await this.listingsRepository.findOne({
      where: { id: listingId },
      relations: { owner: true }
    });
    const listing = await this.ensureListingEligibleForPromotion(listingCandidate, user, option);

    const now = new Date();
    const endDate = new Date(now.getTime() + definition.durationDays * 24 * 60 * 60 * 1000);
    const nextAutoBumpAt =
      definition.autoBumpIntervalHours && definition.autoBumpIntervalHours > 0
        ? new Date(now.getTime() + definition.autoBumpIntervalHours * 60 * 60 * 1000)
        : null;

    const promotion = await this.promotionsRepository.save(
      this.promotionsRepository.create({
        name: option.title,
        type: definition.type,
        status: PromotionStatus.ACTIVE,
        paymentStatus: 'paid',
        paymentId: payment.id,
        startDate: now,
        endDate,
        budget: option.price.toFixed(2),
        description: option.description,
        sourceOptionId: option.id,
        autoBumpIntervalHours:
          definition.autoBumpIntervalHours && definition.autoBumpIntervalHours > 0
            ? definition.autoBumpIntervalHours
            : null,
        nextAutoBumpAt,
        listingId: listing.id
      })
    );

    const shouldBoost = definition.enableBoost;
    const shouldFeature = definition.enableFeatured;
    const shouldPremium = definition.enablePremiumBadge;

    if (shouldBoost || shouldFeature || shouldPremium) {
      listing.isBoosted = listing.isBoosted || shouldBoost;
      listing.isFeatured = listing.isFeatured || shouldFeature;
      listing.isPremium = listing.isPremium || shouldPremium;
      // Une promotion active doit immédiatement remonter l'annonce dans les tris récents.
      listing.publishedAt = now;
      await this.listingsRepository.save(listing);
    }

    payment.metadata = {
      ...metadata,
      promotionApplied: true,
      promotionId: promotion.id,
      promotionType: definition.type,
      promotionEndsAt: endDate.toISOString()
    };
    await this.paymentsRepository.save(payment);
  }

  private resolveUnitAmount(currency: string, amount: number): number {
    const normalized = currency.toUpperCase();
    if (this.zeroDecimalCurrencies.has(normalized)) {
      return Math.round(amount);
    }
    return Math.round(amount * 100);
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe est indisponible, configuration manquante.');
    }
    return this.stripe;
  }

  private mapStripePaymentStatus(
    status: Stripe.Checkout.Session.PaymentStatus | null | undefined
  ): PaymentStatus | null {
    if (!status) {
      return null;
    }
    switch (status) {
      case 'paid':
      case 'no_payment_required':
        return PaymentStatus.COMPLETED;
      case 'unpaid':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  private async handleStripeSubscription(
    user: AuthUser,
    session: Stripe.Checkout.Session
  ): Promise<Subscription | null> {
    const stripe = this.requireStripe();
    const subscriptionData =
      typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : (session.subscription as Stripe.Subscription);

    const planId =
      session.metadata?.planId ??
      subscriptionData.metadata?.planId ??
      subscriptionData.items.data[0]?.price?.lookup_key ??
      null;
    const plan = planId ? this.proPlans.find(item => item.id === planId) : undefined;

    const price = subscriptionData.items.data[0]?.price;
    const amount = price?.unit_amount ?? 0;
    const currency = price?.currency ?? plan?.currency ?? 'xaf';

    let entity = await this.subscriptionsRepository.findOne({
      where: {
        userId: user.id,
        externalId: subscriptionData.id
      }
    });

    const amountValue = this.formatAmountFromStripe(amount, currency);
    const nextRenewal = subscriptionData.current_period_end
      ? new Date(subscriptionData.current_period_end * 1000)
      : null;
    const status = this.mapStripeSubscriptionStatus(subscriptionData.status);

    if (!entity) {
      entity = this.subscriptionsRepository.create({
        userId: user.id,
        planName: plan?.name ?? price?.nickname ?? 'Abonnement PRO',
        amount: amountValue,
        currency: currency.toUpperCase(),
        status,
        autoRenew: !subscriptionData.cancel_at_period_end,
        nextRenewalAt: nextRenewal,
        description: `Abonnement ${plan?.name ?? 'PRO'} via Stripe`,
        externalId: subscriptionData.id
      });
    } else {
      entity.planName = plan?.name ?? entity.planName;
      entity.amount = amountValue;
      entity.currency = currency.toUpperCase();
      entity.status = status;
      entity.autoRenew = !subscriptionData.cancel_at_period_end;
      entity.nextRenewalAt = nextRenewal;
      entity.description = `Abonnement ${plan?.name ?? 'PRO'} via Stripe`;
    }

    const saved = await this.subscriptionsRepository.save(entity);
    await this.usersService.setProStatus(user.id, saved.nextRenewalAt ?? undefined);
    return saved;
  }

  private formatAmountFromStripe(unitAmount: number, currency: string): string {
    if (this.zeroDecimalCurrencies.has(currency.toUpperCase())) {
      return Number(unitAmount).toFixed(2);
    }
    return (unitAmount / 100).toFixed(2);
  }

  private mapStripeSubscriptionStatus(
    status: Stripe.Subscription.Status
  ): SubscriptionStatus {
    switch (status) {
      case 'active':
      case 'trialing':
        return SubscriptionStatus.ACTIVE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'unpaid':
      case 'past_due':
      case 'incomplete':
      case 'incomplete_expired':
        return SubscriptionStatus.PAUSED;
      default:
        return SubscriptionStatus.ACTIVE;
    }
  }

  private async findSubscription(id: string, user: AuthUser): Promise<Subscription> {
    const subscription = await this.subscriptionsRepository.findOne({
      where: { id, userId: user.id },
      relations: { paymentMethod: true }
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }

    return subscription;
  }

  private buildMethodLabel(dto: Pick<CreatePaymentMethodDto, 'type' | 'brand' | 'last4' | 'provider'>): string {
    if (dto.type === 'card') {
      return `${dto.brand ?? 'Carte'} ${dto.last4 ? `**** ${dto.last4}` : ''}`.trim();
    }
    if (dto.type === 'wallet') {
      const provider = dto.provider?.toLowerCase();
      if (provider === 'orange') {
        return 'Orange Money';
      }
      if (provider === 'mtn') {
        return 'MTN Mobile Money';
      }
      return 'Portefeuille mobile';
    }
    if (dto.type === 'transfer') {
      return 'Virement bancaire';
    }
    return dto.type;
  }

  private resolveInitialVerificationStatus(dto: CreatePaymentMethodDto): PaymentMethodVerificationStatus {
    if (dto.type === 'card') {
      return PaymentMethodVerificationStatus.PENDING;
    }
    return PaymentMethodVerificationStatus.NOT_REQUIRED;
  }

  private async logPaymentEvent(input: {
    paymentId?: string | null;
    provider?: string | null;
    type: string;
    status?: string | null;
    payload?: Record<string, unknown> | null;
  }) {
    await this.paymentEventsRepository.save(
      this.paymentEventsRepository.create({
        paymentId: input.paymentId ?? null,
        provider: input.provider ?? null,
        type: input.type,
        status: input.status ?? null,
        payload: input.payload ?? null
      })
    );
  }

  private resolveFlutterwavePaymentOptions(
    paymentMethod: 'mobile_money' | 'card' | undefined,
    currency: string
  ): string | null {
    if (!paymentMethod) {
      return null;
    }
    if (paymentMethod === 'card') {
      return 'card';
    }
    return currency.toUpperCase() === 'XAF' ? 'mobilemoneyfranco' : 'mobilemoney';
  }

  async initFlutterwaveEscrowPayment(params: {
    user: AuthUser;
    amount: number;
    currency: string;
    description: string;
    deliveryId?: string | null;
    listingId: string;
    redirectUrl?: string | null;
    paymentMethod?: 'mobile_money' | 'card';
    extraMeta?: Record<string, unknown>;
  }): Promise<{ paymentId: string; paymentUrl: string; txRef: string }> {
    if (!this.flutterwaveSecretKey || !this.flutterwavePublicKey) {
      throw new ServiceUnavailableException('Configuration Flutterwave manquante.');
    }

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        amount: params.amount.toFixed(2),
        currency: params.currency,
        description: params.description,
        status: PaymentStatus.PENDING,
        userId: params.user.id,
        provider: 'flutterwave',
        metadata: {
          deliveryId: params.deliveryId ?? null,
          listingId: params.listingId,
          type: params.extraMeta?.type ?? 'escrow',
          ...params.extraMeta
        }
      })
    );

    const txRef = `escrow_${payment.id}`;
    const redirectUrl =
      params.redirectUrl ||
      this.flutterwaveRedirectUrl ||
      this.checkoutSuccessUrl.replace('{CHECKOUT_SESSION_ID}', txRef);
    const account = await this.usersService.findOne(params.user.id);
    const paymentOptions = this.resolveFlutterwavePaymentOptions(params.paymentMethod, params.currency);
    const payload = {
      tx_ref: txRef,
      amount: params.amount,
      currency: params.currency,
      redirect_url: redirectUrl,
      ...(paymentOptions ? { payment_options: paymentOptions } : {}),
      customer: {
        email: account.email,
        phonenumber: account.phoneNumber ?? '',
        name: account.firstName ? `${account.firstName} ${account.lastName ?? ''}`.trim() : account.email
      },
      meta: {
        paymentId: payment.id,
        deliveryId: params.deliveryId ?? null,
        listingId: params.listingId,
        type: params.extraMeta?.type ?? 'escrow',
        paymentMethod: params.paymentMethod ?? null,
        ...params.extraMeta
      },
      customizations: {
        title: 'Paiement sécurisé',
        description: params.description
      }
    };

    const response = await this.postFlutterwave('/v3/payments', payload);
    if (response?.status !== 'success' || !response?.data?.link) {
      throw new ServiceUnavailableException('Impossible de lancer le paiement Flutterwave.');
    }

    payment.externalReference = txRef;
    payment.metadata = {
      ...(payment.metadata ?? {}),
      flutterwaveLink: response.data.link,
      flutterwaveTransactionId: response.data?.id ?? null
    };
    await this.paymentsRepository.save(payment);
    await this.logPaymentEvent({
      paymentId: payment.id,
      provider: 'flutterwave',
      type: 'escrow_init',
      status: response?.status ?? null,
      payload: response?.data ?? response
    });

    return { paymentId: payment.id, paymentUrl: response.data.link, txRef };
  }

  async initFlutterwaveInlineEscrowPayment(params: {
    user: AuthUser;
    amount: number;
    currency: string;
    description: string;
    deliveryId?: string | null;
    listingId: string;
    paymentMethod?: 'mobile_money' | 'card';
    extraMeta?: Record<string, unknown>;
  }): Promise<{
    paymentId: string;
    txRef: string;
    publicKey: string;
    amount: number;
    currency: string;
    paymentOptions: string | null;
    customer: { email: string; phonenumber: string; name: string };
    customizations: { title: string; description: string };
  }> {
    if (!this.flutterwaveSecretKey || !this.flutterwavePublicKey) {
      throw new ServiceUnavailableException('Configuration Flutterwave manquante.');
    }

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        amount: params.amount.toFixed(2),
        currency: params.currency,
        description: params.description,
        status: PaymentStatus.PENDING,
        userId: params.user.id,
        provider: 'flutterwave',
        metadata: {
          deliveryId: params.deliveryId ?? null,
          listingId: params.listingId,
          type: params.extraMeta?.type ?? 'escrow',
          ...params.extraMeta
        }
      })
    );

    const txRef = `escrow_${payment.id}`;
    const account = await this.usersService.findOne(params.user.id);
    const customer = {
      email: account.email,
      phonenumber: account.phoneNumber ?? '',
      name: account.firstName ? `${account.firstName} ${account.lastName ?? ''}`.trim() : account.email
    };
    const paymentOptions = this.resolveFlutterwavePaymentOptions(params.paymentMethod, params.currency);

    payment.externalReference = txRef;
    payment.metadata = {
      ...(payment.metadata ?? {}),
      flutterwaveInline: true
    };
    await this.paymentsRepository.save(payment);
    await this.logPaymentEvent({
      paymentId: payment.id,
      provider: 'flutterwave',
      type: 'escrow_inline_init',
      status: 'pending',
      payload: {
        txRef,
        amount: params.amount,
        currency: params.currency,
        paymentOptions
      }
    });

    return {
      paymentId: payment.id,
      txRef,
      publicKey: this.flutterwavePublicKey,
      amount: params.amount,
      currency: params.currency,
      paymentOptions,
      customer,
      customizations: {
        title: 'Paiement sécurisé',
        description: params.description
      }
    };
  }

  async initZikopayEscrowPayment(params: {
    user: AuthUser;
    amount: number;
    currency: string;
    description: string;
    deliveryId?: string | null;
    listingId: string;
    paymentMethod: 'mobile_money' | 'card';
    paymentOperator?: 'mtn' | 'orange';
    paymentPhone?: string;
    extraMeta?: Record<string, unknown>;
  }): Promise<{ paymentId: string; paymentUrl?: string; reference: string }> {
    if (!this.zikopayApiKey || !this.zikopayApiSecret) {
      throw new ServiceUnavailableException('Configuration Zikopay manquante.');
    }

    const requestedCurrency = (params.currency || 'XAF').toUpperCase();
    const supportedCurrencies = new Set(['XAF']);
    const currency = supportedCurrencies.has(requestedCurrency) ? requestedCurrency : 'XAF';

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        amount: params.amount.toFixed(2),
        currency,
        description: params.description,
        status: PaymentStatus.PENDING,
        userId: params.user.id,
        provider: 'zikopay',
        metadata: {
          deliveryId: params.deliveryId ?? null,
          listingId: params.listingId,
          type: params.extraMeta?.type ?? 'escrow',
          paymentMethod: params.paymentMethod,
          paymentOperator: params.paymentOperator ?? null,
          originalCurrency: requestedCurrency,
          ...params.extraMeta
        }
      })
    );

    const account = await this.usersService.findOne(params.user.id);
    const customer = {
      name: account.firstName ? `${account.firstName} ${account.lastName ?? ''}`.trim() : account.email,
      email: account.email,
      phone: params.paymentPhone ?? account.phoneNumber ?? ''
    };

    const returnUrl = this.resolveZikopayReturnUrl();
    const cancelUrl = this.resolveZikopayCancelUrl();
    const callbackUrl = this.resolveZikopayCallbackUrl();

    let response: Record<string, any> | null = null;
    try {
      if (params.paymentMethod === 'mobile_money') {
        const operatorCode =
          params.paymentOperator === 'orange' ? 'orange_cm' : 'mtn_cm';
        if (!customer.phone) {
          throw new BadRequestException('Numéro Mobile Money requis.');
        }
        response = await this.postZikopay('/payments/payin/mobile-money', {
          amount: params.amount,
          currency,
          phoneNumber: customer.phone,
          operator: operatorCode,
          return_url: returnUrl,
          cancel_url: cancelUrl,
          customer,
          callback_url: callbackUrl,
          description: params.description,
          payment_details: {
            order_id: params.listingId,
            delivery_id: params.deliveryId ?? null
          }
        });
      } else {
        const cardOperator =
          typeof params.extraMeta?.cardOperator === 'string'
            ? params.extraMeta?.cardOperator
            : 'visa';
        response = await this.postZikopay('/payments/payin/card', {
          amount: params.amount,
          currency,
          operator: cardOperator,
          return_url: returnUrl,
          cancel_url: cancelUrl,
          callback_url: callbackUrl,
          customer,
          description: params.description,
          payment_details: {
            order_id: params.listingId,
            delivery_id: params.deliveryId ?? null
          }
        });
      }
    } catch (error) {
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'zikopay',
        type: 'escrow_init_failed',
        status: 'failed',
        payload: {
          reason: error instanceof Error ? error.message : 'transport_error'
        }
      });
      throw error;
    }

    const data = response?.data ?? response;
    const reference =
      data?.reference ??
      data?.transactionId ??
      data?.transaction_id ??
      data?.external_transaction_id ??
      data?.id ??
      data?.payment?.reference ??
      data?.payment?.id ??
      data?.transaction?.reference ??
      data?.transaction?.id ??
      response?.reference ??
      response?.transactionId ??
      response?.transaction_id ??
      response?.external_transaction_id ??
      response?.id;
    const paymentUrl =
      data?.payment_url ??
      data?.paymentUrl ??
      data?.checkout_url ??
      data?.checkoutUrl ??
      data?.authorization_url ??
      response?.payment_url ??
      response?.checkout_url ??
      undefined;

    if (!reference) {
      const rawMessage = String(data?.message ?? response?.message ?? '').toLowerCase();
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'zikopay',
        type: 'escrow_init_failed',
        status: 'failed',
        payload: { reason: 'missing_reference', response }
      });

      if (rawMessage.includes('merchantpaymentconfig')) {
        throw new ServiceUnavailableException(
          'Compte marchand Zikopay non configuré (MerchantPaymentConfig). Activez les méthodes de paiement dans le dashboard Zikopay.'
        );
      }
      throw new ServiceUnavailableException(
        `Impossible de lancer le paiement Zikopay. Réponse: ${JSON.stringify(response)}`
      );
    }

    payment.externalReference = reference;
    payment.metadata = {
      ...(payment.metadata ?? {}),
      zikopayReference: reference,
      ...(paymentUrl ? { zikopayPaymentUrl: paymentUrl } : {})
    };
    await this.paymentsRepository.save(payment);
    await this.logPaymentEvent({
      paymentId: payment.id,
      provider: 'zikopay',
      type: 'escrow_init',
      status: response?.status ?? null,
      payload: response ?? null
    });

    return { paymentId: payment.id, paymentUrl, reference };
  }

  /**
   * Point d'entrée unique de la collecte escrow. La carte reste sur Zikopay
   * (CamPay ne gère pas la carte) ; le Mobile Money passe par le provider
   * configuré (`MOMO_PROVIDER`, défaut CamPay). Retour normalisé.
   */
  async initEscrowPayment(params: {
    user: AuthUser;
    amount: number;
    currency: string;
    description: string;
    deliveryId?: string | null;
    listingId: string;
    paymentMethod: 'mobile_money' | 'card';
    paymentOperator?: 'mtn' | 'orange';
    paymentPhone?: string;
    extraMeta?: Record<string, unknown>;
  }): Promise<{
    paymentId: string;
    reference: string;
    paymentUrl?: string;
    ussdCode?: string;
    operator?: string;
    provider: 'campay' | 'zikopay' | 'tranzak';
  }> {
    if (params.paymentMethod === 'mobile_money' && this.momoProvider === 'tranzak') {
      const result = await this.initTranzakCollect({
        user: params.user,
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        deliveryId: params.deliveryId ?? null,
        listingId: params.listingId,
        paymentPhone: params.paymentPhone,
        extraMeta: params.extraMeta
      });
      return { ...result, provider: 'tranzak' };
    }
    if (params.paymentMethod === 'mobile_money' && this.momoProvider === 'campay') {
      const result = await this.initCampayCollect({
        user: params.user,
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        deliveryId: params.deliveryId ?? null,
        listingId: params.listingId,
        paymentPhone: params.paymentPhone,
        extraMeta: params.extraMeta
      });
      return { ...result, provider: 'campay' };
    }
    const result = await this.initZikopayEscrowPayment(params);
    return { ...result, provider: 'zikopay' };
  }

  /**
   * Contrôle anti-fraude : on ne "complète" jamais un paiement si le montant
   * réellement payé (renvoyé par le provider) est inférieur à l'attendu, ou si
   * la devise diffère. Fail-safe : si le provider ne renvoie pas de montant
   * exploitable, on ne bloque pas (la preuve de débit reste exigée par ailleurs).
   */
  private isAuthoritativeAmountValid(
    payment: Payment,
    response: Record<string, any> | null | undefined
  ): boolean {
    const data = ((response as Record<string, any>)?.data ?? response ?? {}) as Record<string, any>;
    const rawAmount = data?.amount ?? (response as Record<string, any>)?.amount;
    if (rawAmount === undefined || rawAmount === null || rawAmount === '') {
      return true;
    }
    const actual = Number(String(rawAmount).replace(',', '.'));
    const expected = Number(payment.amount);
    // actual <= 0 : certains providers (ex. CamPay sandbox) renvoient amount=0
    // même en SUCCESSFUL → non vérifiable, on ne bloque pas (le statut réel
    // reste confirmé en serveur-à-serveur).
    if (!Number.isFinite(actual) || !Number.isFinite(expected) || actual <= 0) {
      return true;
    }
    // Tolérance d'1 unité (arrondi Mobile Money). Sous-paiement = refus.
    if (actual + 1 < expected) {
      return false;
    }
    const rawCurrency =
      data?.currency ??
      data?.currencyCode ??
      (response as Record<string, any>)?.currency ??
      (response as Record<string, any>)?.currencyCode;
    if (
      rawCurrency &&
      String(rawCurrency).toUpperCase() !== String(payment.currency).toUpperCase()
    ) {
      return false;
    }
    return true;
  }

  /**
   * Applique à un paiement le statut RÉEL renvoyé par Zikopay (réponse
   * authentifiée par clé API). C'est l'unique source de vérité pour
   * compléter/échouer un paiement : ni le webhook entrant (non signé), ni
   * aucun payload client n'est traité comme fiable.
   */
  private async applyZikopayAuthoritativeStatus(
    payment: Payment,
    response: Record<string, any> | null,
    source: 'webhook' | 'verify'
  ): Promise<{ ok: true; status: PaymentStatus | string }> {
    const data = ((response as Record<string, any>)?.data ?? response ?? {}) as Record<
      string,
      any
    >;
    const statusRaw =
      data?.status ?? data?.paymentStatus ?? (response as Record<string, any>)?.status ?? 'pending';
    const status = String(statusRaw).toLowerCase();

    if (this.isProviderSuccessStatus(status)) {
      const transactionId = this.extractProviderTransactionId(
        response as Record<string, any>,
        'zikopay'
      );
      const debitConfirmed = this.hasOperatorDebitConfirmation({
        provider: 'zikopay',
        payment,
        payload: response as Record<string, any>,
        transactionId
      });

      if (!debitConfirmed) {
        await this.logPaymentEvent({
          paymentId: payment.id,
          provider: 'zikopay',
          type: `${source}_success_without_debit_proof`,
          status,
          payload: response ?? null
        });
        return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
      }

      if (!this.isAuthoritativeAmountValid(payment, response)) {
        await this.logPaymentEvent({
          paymentId: payment.id,
          provider: 'zikopay',
          type: `${source}_amount_mismatch`,
          status,
          payload: response ?? null
        });
        return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
      }

      const wasCompleted = payment.status === PaymentStatus.COMPLETED;
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...(payment.metadata ?? {}),
        zikopayTransactionId: transactionId,
        operatorDebitConfirmed: true,
        operatorDebitConfirmedAt: new Date().toISOString()
      };
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'zikopay',
        type: `${source}_completed`,
        status,
        payload: response ?? null
      });

      if (!wasCompleted) {
        const meta = {
          ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
        };
        await this.handlePaymentMeta(payment, meta);
      }
      return { ok: true, status: payment.status };
    }

    if (this.isProviderFailureStatus(status)) {
      payment.status = PaymentStatus.FAILED;
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'zikopay',
        type: `${source}_failed`,
        status,
        payload: response ?? null
      });
      const meta = {
        ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
      };
      await this.notifyEscrowPaymentFailed(payment, meta);
      return { ok: true, status: payment.status };
    }

    return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
  }

  async handleZikopayWebhook(payload: Record<string, any>) {
    const reference = payload?.reference ?? payload?.data?.reference ?? null;
    if (!reference) {
      throw new BadRequestException('reference manquant');
    }
    const payment = await this.paymentsRepository.findOne({
      where: { externalReference: reference }
    });
    if (!payment) {
      await this.logPaymentEvent({
        provider: 'zikopay',
        type: 'webhook_unmatched',
        status: payload?.status ?? null,
        payload
      });
      return { ok: true, status: 'unknown' };
    }

    // L'endpoint webhook est public et non signé : le payload entrant n'est
    // JAMAIS digne de confiance. On revérifie le statut réel auprès de Zikopay
    // via un appel serveur-à-serveur authentifié par clé API avant toute
    // libération d'escrow. Cela neutralise toute tentative de forge de webhook.
    if (!this.zikopayApiKey || !this.zikopayApiSecret) {
      throw new ServiceUnavailableException('Configuration Zikopay manquante.');
    }
    let authoritative: Record<string, any> | null = null;
    try {
      authoritative = await this.getZikopay(
        `/payments/status/${encodeURIComponent(reference)}`
      );
    } catch (error) {
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'zikopay',
        type: 'webhook_verify_error',
        status: payload?.status ?? null,
        payload: {
          reference,
          reason: error instanceof Error ? error.message : 'transport_error'
        }
      });
      // On relaie l'erreur pour que Zikopay réessaie le webhook ; le paiement
      // reste en l'état tant que le statut réel n'a pas pu être confirmé.
      throw error;
    }

    return this.applyZikopayAuthoritativeStatus(payment, authoritative, 'webhook');
  }

  async verifyZikopayReference(user: AuthUser, reference: string) {
    if (!this.zikopayApiKey || !this.zikopayApiSecret) {
      throw new ServiceUnavailableException('Configuration Zikopay manquante.');
    }
    if (!reference) {
      throw new BadRequestException('reference manquant');
    }
    const payment = await this.paymentsRepository.findOne({
      where: { externalReference: reference }
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.userId !== user.id) {
      throw new ForbiddenException('Paiement non autorisé.');
    }

    const response = await this.getZikopay(
      `/payments/status/${encodeURIComponent(reference)}`
    );
    return this.applyZikopayAuthoritativeStatus(payment, response, 'verify');
  }

  private normalizeCampayPhone(raw: string | null | undefined): string {
    const digits = String(raw ?? '').replace(/[^\d]/g, '');
    if (!digits) {
      return '';
    }
    if (digits.startsWith('237')) {
      return digits;
    }
    if (digits.length === 9) {
      return `237${digits}`;
    }
    return digits;
  }

  async initCampayCollect(params: {
    user: AuthUser;
    amount: number;
    currency: string;
    description: string;
    deliveryId?: string | null;
    listingId: string;
    paymentPhone?: string;
    extraMeta?: Record<string, unknown>;
  }): Promise<{ paymentId: string; reference: string; ussdCode?: string; operator?: string }> {
    if (!this.campayPermanentToken) {
      throw new ServiceUnavailableException('Configuration CamPay manquante.');
    }

    const requestedCurrency = (params.currency || 'XAF').toUpperCase();

    const account = await this.usersService.findOne(params.user.id);
    const phone = this.normalizeCampayPhone(
      params.paymentPhone ?? account.phoneNumber ?? ''
    );
    if (!phone) {
      throw new BadRequestException('Numéro Mobile Money requis.');
    }

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        amount: params.amount.toFixed(2),
        currency: 'XAF',
        description: params.description,
        status: PaymentStatus.PENDING,
        userId: params.user.id,
        provider: 'campay',
        metadata: {
          deliveryId: params.deliveryId ?? null,
          listingId: params.listingId,
          type: params.extraMeta?.type ?? 'escrow',
          paymentMethod: 'mobile_money',
          originalCurrency: requestedCurrency,
          ...params.extraMeta
        }
      })
    );

    let response: Record<string, any> | null = null;
    try {
      response = await this.postCampay('/collect/', {
        amount: String(Math.round(params.amount)),
        currency: 'XAF',
        from: phone,
        description: params.description,
        external_reference: payment.id
      });
    } catch (error) {
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'campay',
        type: 'escrow_init_failed',
        status: 'failed',
        payload: {
          reason: error instanceof Error ? error.message : 'transport_error'
        }
      });
      throw error;
    }

    const data = response?.data ?? response;
    const reference = data?.reference ?? response?.reference;
    const ussdCode = data?.ussd_code ?? response?.ussd_code ?? undefined;
    const operator = data?.operator ?? response?.operator ?? undefined;

    if (!reference) {
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'campay',
        type: 'escrow_init_failed',
        status: 'failed',
        payload: { reason: 'missing_reference', response }
      });
      throw new ServiceUnavailableException(
        `Impossible de lancer le paiement CamPay. Réponse: ${JSON.stringify(response)}`
      );
    }

    payment.externalReference = reference;
    payment.metadata = {
      ...(payment.metadata ?? {}),
      campayReference: reference,
      ...(ussdCode ? { campayUssdCode: ussdCode } : {})
    };
    await this.paymentsRepository.save(payment);
    await this.logPaymentEvent({
      paymentId: payment.id,
      provider: 'campay',
      type: 'escrow_init',
      status: response?.status ?? null,
      payload: response ?? null
    });

    return { paymentId: payment.id, reference, ussdCode, operator };
  }

  /**
   * Applique à un paiement le statut RÉEL renvoyé par CamPay (réponse
   * authentifiée). C'est l'unique source de vérité pour compléter/échouer un
   * paiement : ni le webhook entrant, ni aucun payload client n'est traité
   * comme fiable.
   */
  private async applyCampayAuthoritativeStatus(
    payment: Payment,
    response: Record<string, any> | null,
    source: 'webhook' | 'verify'
  ): Promise<{ ok: true; status: PaymentStatus | string }> {
    const data = ((response as Record<string, any>)?.data ?? response ?? {}) as Record<
      string,
      any
    >;
    const statusRaw =
      data?.status ?? data?.paymentStatus ?? (response as Record<string, any>)?.status ?? 'pending';
    const status = String(statusRaw).toLowerCase();

    if (this.isProviderSuccessStatus(status)) {
      const transactionId = this.extractProviderTransactionId(
        response as Record<string, any>,
        'campay'
      );
      const debitConfirmed = this.hasOperatorDebitConfirmation({
        provider: 'campay',
        payment,
        payload: response as Record<string, any>,
        transactionId
      });

      if (!debitConfirmed) {
        await this.logPaymentEvent({
          paymentId: payment.id,
          provider: 'campay',
          type: `${source}_success_without_debit_proof`,
          status,
          payload: response ?? null
        });
        return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
      }

      if (!this.isAuthoritativeAmountValid(payment, response)) {
        await this.logPaymentEvent({
          paymentId: payment.id,
          provider: 'campay',
          type: `${source}_amount_mismatch`,
          status,
          payload: response ?? null
        });
        return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
      }

      const wasCompleted = payment.status === PaymentStatus.COMPLETED;
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...(payment.metadata ?? {}),
        campayTransactionId: transactionId,
        operatorDebitConfirmed: true,
        operatorDebitConfirmedAt: new Date().toISOString()
      };
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'campay',
        type: `${source}_completed`,
        status,
        payload: response ?? null
      });

      if (!wasCompleted) {
        const meta = {
          ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
        };
        await this.handlePaymentMeta(payment, meta);
      }
      return { ok: true, status: payment.status };
    }

    if (this.isProviderFailureStatus(status)) {
      payment.status = PaymentStatus.FAILED;
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'campay',
        type: `${source}_failed`,
        status,
        payload: response ?? null
      });
      const meta = {
        ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
      };
      await this.notifyEscrowPaymentFailed(payment, meta);
      return { ok: true, status: payment.status };
    }

    return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
  }

  async handleCampayWebhook(payload: Record<string, any>) {
    const reference =
      payload?.reference ?? payload?.data?.reference ?? null;
    const externalReference =
      payload?.external_reference ?? payload?.data?.external_reference ?? null;

    let payment = reference
      ? await this.paymentsRepository.findOne({
          where: { externalReference: reference }
        })
      : null;
    if (!payment && externalReference) {
      payment = await this.paymentsRepository.findOne({
        where: { id: externalReference }
      });
    }

    if (!payment) {
      await this.logPaymentEvent({
        provider: 'campay',
        type: 'webhook_unmatched',
        status: payload?.status ?? null,
        payload
      });
      return { ok: true, status: 'unknown' };
    }

    const authoritativeReference = payment.externalReference ?? reference;
    if (!authoritativeReference) {
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'campay',
        type: 'webhook_unmatched',
        status: payload?.status ?? null,
        payload
      });
      return { ok: true, status: 'unknown' };
    }

    // L'endpoint webhook est public : le payload entrant n'est JAMAIS digne de
    // confiance. On revérifie le statut réel auprès de CamPay via un appel
    // serveur-à-serveur authentifié avant toute libération d'escrow.
    if (!this.campayPermanentToken) {
      throw new ServiceUnavailableException('Configuration CamPay manquante.');
    }
    let authoritative: Record<string, any> | null = null;
    try {
      authoritative = await this.getCampay(
        `/transaction/${encodeURIComponent(authoritativeReference)}/`
      );
    } catch (error) {
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'campay',
        type: 'webhook_verify_error',
        status: payload?.status ?? null,
        payload: {
          reference: authoritativeReference,
          reason: error instanceof Error ? error.message : 'transport_error'
        }
      });
      throw error;
    }

    return this.applyCampayAuthoritativeStatus(payment, authoritative, 'webhook');
  }

  async verifyCampayReference(user: AuthUser, reference: string) {
    if (!this.campayPermanentToken) {
      throw new ServiceUnavailableException('Configuration CamPay manquante.');
    }
    if (!reference) {
      throw new BadRequestException('reference manquant');
    }
    const payment = await this.paymentsRepository.findOne({
      where: { externalReference: reference }
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.userId !== user.id) {
      throw new ForbiddenException('Paiement non autorisé.');
    }

    const response = await this.getCampay(
      `/transaction/${encodeURIComponent(reference)}/`
    );
    return this.applyCampayAuthoritativeStatus(payment, response, 'verify');
  }

  /**
   * Vérification de paiement agnostique du provider : retrouve le paiement par
   * sa référence et délègue au verify du bon provider (CamPay / Zikopay /
   * Flutterwave). Permet au front de poller un seul endpoint.
   */
  async verifyPaymentReference(user: AuthUser, reference: string) {
    if (!reference) {
      throw new BadRequestException('reference manquant');
    }
    const payment = await this.paymentsRepository.findOne({
      where: { externalReference: reference }
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.userId !== user.id) {
      throw new ForbiddenException('Paiement non autorisé.');
    }
    if (payment.provider === 'tranzak') {
      return this.verifyTranzakReference(user, reference);
    }
    if (payment.provider === 'campay') {
      return this.verifyCampayReference(user, reference);
    }
    if (payment.provider === 'flutterwave') {
      return this.verifyFlutterwaveReference(user, reference);
    }
    return this.verifyZikopayReference(user, reference);
  }

  async createCampayMobileMoneyPayout(params: {
    amount: number;
    currency: string;
    beneficiaryName: string;
    accountNumber: string;
    network: 'mtn' | 'orange';
  }): Promise<{ payoutReference: string }> {
    if (!this.campayPermanentToken) {
      throw new ServiceUnavailableException('Configuration CamPay manquante.');
    }

    const phone = this.normalizeCampayPhone(params.accountNumber);
    if (!phone) {
      throw new BadRequestException('Numéro Mobile Money requis.');
    }

    const response = await this.postCampay('/withdraw/', {
      amount: String(Math.round(params.amount)),
      to: phone,
      description: 'Retrait wallet',
      external_reference: randomUUID()
    });

    const data = response?.data ?? response;
    const reference = data?.reference ?? response?.reference;
    if (!reference) {
      throw new ServiceUnavailableException('Impossible de lancer le retrait CamPay.');
    }

    await this.logPaymentEvent({
      provider: 'campay',
      type: 'payout_transfer',
      status: response?.status ?? null,
      payload: response?.data ?? response
    });

    return { payoutReference: reference };
  }

  async handleFlutterwaveWebhook(payload: Record<string, any>, signature?: string) {
    if (!this.flutterwaveWebhookHash || signature !== this.flutterwaveWebhookHash) {
      throw new ForbiddenException('Signature Flutterwave invalide.');
    }
    return this.processFlutterwaveWebhook(payload);
  }

  async verifyFlutterwaveReference(user: AuthUser, txRef: string) {
    if (!this.flutterwaveSecretKey) {
      throw new ServiceUnavailableException('Configuration Flutterwave manquante.');
    }
    if (!txRef) {
      throw new BadRequestException('tx_ref manquant');
    }
    const payment = await this.paymentsRepository.findOne({
      where: { externalReference: txRef }
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.userId !== user.id) {
      throw new ForbiddenException('Paiement non autorisé.');
    }

    const url = `/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;
    const response = await this.getFlutterwave(url);
    const data = response?.data ?? {};
    const status = (data?.status ?? '').toString().toLowerCase();

    if (status === 'successful') {
      return this.processFlutterwaveWebhook({ event: 'charge.completed', data }, user.id);
    }
    if (status === 'failed') {
      payment.status = PaymentStatus.FAILED;
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'flutterwave',
        type: 'verify_failed',
        status: data?.status ?? 'failed',
        payload: response
      });
      const meta = {
        ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
      };
      await this.notifyEscrowPaymentFailed(payment, meta);
      return { ok: true, status: payment.status };
    }

    return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
  }

  private async processFlutterwaveWebhook(
    payload: Record<string, any>,
    expectedUserId?: string
  ) {
    const event = payload?.event ?? '';
    const data = payload?.data ?? {};
    const txRef = data?.tx_ref ?? payload?.tx_ref ?? payload?.txRef;
    if (!txRef) {
      throw new BadRequestException('tx_ref manquant');
    }

    const payment = await this.paymentsRepository.findOne({
      where: { externalReference: txRef }
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (expectedUserId && payment.userId !== expectedUserId) {
      throw new ForbiddenException('Paiement non autorisé.');
    }

    if (event === 'charge.completed' || data?.status === 'successful') {
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...(payment.metadata ?? {}),
        flutterwaveTransactionId: data?.id ?? payment.metadata?.flutterwaveTransactionId ?? null
      };
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'flutterwave',
        type: expectedUserId ? 'verify_charge_completed' : 'webhook_charge_completed',
        status: data?.status ?? 'successful',
        payload
      });

      const meta = {
        ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {}),
        ...(typeof data?.meta === 'object' && data.meta ? data.meta : {})
      };
      await this.handlePaymentMeta(payment, meta);
      return { ok: true, status: payment.status };
    }

    if (event === 'charge.failed' || data?.status === 'failed') {
      payment.status = PaymentStatus.FAILED;
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'flutterwave',
        type: 'webhook_failed',
        status: payment.status,
        payload
      });
      const meta = {
        ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {}),
        ...(typeof data?.meta === 'object' && data.meta ? data.meta : {})
      };
      await this.notifyEscrowPaymentFailed(payment, meta);
      return { ok: true, status: payment.status };
    }

    return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
  }

  private async notifyEscrowPaid(params: {
    listingId: string;
    buyerId: string;
    sellerId: string;
    handoverMode: 'delivery' | 'pickup';
  }) {
    await this.messagesService.sendTimelineEvent({
      listingId: params.listingId,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      actorId: params.buyerId,
      content:
        params.handoverMode === 'pickup'
          ? 'Paiement sécurisé confirmé. Vous pouvez organiser la remise en main propre avec le vendeur.'
          : 'Paiement sécurisé confirmé. Recherche d’un livreur en cours.'
    });
  }

  private async notifyEscrowPaymentFailed(payment: Payment, meta?: Record<string, unknown>) {
    const mergedMeta = {
      ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {}),
      ...(meta ?? {})
    };
    const listingId = typeof mergedMeta.listingId === 'string' ? mergedMeta.listingId : null;
    if (!listingId) {
      return;
    }
    const listing = await this.listingsRepository.findOne({ where: { id: listingId } });
    if (!listing) {
      return;
    }
    await this.messagesService.sendTimelineEvent({
      listingId,
      buyerId: payment.userId,
      sellerId: listing.owner.id,
      actorId: payment.userId,
      content: 'Le paiement sécurisé a échoué ou a été annulé. Vous pouvez réessayer.'
    });
  }

  private async handlePaymentMeta(payment: Payment, meta: Record<string, unknown>) {
    const deliveryId = (meta.deliveryId as string | undefined) ?? undefined;
    const metaType = meta.type as string | undefined;

    if (deliveryId) {
      const delivery = await this.deliveriesRepository.findOne({
        where: { id: deliveryId },
        relations: { listing: true }
      });
      if (delivery) {
        const wasHeld = delivery.escrowStatus === 'held';
        delivery.escrowStatus = 'held';
        delivery.escrowPaymentId = payment.id;
        delivery.escrowAmount = payment.amount;
        delivery.escrowCurrency = payment.currency;
        const savedDelivery = await this.deliveriesRepository.save(delivery);

        const orderId = typeof meta.orderId === 'string' ? meta.orderId : null;
        if (orderId) {
          await this.ordersService.attachDelivery(orderId, savedDelivery.id);
          await this.ordersService.markPaid(orderId);
          await this.ordersService.updateFromDelivery(orderId, savedDelivery.status);
        }

        if (!wasHeld) {
          await this.notifyEscrowPaid({
            listingId: savedDelivery.listingId,
            buyerId: savedDelivery.buyerId,
            sellerId: savedDelivery.sellerId,
            handoverMode: savedDelivery.handoverMode ?? 'delivery'
          });

          if (
            savedDelivery.handoverMode === 'delivery' &&
            typeof savedDelivery.pickupLat === 'number' &&
            typeof savedDelivery.pickupLng === 'number'
          ) {
            await this.notifyNearbyCouriersForDelivery({
              deliveryId: savedDelivery.id,
              pickupLat: savedDelivery.pickupLat,
              pickupLng: savedDelivery.pickupLng,
              city: savedDelivery.listing?.location?.city ?? null,
              zipcode: savedDelivery.listing?.location?.zipcode ?? null
            });
          }
        }
      }
      return;
    }

    if (metaType === 'delivery_escrow') {
      const listingId = meta.listingId as string | undefined;
      if (listingId) {
        const listing = await this.listingsRepository.findOne({ where: { id: listingId } });
        if (listing) {
          const pickupAddress =
            listing.location?.address ??
            (listing.location?.city && listing.location?.zipcode
              ? `${listing.location.city} ${listing.location.zipcode}`
              : listing.location?.city ?? null) ??
            null;

          const handoverMode =
            typeof meta.handoverMode === 'string' && meta.handoverMode.toLowerCase() === 'pickup'
              ? 'pickup'
              : 'delivery';

          const parsedDeliveryPrice =
            meta.deliveryPrice !== undefined && meta.deliveryPrice !== null
              ? Number(meta.deliveryPrice)
              : null;
          const deliveryPrice =
            parsedDeliveryPrice !== null && Number.isFinite(parsedDeliveryPrice)
              ? parsedDeliveryPrice.toFixed(2)
              : null;
          let saved = await this.deliveriesRepository.findOne({
            where: { escrowPaymentId: payment.id }
          });
          const isNewDelivery = !saved;
          if (!saved) {
            const delivery = this.deliveriesRepository.create({
              listingId,
              buyerId: payment.userId,
              sellerId: listing.owner.id,
              pickupAddress,
              dropoffAddress: typeof meta.dropoffAddress === 'string' ? meta.dropoffAddress : null,
              dropoffNotes: typeof meta.dropoffNotes === 'string' ? meta.dropoffNotes : null,
              pickupLat: listing.location?.lat ?? null,
              pickupLng: listing.location?.lng ?? null,
              price: deliveryPrice,
              currency: (meta.deliveryCurrency as string | undefined) ?? listing.currency ?? 'XAF',
              status: DeliveryStatus.REQUESTED,
              deliveredAt: null,
              pickupCode:
                handoverMode === 'delivery'
                  ? Math.floor(100000 + Math.random() * 900000).toString()
                  : null,
              deliveryCode:
                handoverMode === 'delivery'
                  ? Math.floor(100000 + Math.random() * 900000).toString()
                  : null,
              escrowStatus: 'held',
              escrowPaymentId: payment.id,
              escrowAmount: payment.amount,
              escrowCurrency: payment.currency,
              preferredCourierId:
                typeof meta.preferredCourierId === 'string' ? meta.preferredCourierId : null,
              handoverMode
            });
            saved = await this.deliveriesRepository.save(delivery);
          } else {
            saved.escrowStatus = 'held';
            saved.escrowAmount = payment.amount;
            saved.escrowCurrency = payment.currency;
            if (!saved.escrowPaymentId) {
              saved.escrowPaymentId = payment.id;
            }
            saved = await this.deliveriesRepository.save(saved);
          }

          const orderId = typeof meta.orderId === 'string' ? meta.orderId : null;
          if (orderId) {
            await this.ordersService.attachDelivery(orderId, saved.id);
            await this.ordersService.markPaid(orderId);
            await this.ordersService.updateFromDelivery(orderId, saved.status);
          }
          const paymentMeta =
            typeof payment.metadata === 'object' && payment.metadata
              ? { ...(payment.metadata as Record<string, unknown>) }
              : {};
          const alreadyHandled = Boolean(paymentMeta.escrowHandledAt);
          paymentMeta.deliveryId = saved.id;
          if (!alreadyHandled) {
            paymentMeta.escrowHandledAt = new Date().toISOString();
          }
          payment.metadata = paymentMeta;
          await this.paymentsRepository.save(payment);

          if (!alreadyHandled) {
            await Promise.all([
              this.notificationsService.createNotification({
                userId: saved.buyerId,
                category: NotificationCategory.SYSTEM,
                title: 'Paiement confirmé',
                body: `Votre paiement sécurisé pour "${listing.title}" est confirmé.`,
                metadata: { deliveryId: saved.id, listingId }
              }),
              this.notificationsService.createNotification({
                userId: saved.sellerId,
                category: NotificationCategory.SYSTEM,
                title: 'Paiement reçu',
                body: `Un acheteur a payé pour "${listing.title}". Préparez le colis.`,
                metadata: { deliveryId: saved.id, listingId }
              })
            ]);
            await this.notifyEscrowPaid({
              listingId,
              buyerId: saved.buyerId,
              sellerId: saved.sellerId,
              handoverMode
            });
          }
          if (
            (isNewDelivery || !alreadyHandled) &&
            saved.handoverMode === 'delivery' &&
            typeof saved.pickupLat === 'number' &&
            typeof saved.pickupLng === 'number'
          ) {
            await this.notifyNearbyCouriersForDelivery({
              deliveryId: saved.id,
              pickupLat: saved.pickupLat,
              pickupLng: saved.pickupLng,
              city: listing.location?.city ?? null,
              zipcode: listing.location?.zipcode ?? null
            });
          }
        }
      }
    } else if (metaType === 'promotion') {
      const account = await this.usersService.findOne(payment.userId);
      try {
        await this.applyPromotionForPayment(payment, {
          id: account.id,
          role: account.role,
          email: account.email,
          isPro: account.isPro,
          phoneNumber: account.phoneNumber
        });
      } catch (error) {
        payment.metadata = {
          ...(payment.metadata ?? {}),
          promotionApplied: false,
          promotionError: this.extractPromotionError(error)
        };
        await this.paymentsRepository.save(payment);
        console.error('Unable to apply promotion after payment confirmation', error);
      }
    } else if (metaType === 'wallet_topup') {
      const amount = Number(payment.amount);
      await this.walletsService.credit({
        userId: payment.userId,
        amount,
        currency: payment.currency,
        type: WalletTransactionType.TOPUP,
        metadata: { paymentId: payment.id }
      });
      await this.notificationsService.createNotification({
        userId: payment.userId,
        category: NotificationCategory.SYSTEM,
        title: 'Wallet crédité',
        body: `Votre wallet a été crédité de ${amount.toFixed(0)} ${payment.currency}.`,
        metadata: { paymentId: payment.id }
      });
    }
  }

  async getWalletSummary(user: AuthUser) {
    return this.walletsService.getBalance(user.id);
  }

  async getWalletTransactions(
    user: AuthUser,
    options?: {
      limit?: number;
      offset?: number;
      type?: string;
      status?: string;
      from?: Date;
      to?: Date;
    }
  ) {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const offset = Math.max(options?.offset ?? 0, 0);
    const where: Record<string, any> = { userId: user.id };
    if (options?.type) {
      where.type = options.type;
    }
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.from || options?.to) {
      const from = options?.from ?? new Date(0);
      const to = options?.to ?? new Date();
      where.created_at = Between(from, to);
    }
    const [items, total] = await this.walletTransactionsRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset
    });

    return { items, total };
  }

  async exportWalletTransactions(
    user: AuthUser,
    options?: { type?: string; status?: string; from?: Date; to?: Date }
  ) {
    const { items } = await this.getWalletTransactions(user, {
      limit: 1000,
      offset: 0,
      type: options?.type,
      status: options?.status,
      from: options?.from,
      to: options?.to
    });

    const typeLabels: Record<string, string> = {
      topup: 'Recharge',
      hold: 'Réservation',
      release: 'Versement',
      refund: 'Remboursement',
      withdrawal: 'Retrait',
      adjustment: 'Ajustement'
    };
    const statusLabels: Record<string, string> = {
      completed: 'Confirmé',
      pending: 'En attente',
      failed: 'Échec'
    };

    const escape = (value: string) => {
      if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const header = ['Date', 'Type', 'Montant', 'Devise', 'Statut'];
    const rows = items.map(tx => {
      const date = tx.created_at instanceof Date ? tx.created_at.toISOString() : String(tx.created_at);
      const type = typeLabels[tx.type] ?? tx.type;
      const amount = String(tx.amount);
      const currency = tx.currency ?? 'XAF';
      const status = statusLabels[tx.status] ?? tx.status;
      return [date, type, amount, currency, status].map(escape).join(',');
    });

    return [header.join(','), ...rows].join('\n');
  }

  async initWalletTopup(user: AuthUser, dto: WalletTopupDto) {
    const currency = (dto.currency ?? 'XAF').toUpperCase();
    const paymentMethod = dto.paymentMethod ?? 'mobile_money';
    const account = await this.usersService.findOne(user.id);
    const paymentPhone =
      typeof dto.paymentPhone === 'string' && dto.paymentPhone.trim()
        ? dto.paymentPhone.trim()
        : account.phoneNumber ?? '';
    const paymentOperator = dto.paymentOperator ?? undefined;

    if (paymentMethod === 'mobile_money' && !paymentOperator) {
      throw new BadRequestException('Opérateur Mobile Money requis.');
    }
    if (paymentMethod === 'mobile_money' && !paymentPhone) {
      throw new BadRequestException('Numéro Mobile Money requis.');
    }

    // Carte → Zikopay ; sinon provider configuré (défaut CamPay), surchargeable par dto.provider.
    const topupProvider =
      paymentMethod === 'card' ? 'zikopay' : (dto.provider ?? this.momoProvider);
    if (topupProvider === 'tranzak') {
      return this.initTranzakCollect({
        user,
        amount: dto.amount,
        currency,
        description: 'Recharge wallet',
        listingId: 'wallet',
        deliveryId: null,
        paymentPhone,
        extraMeta: {
          type: 'wallet_topup'
        }
      });
    }
    if (topupProvider === 'campay') {
      return this.initCampayCollect({
        user,
        amount: dto.amount,
        currency,
        description: 'Recharge wallet',
        listingId: 'wallet',
        deliveryId: null,
        paymentPhone,
        extraMeta: {
          type: 'wallet_topup'
        }
      });
    }

    const payment = await this.initZikopayEscrowPayment({
      user,
      amount: dto.amount,
      currency,
      description: 'Recharge wallet',
      listingId: 'wallet',
      deliveryId: null,
      paymentMethod,
      paymentOperator,
      paymentPhone,
      extraMeta: {
        type: 'wallet_topup'
      }
    });
    return payment;
  }

  async withdrawFromWallet(user: AuthUser, dto: WalletWithdrawDto) {
    const currency = (dto.currency ?? 'XAF').toUpperCase();
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Montant invalide.');
    }

    const seller = await this.usersService.findOne(user.id);
    const settings = (seller.settings ?? {}) as Record<string, unknown>;
    const payoutNetwork = (settings.payoutMobileNetwork as string | undefined)?.toLowerCase() as
      | 'mtn'
      | 'orange'
      | undefined;
    const payoutNumber = (settings.payoutMobileNumber as string | undefined)?.trim();
    const payoutName =
      (settings.payoutMobileName as string | undefined)?.trim() ??
      `${seller.firstName ?? ''} ${seller.lastName ?? ''}`.trim();

    if (!payoutNetwork || !payoutNumber) {
      throw new BadRequestException('Merci de renseigner votre Mobile Money pour le retrait.');
    }

    const tx = await this.walletsService.debit({
      userId: user.id,
      amount,
      currency,
      type: WalletTransactionType.WITHDRAWAL,
      metadata: { network: payoutNetwork, payoutNumber }
    });

    const payoutParams = {
      amount,
      currency,
      beneficiaryName: payoutName || seller.email,
      accountNumber: payoutNumber,
      network: payoutNetwork
    };
    try {
      if (this.momoProvider === 'tranzak') {
        await this.createTranzakMobileMoneyPayout(payoutParams);
      } else if (this.momoProvider === 'campay') {
        await this.createCampayMobileMoneyPayout(payoutParams);
      } else {
        await this.createZikopayMobileMoneyPayout(payoutParams);
      }
    } catch (error) {
      // Le solde a déjà été débité : si le payout échoue, on recrédite pour ne
      // pas faire perdre l'argent à l'utilisateur, puis on remonte l'erreur.
      await this.walletsService.credit({
        userId: user.id,
        amount,
        currency,
        type: WalletTransactionType.REFUND,
        metadata: {
          reason: 'payout_failed',
          relatedWalletTransactionId: tx.id,
          network: payoutNetwork
        }
      });
      console.error('Wallet payout failed, balance refunded', error);
      throw new ServiceUnavailableException(
        'Le retrait a échoué. Votre solde a été recrédité.'
      );
    }

    await this.notificationsService.createNotification({
      userId: user.id,
      category: NotificationCategory.SYSTEM,
      title: 'Retrait en cours',
      body: `Votre retrait de ${amount.toFixed(0)} ${currency} est en cours.`,
      metadata: { walletTransactionId: tx.id }
    });

    return { ok: true, transactionId: tx.id };
  }

  async createZikopayMobileMoneyPayout(params: {
    amount: number;
    currency: string;
    beneficiaryName: string;
    accountNumber: string;
    network: 'mtn' | 'orange';
  }): Promise<{ payoutReference: string }> {
    if (!this.zikopayApiKey || !this.zikopayApiSecret) {
      throw new ServiceUnavailableException('Configuration Zikopay manquante.');
    }

    const operatorCode = params.network === 'orange' ? 'orange_cm' : 'mtn_cm';
    const response = await this.postZikopay('/payments/payout/mobile-money', {
      amount: params.amount,
      currency: params.currency,
      phoneNumber: params.accountNumber,
      operator: operatorCode,
      customer: {
        name: params.beneficiaryName,
        phoneNumber: params.accountNumber
      },
      callback_url: this.resolveZikopayCallbackUrl(),
      description: 'Retrait wallet'
    });

    const data = response?.data ?? response;
    const reference = data?.reference ?? data?.transactionId ?? data?.id;
    if (!reference) {
      throw new ServiceUnavailableException('Impossible de lancer le retrait Zikopay.');
    }

    await this.logPaymentEvent({
      provider: 'zikopay',
      type: 'payout_transfer',
      status: response?.status ?? null,
      payload: response?.data ?? response
    });

    return { payoutReference: reference };
  }

  async refundFlutterwavePayment(payment: Payment): Promise<void> {
    const transactionId = (payment.metadata?.flutterwaveTransactionId as string | undefined) ?? null;
    if (!transactionId) {
      throw new BadRequestException('Transaction Flutterwave introuvable pour remboursement.');
    }

    const response = await this.postFlutterwave(`/v3/transactions/${transactionId}/refund`, {});
    if (response?.status !== 'success') {
      throw new ServiceUnavailableException('Remboursement Flutterwave impossible.');
    }

    payment.status = PaymentStatus.REFUNDED;
    await this.paymentsRepository.save(payment);
    await this.logPaymentEvent({
      paymentId: payment.id,
      provider: 'flutterwave',
      type: 'refund',
      status: response?.status ?? null,
      payload: response?.data ?? response
    });
  }

  async initMtn(
    user: AuthUser,
    dto: MtnInitDto
  ): Promise<{ paymentId: string; status: string }> {
    const subscriptionKey = this.configService.get<string>('MTN_MOMO_SUBSCRIPTION_KEY');
    const apiUser = this.configService.get<string>('MTN_MOMO_API_USER');
    const apiKey = this.configService.get<string>('MTN_MOMO_API_KEY');
    const environment = this.configService.get<string>('MTN_MOMO_ENV') ?? 'sandbox';

    if (!subscriptionKey || !apiUser || !apiKey) {
      throw new ServiceUnavailableException('Configuration MTN MoMo manquante.');
    }

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        amount: dto.amount.toFixed(2),
        currency: dto.currency ?? 'XAF',
        description: dto.description,
        status: PaymentStatus.PENDING,
        userId: user.id,
        provider: 'mtn',
        metadata: { msisdn: dto.msisdn }
      })
    );

    // Ici on devrait appeler l’API MTN requesttopay avec un UUID externalReference.
    // Pour simplifier (pas d’appel réseau effectif en sandbox), on stocke l’ID comme reference.
    payment.externalReference = payment.id;
    await this.paymentsRepository.save(payment);
    await this.logPaymentEvent({
      paymentId: payment.id,
      provider: 'mtn',
      type: 'init',
      status: 'pending',
      payload: { msisdn: dto.msisdn, amount: dto.amount, currency: dto.currency ?? 'XAF' }
    });

    return { paymentId: payment.id, status: 'pending' };
  }

  async handleMtnWebhook(payload: Record<string, any>) {
    const referenceId = payload?.reference_id ?? payload?.externalReference ?? payload?.id;
    const status = (payload?.status ?? '').toString().toUpperCase();
    if (!referenceId) {
      throw new BadRequestException('reference_id manquant');
    }
    const payment = await this.paymentsRepository.findOne({ where: { externalReference: referenceId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (this.isProviderSuccessStatus(status)) {
      const transactionId = this.extractProviderTransactionId(payload, 'mtn');
      const debitConfirmed = this.hasOperatorDebitConfirmation({
        provider: 'mtn',
        payment,
        payload,
        transactionId
      });
      if (!debitConfirmed) {
        await this.logPaymentEvent({
          paymentId: payment.id,
          provider: 'mtn',
          type: 'webhook_success_without_debit_proof',
          status,
          payload
        });
        return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
      }
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...(payment.metadata ?? {}),
        operatorTransactionId: transactionId,
        operatorDebitConfirmed: true,
        operatorDebitConfirmedAt: new Date().toISOString()
      };
    } else if (this.isProviderFailureStatus(status) || status === 'REJECTED') {
      payment.status = PaymentStatus.FAILED;
    }
    await this.paymentsRepository.save(payment);
    await this.logPaymentEvent({
      paymentId: payment.id,
      provider: 'mtn',
      type: 'webhook',
      status: payment.status,
      payload
    });
    return { ok: true, status: payment.status };
  }

  async initOrange(
    user: AuthUser,
    dto: OrangeInitDto
  ): Promise<{ paymentId: string; paymentUrl: string }> {
    const merchantKey = this.configService.get<string>('ORANGE_MONEY_MERCHANT_KEY');
    const secret = this.configService.get<string>('ORANGE_MONEY_SECRET');
    const merchantId = this.configService.get<string>('ORANGE_MONEY_MERCHANT_ID');
    const returnUrl =
      dto.returnUrl ||
      this.configService.get<string>('ORANGE_MONEY_RETURN_URL');
    const cancelUrl =
      dto.cancelUrl ||
      this.configService.get<string>('ORANGE_MONEY_CANCEL_URL');
    const notifUrl = this.configService.get<string>('ORANGE_MONEY_NOTIF_URL');
    const country = this.configService.get<string>('ORANGE_MONEY_COUNTRY') ?? 'CM';
    const currency = dto.currency ?? this.configService.get<string>('ORANGE_MONEY_CURRENCY') ?? 'XAF';

    if (!merchantKey || !secret || !merchantId || !returnUrl || !cancelUrl || !notifUrl) {
      throw new ServiceUnavailableException('Configuration Orange Money manquante.');
    }

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        amount: dto.amount.toFixed(2),
        currency,
        description: dto.description,
        status: PaymentStatus.PENDING,
        userId: user.id,
        provider: 'orange'
      })
    );

    // En prod : appeler l’endpoint d’init OM Web Payment pour obtenir pay_token, puis l’URL de paiement.
    const paymentUrl = `${returnUrl}?reference=${payment.id}`;
    payment.externalReference = payment.id;
    await this.paymentsRepository.save(payment);
    await this.logPaymentEvent({
      paymentId: payment.id,
      provider: 'orange',
      type: 'init',
      status: 'pending',
      payload: {
        amount: dto.amount,
        currency,
        returnUrl,
        cancelUrl
      }
    });

    return { paymentId: payment.id, paymentUrl };
  }

  async handleOrangeWebhook(payload: Record<string, any>) {
    const reference = payload?.order_id ?? payload?.reference ?? payload?.external_id;
    const status = (payload?.status ?? '').toString().toUpperCase();
    if (!reference) {
      throw new BadRequestException('reference manquant');
    }
    const payment = await this.paymentsRepository.findOne({ where: { externalReference: reference } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (this.isProviderSuccessStatus(status)) {
      const transactionId = this.extractProviderTransactionId(payload, 'orange');
      const debitConfirmed = this.hasOperatorDebitConfirmation({
        provider: 'orange',
        payment,
        payload,
        transactionId
      });
      if (!debitConfirmed) {
        await this.logPaymentEvent({
          paymentId: payment.id,
          provider: 'orange',
          type: 'webhook_success_without_debit_proof',
          status,
          payload
        });
        return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
      }
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...(payment.metadata ?? {}),
        operatorTransactionId: transactionId,
        operatorDebitConfirmed: true,
        operatorDebitConfirmedAt: new Date().toISOString()
      };
    } else if (this.isProviderFailureStatus(status)) {
      payment.status = PaymentStatus.FAILED;
    }
    await this.paymentsRepository.save(payment);
    await this.logPaymentEvent({
      paymentId: payment.id,
      provider: 'orange',
      type: 'webhook',
      status: payment.status,
      payload
    });
    return { ok: true, status: payment.status };
  }

  private postJson(url: URL, body: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = httpsRequest(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        },
        res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            try {
              const parsed = JSON.parse(raw);
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  private postFlutterwave(path: string, body: unknown): Promise<any> {
    const url = new URL(path, this.flutterwaveBaseUrl);
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = httpsRequest(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.flutterwaveSecretKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        },
        res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            try {
              const parsed = JSON.parse(raw);
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  private getFlutterwave(path: string): Promise<any> {
    const url = new URL(path, this.flutterwaveBaseUrl);
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.flutterwaveSecretKey}`
          }
        },
        res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            try {
              const parsed = JSON.parse(raw);
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  private resolveZikopayReturnUrl() {
    const base = (this.zikopayReturnUrl || 'http://localhost:5173').replace(/\/$/, '');
    if (base.includes('/payment/return')) {
      return base;
    }
    return `${base}/payment/return`;
  }

  private resolveZikopayCancelUrl() {
    const base = (this.zikopayCancelUrl || 'http://localhost:5173').replace(/\/$/, '');
    if (base.includes('/payment/return')) {
      return `${base}?status=cancel`;
    }
    return `${base}/payment/return?status=cancel`;
  }

  private resolveZikopayCallbackUrl() {
    const base = (this.zikopayCallbackUrl || 'http://localhost:3000').replace(/\/$/, '');
    if (base.includes('/payments/zikopay/webhook')) {
      return base;
    }
    return `${base}/payments/zikopay/webhook`;
  }

  private postZikopay(path: string, body: unknown): Promise<any> {
    const base = this.zikopayBaseUrl.replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(`${base}/${normalizedPath}`);
    const transport = url.protocol === 'http:' ? httpRequest : httpsRequest;
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = transport(
        url,
        {
          method: 'POST',
          headers: {
            'X-API-Key': this.zikopayApiKey,
            'X-API-Secret': this.zikopayApiSecret,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        },
        res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const statusCode = res.statusCode ?? 0;
            const contentType = res.headers['content-type'] ?? '';
            const looksLikeHtml = raw.trim().startsWith('<');
            const isJson = typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');

            if (!raw) {
              return reject(
                new Error(`Zikopay réponse vide (HTTP ${statusCode}) pour ${url.toString()}`)
              );
            }

            if (!isJson || looksLikeHtml) {
              const snippet = raw.replace(/\s+/g, ' ').slice(0, 200);
              return reject(
                new Error(`Zikopay réponse non-JSON (HTTP ${statusCode}) : ${snippet}`)
              );
            }

            try {
              const parsed = JSON.parse(raw);
              if (statusCode >= 400) {
                return reject(
                  new Error(
                    `Zikopay erreur HTTP ${statusCode}: ${parsed?.message ?? parsed?.error ?? raw}`
                  )
                );
              }
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  private getZikopay(path: string): Promise<any> {
    const base = this.zikopayBaseUrl.replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(`${base}/${normalizedPath}`);
    const transport = url.protocol === 'http:' ? httpRequest : httpsRequest;
    return new Promise((resolve, reject) => {
      const req = transport(
        url,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.zikopayApiKey,
            'X-API-Secret': this.zikopayApiSecret,
            Accept: 'application/json'
          }
        },
        res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const statusCode = res.statusCode ?? 0;
            const contentType = res.headers['content-type'] ?? '';
            const looksLikeHtml = raw.trim().startsWith('<');
            const isJson = typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');

            if (!raw) {
              return reject(
                new Error(`Zikopay réponse vide (HTTP ${statusCode}) pour ${url.toString()}`)
              );
            }

            if (!isJson || looksLikeHtml) {
              const snippet = raw.replace(/\s+/g, ' ').slice(0, 200);
              return reject(
                new Error(`Zikopay réponse non-JSON (HTTP ${statusCode}) : ${snippet}`)
              );
            }

            try {
              const parsed = JSON.parse(raw);
              if (statusCode >= 400) {
                return reject(
                  new Error(
                    `Zikopay erreur HTTP ${statusCode}: ${parsed?.message ?? parsed?.error ?? raw}`
                  )
                );
              }
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }


  private postCampay(path: string, body: unknown): Promise<any> {
    const base = this.campayBaseUrl.replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(`${base}/${normalizedPath}`);
    const transport = url.protocol === 'http:' ? httpRequest : httpsRequest;
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = transport(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${this.campayPermanentToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        },
        res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const statusCode = res.statusCode ?? 0;
            const contentType = res.headers['content-type'] ?? '';
            const looksLikeHtml = raw.trim().startsWith('<');
            const isJson = typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');

            if (!raw) {
              return reject(
                new Error(`CamPay réponse vide (HTTP ${statusCode}) pour ${url.toString()}`)
              );
            }

            if (!isJson || looksLikeHtml) {
              const snippet = raw.replace(/\s+/g, ' ').slice(0, 200);
              return reject(
                new Error(`CamPay réponse non-JSON (HTTP ${statusCode}) : ${snippet}`)
              );
            }

            try {
              const parsed = JSON.parse(raw);
              if (statusCode >= 400) {
                return reject(
                  new Error(
                    `CamPay erreur HTTP ${statusCode}: ${parsed?.message ?? parsed?.error ?? raw}`
                  )
                );
              }
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  private getCampay(path: string): Promise<any> {
    const base = this.campayBaseUrl.replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(`${base}/${normalizedPath}`);
    const transport = url.protocol === 'http:' ? httpRequest : httpsRequest;
    return new Promise((resolve, reject) => {
      const req = transport(
        url,
        {
          method: 'GET',
          headers: {
            Authorization: `Token ${this.campayPermanentToken}`,
            Accept: 'application/json'
          }
        },
        res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const statusCode = res.statusCode ?? 0;
            const contentType = res.headers['content-type'] ?? '';
            const looksLikeHtml = raw.trim().startsWith('<');
            const isJson = typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');

            if (!raw) {
              return reject(
                new Error(`CamPay réponse vide (HTTP ${statusCode}) pour ${url.toString()}`)
              );
            }

            if (!isJson || looksLikeHtml) {
              const snippet = raw.replace(/\s+/g, ' ').slice(0, 200);
              return reject(
                new Error(`CamPay réponse non-JSON (HTTP ${statusCode}) : ${snippet}`)
              );
            }

            try {
              const parsed = JSON.parse(raw);
              if (statusCode >= 400) {
                return reject(
                  new Error(
                    `CamPay erreur HTTP ${statusCode}: ${parsed?.message ?? parsed?.error ?? raw}`
                  )
                );
              }
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tranzak (Mobile Money MTN/Orange Cameroun) — collecte, vérif, payout.
  // Auth par token temporaire (~2h) obtenu via /auth/token et mis en cache.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retourne un token d'accès Tranzak valide, depuis le cache si possible.
   * Le token est rafraîchi à ~75% de sa durée de validité pour éviter qu'il
   * expire en plein appel.
   */
  private async getTranzakToken(): Promise<string> {
    if (!this.tranzakAppId || !this.tranzakAppKey) {
      throw new ServiceUnavailableException('Configuration Tranzak manquante.');
    }
    const now = Date.now();
    if (this.tranzakToken && now < this.tranzakTokenExpiresAt) {
      return this.tranzakToken;
    }
    const response = await this.requestTranzak(
      'POST',
      '/auth/token',
      { appId: this.tranzakAppId, appKey: this.tranzakAppKey },
      null
    );
    const data = response?.data ?? response;
    const token = data?.token ?? null;
    if (!token) {
      throw new ServiceUnavailableException('Authentification Tranzak échouée.');
    }
    const expiresIn = Number(data?.expiresIn);
    const ttlSeconds = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 7200;
    this.tranzakToken = token;
    this.tranzakTokenExpiresAt = now + Math.floor(ttlSeconds * 0.75) * 1000;
    return token;
  }

  private async postTranzak(path: string, body: unknown): Promise<any> {
    const token = await this.getTranzakToken();
    return this.requestTranzak('POST', path, body, token);
  }

  private async getTranzak(path: string): Promise<any> {
    const token = await this.getTranzakToken();
    return this.requestTranzak('GET', path, null, token);
  }

  /**
   * Transport bas niveau Tranzak. `token = null` uniquement pour /auth/token.
   * Toutes les réponses Tranzak ont une enveloppe { success, data, errorMsg,
   * errorCode } : un HTTP 200 avec success=false reste une erreur.
   */
  private requestTranzak(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    token: string | null
  ): Promise<any> {
    const base = this.tranzakBaseUrl.replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(`${base}/${normalizedPath}`);
    const transport = url.protocol === 'http:' ? httpRequest : httpsRequest;
    const payload = method === 'POST' ? JSON.stringify(body ?? {}) : null;
    const headers: Record<string, string | number> = {
      Accept: 'application/json'
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      if (this.tranzakAppId) {
        headers['X-App-ID'] = this.tranzakAppId;
      }
    }
    if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    return new Promise((resolve, reject) => {
      const req = transport(url, { method, headers }, res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const statusCode = res.statusCode ?? 0;
          const contentType = res.headers['content-type'] ?? '';
          const looksLikeHtml = raw.trim().startsWith('<');
          const isJson =
            typeof contentType === 'string' &&
            contentType.toLowerCase().includes('application/json');

          if (!raw) {
            return reject(
              new Error(`Tranzak réponse vide (HTTP ${statusCode}) pour ${url.toString()}`)
            );
          }
          if (!isJson || looksLikeHtml) {
            const snippet = raw.replace(/\s+/g, ' ').slice(0, 200);
            return reject(new Error(`Tranzak réponse non-JSON (HTTP ${statusCode}) : ${snippet}`));
          }

          try {
            const parsed = JSON.parse(raw);
            if (statusCode >= 400) {
              return reject(
                new Error(
                  `Tranzak erreur HTTP ${statusCode}: ${parsed?.errorMsg ?? parsed?.message ?? raw}`
                )
              );
            }
            if (parsed && parsed.success === false) {
              return reject(
                new Error(
                  `Tranzak erreur ${parsed?.errorCode ?? ''}: ${parsed?.errorMsg ?? 'échec'}`.trim()
                )
              );
            }
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      });
      req.on('error', reject);
      if (payload !== null) {
        req.write(payload);
      }
      req.end();
    });
  }

  async initTranzakCollect(params: {
    user: AuthUser;
    amount: number;
    currency: string;
    description: string;
    deliveryId?: string | null;
    listingId: string;
    paymentPhone?: string;
    extraMeta?: Record<string, unknown>;
  }): Promise<{ paymentId: string; reference: string; ussdCode?: string; operator?: string }> {
    if (!this.tranzakAppId || !this.tranzakAppKey) {
      throw new ServiceUnavailableException('Configuration Tranzak manquante.');
    }

    const requestedCurrency = (params.currency || 'XAF').toUpperCase();

    const account = await this.usersService.findOne(params.user.id);
    const phone = this.normalizeCampayPhone(params.paymentPhone ?? account.phoneNumber ?? '');
    if (!phone) {
      throw new BadRequestException('Numéro Mobile Money requis.');
    }

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        amount: params.amount.toFixed(2),
        currency: 'XAF',
        description: params.description,
        status: PaymentStatus.PENDING,
        userId: params.user.id,
        provider: 'tranzak',
        metadata: {
          deliveryId: params.deliveryId ?? null,
          listingId: params.listingId,
          type: params.extraMeta?.type ?? 'escrow',
          paymentMethod: 'mobile_money',
          originalCurrency: requestedCurrency,
          ...params.extraMeta
        }
      })
    );

    let response: Record<string, any> | null = null;
    try {
      response = await this.postTranzak('/xp021/v1/request/create-mobile-wallet-charge', {
        amount: Math.round(params.amount),
        currencyCode: 'XAF',
        description: params.description,
        mobileWalletNumber: phone,
        mchTransactionRef: payment.id,
        returnUrl: this.tranzakReturnUrl
      });
    } catch (error) {
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'tranzak',
        type: 'escrow_init_failed',
        status: 'failed',
        payload: {
          reason: error instanceof Error ? error.message : 'transport_error'
        }
      });
      throw error;
    }

    const data = response?.data ?? response;
    const reference = data?.requestId ?? response?.requestId;

    if (!reference) {
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'tranzak',
        type: 'escrow_init_failed',
        status: 'failed',
        payload: { reason: 'missing_request_id', response }
      });
      throw new ServiceUnavailableException(
        `Impossible de lancer le paiement Tranzak. Réponse: ${JSON.stringify(response)}`
      );
    }

    payment.externalReference = reference;
    payment.metadata = {
      ...(payment.metadata ?? {}),
      tranzakRequestId: reference
    };
    await this.paymentsRepository.save(payment);
    await this.logPaymentEvent({
      paymentId: payment.id,
      provider: 'tranzak',
      type: 'escrow_init',
      status: data?.status ?? response?.status ?? null,
      payload: response ?? null
    });

    return { paymentId: payment.id, reference };
  }

  /**
   * Applique à un paiement le statut RÉEL renvoyé par Tranzak (réponse
   * authentifiée par Bearer token). Unique source de vérité : ni le webhook
   * entrant, ni aucun payload client n'est traité comme fiable.
   */
  private async applyTranzakAuthoritativeStatus(
    payment: Payment,
    response: Record<string, any> | null,
    source: 'webhook' | 'verify'
  ): Promise<{ ok: true; status: PaymentStatus | string }> {
    const data = ((response as Record<string, any>)?.data ?? response ?? {}) as Record<
      string,
      any
    >;
    const statusRaw =
      data?.status ?? data?.paymentStatus ?? (response as Record<string, any>)?.status ?? 'pending';
    const status = String(statusRaw).toLowerCase();

    if (this.isProviderSuccessStatus(status)) {
      const transactionId = this.extractProviderTransactionId(
        response as Record<string, any>,
        'tranzak'
      );
      const debitConfirmed = this.hasOperatorDebitConfirmation({
        provider: 'tranzak',
        payment,
        payload: response as Record<string, any>,
        transactionId
      });

      if (!debitConfirmed) {
        await this.logPaymentEvent({
          paymentId: payment.id,
          provider: 'tranzak',
          type: `${source}_success_without_debit_proof`,
          status,
          payload: response ?? null
        });
        return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
      }

      if (!this.isAuthoritativeAmountValid(payment, response)) {
        await this.logPaymentEvent({
          paymentId: payment.id,
          provider: 'tranzak',
          type: `${source}_amount_mismatch`,
          status,
          payload: response ?? null
        });
        return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
      }

      const wasCompleted = payment.status === PaymentStatus.COMPLETED;
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...(payment.metadata ?? {}),
        tranzakTransactionId: transactionId,
        operatorDebitConfirmed: true,
        operatorDebitConfirmedAt: new Date().toISOString()
      };
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'tranzak',
        type: `${source}_completed`,
        status,
        payload: response ?? null
      });

      if (!wasCompleted) {
        const meta = {
          ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
        };
        await this.handlePaymentMeta(payment, meta);
      }
      return { ok: true, status: payment.status };
    }

    if (this.isProviderFailureStatus(status)) {
      payment.status = PaymentStatus.FAILED;
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'tranzak',
        type: `${source}_failed`,
        status,
        payload: response ?? null
      });
      const meta = {
        ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
      };
      await this.notifyEscrowPaymentFailed(payment, meta);
      return { ok: true, status: payment.status };
    }

    return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
  }

  async handleTranzakWebhook(payload: Record<string, any>) {
    const requestId =
      payload?.resource?.requestId ??
      payload?.resourceId ??
      payload?.requestId ??
      payload?.data?.requestId ??
      null;

    const payment = requestId
      ? await this.paymentsRepository.findOne({
          where: { externalReference: requestId }
        })
      : null;

    if (!payment) {
      await this.logPaymentEvent({
        provider: 'tranzak',
        type: 'webhook_unmatched',
        status: payload?.resource?.status ?? payload?.eventType ?? null,
        payload
      });
      return { ok: true, status: 'unknown' };
    }

    const authoritativeReference = payment.externalReference ?? requestId;

    // L'endpoint webhook est public : le payload entrant n'est JAMAIS digne de
    // confiance. On revérifie le statut réel auprès de Tranzak via un appel
    // serveur-à-serveur authentifié avant toute libération d'escrow.
    if (!this.tranzakAppId || !this.tranzakAppKey) {
      throw new ServiceUnavailableException('Configuration Tranzak manquante.');
    }
    let authoritative: Record<string, any> | null = null;
    try {
      authoritative = await this.getTranzak(
        `/xp021/v1/request/details?requestId=${encodeURIComponent(authoritativeReference)}`
      );
    } catch (error) {
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'tranzak',
        type: 'webhook_verify_error',
        status: payload?.resource?.status ?? null,
        payload: {
          requestId: authoritativeReference,
          reason: error instanceof Error ? error.message : 'transport_error'
        }
      });
      throw error;
    }

    return this.applyTranzakAuthoritativeStatus(payment, authoritative, 'webhook');
  }

  async verifyTranzakReference(user: AuthUser, reference: string) {
    if (!this.tranzakAppId || !this.tranzakAppKey) {
      throw new ServiceUnavailableException('Configuration Tranzak manquante.');
    }
    if (!reference) {
      throw new BadRequestException('reference manquant');
    }
    const payment = await this.paymentsRepository.findOne({
      where: { externalReference: reference }
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.userId !== user.id) {
      throw new ForbiddenException('Paiement non autorisé.');
    }

    const response = await this.getTranzak(
      `/xp021/v1/request/details?requestId=${encodeURIComponent(reference)}`
    );
    return this.applyTranzakAuthoritativeStatus(payment, response, 'verify');
  }

  async createTranzakMobileMoneyPayout(params: {
    amount: number;
    currency: string;
    beneficiaryName: string;
    accountNumber: string;
    network: 'mtn' | 'orange';
  }): Promise<{ payoutReference: string }> {
    if (!this.tranzakAppId || !this.tranzakAppKey) {
      throw new ServiceUnavailableException('Configuration Tranzak manquante.');
    }

    const phone = this.normalizeCampayPhone(params.accountNumber);
    if (!phone) {
      throw new BadRequestException('Numéro Mobile Money requis.');
    }

    const response = await this.postTranzak('/xp021/v1/transfer/to-mobile-wallet', {
      amount: Math.round(params.amount),
      currencyCode: (params.currency || 'XAF').toUpperCase(),
      description: 'Retrait wallet',
      customTransactionRef: randomUUID(),
      payeeAccountId: phone,
      payeeAccountName: params.beneficiaryName
    });

    const data = response?.data ?? response;
    const reference = data?.transferId ?? data?.transactionId ?? data?.id;
    if (!reference) {
      throw new ServiceUnavailableException('Impossible de lancer le retrait Tranzak.');
    }

    await this.logPaymentEvent({
      provider: 'tranzak',
      type: 'payout_transfer',
      status: data?.status ?? response?.status ?? null,
      payload: response?.data ?? response
    });

    return { payoutReference: reference };
  }

  private computeNextRenewalDate(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private isProviderSuccessStatus(rawStatus: string): boolean {
    const status = String(rawStatus ?? '').toLowerCase().trim();
    return status === 'completed' || status === 'success' || status === 'successful' || status === 'paid';
  }

  private isProviderFailureStatus(rawStatus: string): boolean {
    const status = String(rawStatus ?? '').toLowerCase().trim();
    return status === 'failed' || status === 'cancelled' || status === 'canceled';
  }

  private hasOperatorDebitConfirmation(input: {
    provider: 'zikopay' | 'campay' | 'tranzak' | 'mtn' | 'orange';
    payment: Payment;
    payload: Record<string, any> | null | undefined;
    transactionId: string | null;
  }): boolean {
    const paymentMethod = String(
      (input.payment.metadata as Record<string, unknown> | null | undefined)?.paymentMethod ?? ''
    ).toLowerCase();
    const isMobileMoneyPayment =
      input.provider !== 'zikopay' || paymentMethod === 'mobile_money';
    if (!isMobileMoneyPayment) {
      return true;
    }

    const explicitDebitFlag = this.extractBooleanCandidate(input.payload, [
      'debited',
      'isDebited',
      'is_debited',
      'fundsDebited',
      'funds_debited',
      'debitConfirmed',
      'debit_confirmed'
    ]);

    if (explicitDebitFlag !== null) {
      return explicitDebitFlag;
    }

    const debitStatus = this.extractStringCandidate(input.payload, [
      'debitStatus',
      'debit_status',
      'operatorStatus',
      'operator_status',
      'collectionStatus',
      'collection_status',
      'financialTransactionStatus',
      'financial_transaction_status'
    ]);

    if (debitStatus) {
      const normalized = debitStatus.toLowerCase();
      if (
        normalized === 'debited' ||
        normalized === 'collected' ||
        normalized === 'settled' ||
        normalized === 'success' ||
        normalized === 'successful' ||
        normalized === 'completed' ||
        normalized === 'paid'
      ) {
        return true;
      }
      if (
        normalized === 'failed' ||
        normalized === 'cancelled' ||
        normalized === 'canceled' ||
        normalized === 'rejected'
      ) {
        return false;
      }
    }

    return Boolean(input.transactionId);
  }

  private extractProviderTransactionId(
    payload: Record<string, any> | null | undefined,
    provider: 'zikopay' | 'campay' | 'tranzak' | 'mtn' | 'orange'
  ): string | null {
    const providerKeys: Record<'zikopay' | 'campay' | 'tranzak' | 'mtn' | 'orange', string[]> = {
      zikopay: [
        'external_transaction_id',
        'externalTransactionId',
        'transaction_id',
        'transactionId',
        'operator_transaction_id',
        'operatorTransactionId',
        'provider_transaction_id',
        'providerTransactionId',
        'payment_id',
        'paymentId'
      ],
      campay: [
        'operator_reference',
        'operatorReference',
        'reference',
        'external_reference',
        'code'
      ],
      tranzak: [
        'transactionId',
        'transaction_id',
        'transferId',
        'transfer_id',
        'requestId',
        'request_id'
      ],
      mtn: [
        'financialTransactionId',
        'financial_transaction_id',
        'transactionId',
        'transaction_id',
        'providerReference',
        'provider_reference'
      ],
      orange: [
        'txnid',
        'txn_id',
        'transaction_id',
        'transactionId',
        'payment_id',
        'paymentId',
        'providerReference',
        'provider_reference'
      ]
    };

    return this.extractStringCandidate(payload, providerKeys[provider]);
  }

  private extractStringCandidate(
    payload: Record<string, any> | null | undefined,
    keys: string[]
  ): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const containers: Record<string, any>[] = [payload];
    const nestedKeys = ['data', 'transaction', 'payment', 'result', 'details'];
    for (const nestedKey of nestedKeys) {
      const value = payload[nestedKey];
      if (value && typeof value === 'object') {
        containers.push(value as Record<string, any>);
      }
    }

    for (const container of containers) {
      for (const key of keys) {
        const value = container[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim();
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          return String(value);
        }
      }
    }
    return null;
  }

  private extractBooleanCandidate(
    payload: Record<string, any> | null | undefined,
    keys: string[]
  ): boolean | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const containers: Record<string, any>[] = [payload];
    const nestedKeys = ['data', 'transaction', 'payment', 'result', 'details'];
    for (const nestedKey of nestedKeys) {
      const value = payload[nestedKey];
      if (value && typeof value === 'object') {
        containers.push(value as Record<string, any>);
      }
    }

    for (const container of containers) {
      for (const key of keys) {
        const value = container[key];
        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'string') {
          const normalized = value.toLowerCase().trim();
          if (normalized === 'true' || normalized === 'yes' || normalized === '1') {
            return true;
          }
          if (normalized === 'false' || normalized === 'no' || normalized === '0') {
            return false;
          }
        }
        if (typeof value === 'number') {
          if (value === 1) {
            return true;
          }
          if (value === 0) {
            return false;
          }
        }
      }
    }
    return null;
  }
}
