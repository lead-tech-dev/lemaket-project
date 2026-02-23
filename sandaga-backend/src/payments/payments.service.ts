
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
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
import { URL } from 'url';
import { Delivery } from '../deliveries/delivery.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletsService } from './wallets.service';
import { WalletTransactionType } from '../common/enums/wallet-transaction-type.enum';
import { WalletTransaction } from './wallet-transaction.entity';
import { NotificationCategory } from '../notifications/notification-category.enum';
import { DeliveryStatus } from '../common/enums/delivery-status.enum';
import { OrdersService } from '../orders/orders.service';
import { MessagesService } from '../messages/messages.service';

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
  private readonly zikopayMockMode: boolean;
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
    this.zikopayMockMode = Boolean(zikopayConfig.mockMode);

    const promotionPriceMap =
      this.configService.get<Record<string, string>>('payments.promotionPriceMap') ?? {};
    this.promotionOptions = [
      {
        id: 'boost-monthly',
        title: 'Boost mensuel inclus',
        description: 'Un boost offert chaque mois pour maintenir votre visibilité.',
        price: 0,
        currency: 'XAF',
        categories: ['all'],
        isIncluded: true,
        monthlyLimit: 1
      },
      {
        id: 'boost-7',
        title: 'Boost 7 jours',
        description: 'Positionnez votre annonce en tête de liste pendant 7 jours.',
        price: 4900,
        currency: 'XAF',
        categories: ['immobilier', 'vehicules', 'maison'],
        stripePriceId: promotionPriceMap['boost-7'] || null
      },
      {
        id: 'boost-14',
        title: 'Boost 14 jours',
        description: 'Gagnez en visibilité pendant deux semaines complètes.',
        price: 8900,
        currency: 'XAF',
        categories: ['immobilier', 'high-tech', 'emploi'],
        stripePriceId: promotionPriceMap['boost-14'] || null
      },
      {
        id: 'pack-premium',
        title: 'Pack Premium',
        description: 'Inclut boost, remontées automatiques et badge Premium.',
        price: 14900,
        currency: 'XAF',
        categories: ['immobilier', 'services'],
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

  getPromotionOptions(category?: string) {
    if (!category) {
      return this.promotionOptions;
    }
    const normalized = category.toLowerCase();
    return this.promotionOptions.filter(option =>
      option.categories.some(item => item.toLowerCase() === 'all') ||
      option.categories.some(item => item.toLowerCase() === normalized)
    );
  }

  getMethods(user: AuthUser): Promise<PaymentMethodEntity[]> {
    return this.paymentMethodsRepository.find({
      where: { userId: user.id },
      order: { isDefault: 'DESC', created_at: 'DESC' }
    });
  }

  async addMethod(user: AuthUser, dto: CreatePaymentMethodDto): Promise<PaymentMethodEntity> {
    if (dto.isDefault) {
      await this.paymentMethodsRepository.update({ userId: user.id }, { isDefault: false });
    }

    const method = this.paymentMethodsRepository.create({
      ...dto,
      label: dto.label ?? this.buildMethodLabel(dto),
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

    if (dto.isDefault) {
      await this.paymentMethodsRepository.update({ userId: user.id }, { isDefault: false });
    }

    Object.assign(method, {
      ...dto,
      label: dto.label ?? method.label
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
    if (!user.isPro) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux comptes Pro.');
    }

    const listing = await this.listingsRepository.findOne({
      where: { id: dto.listingId }
    });
    if (!listing || listing.owner.id !== user.id) {
      throw new NotFoundException('Annonce introuvable ou non autorisée.');
    }

    if (this.isIncludedPromotion(option)) {
      await this.ensureMonthlyPromotionEligibility(user, option);
      const payment = await this.paymentsRepository.save(
        this.paymentsRepository.create({
          amount: option.price.toFixed(2),
          currency: option.currency,
          description: `Promotion – ${option.title}`,
          status: PaymentStatus.COMPLETED,
          userId: user.id,
          paymentMethodId: null,
          externalReference: 'included',
          metadata: {
            listingId: listing.id,
            promotionOptionId: option.id
          }
        })
      );
      await this.applyPromotionForPayment(payment, user).catch(error => {
        console.error('Unable to apply promotion after payment', error);
      });
      return {
        paymentId: payment.id,
        redirectUrl: null
      };
    }

    if (dto.paymentMethodId) {
      await this.findMethod(dto.paymentMethodId, user);
    }

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        amount: option.price.toFixed(2),
        currency: option.currency,
        description: `Promotion – ${option.title}`,
        status: PaymentStatus.PENDING,
        userId: user.id,
        paymentMethodId: dto.paymentMethodId ?? null,
        externalReference: null,
        metadata: {
          listingId: listing.id,
          promotionOptionId: option.id
        }
      })
    );

    if (!this.stripe) {
      payment.status = PaymentStatus.COMPLETED;
      payment.invoiceNumber = payment.invoiceNumber ?? payment.id;
      payment.externalReference = payment.externalReference ?? 'local';
      await this.paymentsRepository.save(payment);
      await this.applyPromotionForPayment(payment, user).catch(error => {
        console.error('Unable to apply promotion after payment', error);
      });
      return {
        paymentId: payment.id,
        redirectUrl: null
      };
    }

    const session = await this.stripe.checkout.sessions.create({
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
            await this.applyPromotionForPayment(payment, user).catch(error => {
              console.error('Unable to apply promotion after checkout', error);
            });
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
  } | null {
    if (optionId.toLowerCase() === 'boost-monthly') {
      return {
        type: PromotionType.BOOST,
        durationDays: 7
      };
    }
    const boostMatch = optionId.match(/^boost-(\d+)$/i);
    if (boostMatch) {
      return {
        type: PromotionType.BOOST,
        durationDays: Number(boostMatch[1]) || 7
      };
    }
    if (optionId.toLowerCase().includes('premium')) {
      return {
        type: PromotionType.PREMIUM,
        durationDays: 30
      };
    }
    if (optionId.toLowerCase().includes('featured')) {
      return {
        type: PromotionType.FEATURED,
        durationDays: 7
      };
    }
    if (optionId.toLowerCase().includes('highlight')) {
      return {
        type: PromotionType.HIGHLIGHT,
        durationDays: 7
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
      return;
    }

    const option = this.promotionOptions.find(item => item.id === optionId);
    const definition = option ? this.resolvePromotionDefinition(option.id) : null;
    if (!option || !definition) {
      return;
    }

    const listing = await this.listingsRepository.findOne({
      where: { id: listingId },
      relations: { owner: true }
    });
    if (!listing || listing.owner?.id !== user.id) {
      return;
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + definition.durationDays * 24 * 60 * 60 * 1000);

    const promotion = await this.promotionsRepository.save(
      this.promotionsRepository.create({
        name: option.title,
        type: definition.type,
        status: PromotionStatus.ACTIVE,
        startDate: now,
        endDate,
        budget: option.price.toFixed(2),
        description: option.description,
        listingId: listing.id
      })
    );

    const shouldBoost =
      definition.type === PromotionType.BOOST ||
      definition.type === PromotionType.PREMIUM;
    const shouldFeature =
      definition.type === PromotionType.FEATURED ||
      definition.type === PromotionType.PREMIUM;

    if (shouldBoost || shouldFeature) {
      listing.isBoosted = listing.isBoosted || shouldBoost;
      listing.isFeatured = listing.isFeatured || shouldFeature;
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

  private buildMethodLabel(dto: CreatePaymentMethodDto): string {
    if (dto.type === 'card') {
      return `${dto.brand ?? 'Carte'} ${dto.last4 ? `**** ${dto.last4}` : ''}`.trim();
    }
    if (dto.type === 'wallet') {
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
      if (!this.zikopayMockMode) {
        throw error;
      }
      const mockReference = `mock_zikopay_${Date.now()}_${payment.id.slice(0, 8)}`;
      payment.externalReference = mockReference;
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...(payment.metadata ?? {}),
        zikopayMock: true,
        zikopayMockReason: error instanceof Error ? error.message : 'transport_error'
      };
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'zikopay',
        type: 'escrow_init_mocked',
        status: 'completed',
        payload: { reason: payment.metadata.zikopayMockReason }
      });
      const meta = {
        ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
      };
      await this.handlePaymentMeta(payment, meta);
      return { paymentId: payment.id, reference: mockReference };
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
      if (this.zikopayMockMode) {
        const mockReference = `mock_zikopay_${Date.now()}_${payment.id.slice(0, 8)}`;
        payment.externalReference = mockReference;
        payment.status = PaymentStatus.COMPLETED;
        payment.metadata = {
          ...(payment.metadata ?? {}),
          zikopayMock: true,
          zikopayRawResponse: response ?? null
        };
        await this.paymentsRepository.save(payment);
        await this.logPaymentEvent({
          paymentId: payment.id,
          provider: 'zikopay',
          type: 'escrow_init_mocked',
          status: 'completed',
          payload: { reason: 'missing_reference', response }
        });
        const meta = {
          ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
        };
        await this.handlePaymentMeta(payment, meta);
        return { paymentId: payment.id, reference: mockReference };
      }

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

    const statusRaw =
      payload?.status ?? payload?.data?.status ?? payload?.paymentStatus ?? 'pending';
    const status = String(statusRaw).toLowerCase();

    if (status === 'completed' || status === 'success' || status === 'successful' || status === 'paid') {
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...(payment.metadata ?? {}),
        zikopayTransactionId: payload?.external_transaction_id ?? payload?.data?.external_transaction_id ?? null
      };
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'zikopay',
        type: 'webhook_completed',
        status,
        payload
      });

      const meta = {
        ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
      };
      await this.handlePaymentMeta(payment, meta);
      return { ok: true, status: payment.status };
    }

    if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
      payment.status = PaymentStatus.FAILED;
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'zikopay',
        type: 'webhook_failed',
        status,
        payload
      });
      const meta = {
        ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
      };
      await this.notifyEscrowPaymentFailed(payment, meta);
      return { ok: true, status: payment.status };
    }

    return { ok: true, status: payment.status ?? PaymentStatus.PENDING };
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

    const paymentMetadata =
      typeof payment.metadata === 'object' && payment.metadata
        ? (payment.metadata as Record<string, unknown>)
        : {};
    const isMockReference = reference.startsWith('mock_zikopay_');
    const isMockPayment = Boolean(paymentMetadata.zikopayMock) || isMockReference;
    if (this.zikopayMockMode || isMockPayment) {
      if (payment.status === PaymentStatus.PENDING) {
        payment.status = PaymentStatus.COMPLETED;
        payment.metadata = {
          ...(payment.metadata ?? {}),
          zikopayMock: true
        };
        await this.paymentsRepository.save(payment);
        const meta = {
          ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
        };
        await this.handlePaymentMeta(payment, meta);
      }
      return { ok: true, status: payment.status ?? PaymentStatus.COMPLETED };
    }

    let response: Record<string, unknown> | null = null;
    try {
      response = await this.getZikopay(`/payments/status/${encodeURIComponent(reference)}`);
    } catch (error) {
      if (this.zikopayMockMode) {
        if (payment.status === PaymentStatus.PENDING) {
          payment.status = PaymentStatus.COMPLETED;
          payment.metadata = {
            ...(payment.metadata ?? {}),
            zikopayMock: true,
            zikopayVerifyFallback: error instanceof Error ? error.message : 'unknown_error'
          };
          await this.paymentsRepository.save(payment);
          const meta = {
            ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
          };
          await this.handlePaymentMeta(payment, meta);
        }
        return { ok: true, status: payment.status ?? PaymentStatus.COMPLETED };
      }
      throw error;
    }
    const data = ((response as Record<string, unknown>)?.data ??
      response) as Record<string, unknown>;
    const statusRaw = data?.status ?? data?.paymentStatus ?? 'pending';
    const status = String(statusRaw).toLowerCase();

    if (status === 'completed' || status === 'success' || status === 'successful' || status === 'paid') {
      payment.status = PaymentStatus.COMPLETED;
      payment.metadata = {
        ...(payment.metadata ?? {}),
        zikopayTransactionId: data?.external_transaction_id ?? null
      };
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'zikopay',
        type: 'verify_completed',
        status,
        payload: response ?? null
      });
      const meta = {
        ...(typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {})
      };
      await this.handlePaymentMeta(payment, meta);
      return { ok: true, status: payment.status };
    }

    if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
      payment.status = PaymentStatus.FAILED;
      await this.paymentsRepository.save(payment);
      await this.logPaymentEvent({
        paymentId: payment.id,
        provider: 'zikopay',
        type: 'verify_failed',
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

    await this.createZikopayMobileMoneyPayout({
      amount,
      currency,
      beneficiaryName: payoutName || seller.email,
      accountNumber: payoutNumber,
      network: payoutNetwork
    });

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
    if (status === 'SUCCESSFUL' || status === 'SUCCESS') {
      payment.status = PaymentStatus.COMPLETED;
    } else if (status === 'FAILED' || status === 'REJECTED') {
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
    if (status === 'SUCCESS' || status === 'PAID') {
      payment.status = PaymentStatus.COMPLETED;
    } else if (status === 'FAILED' || status === 'CANCELLED') {
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

  private computeNextRenewalDate(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
