import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Delivery } from './delivery.entity';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { InitDeliveryEscrowDto } from './dto/init-delivery-escrow.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { DeliveryStatus } from '../common/enums/delivery-status.enum';
import { ListingsService } from '../listings/listings.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Payment } from '../payments/payment.entity';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/notification-category.enum';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { WalletsService } from '../payments/wallets.service';
import { WalletTransactionType } from '../common/enums/wallet-transaction-type.enum';
import { MessagesService } from '../messages/messages.service';

type CourierLocation = {
  city?: string;
  zipcode?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number | null;
};

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly deliveriesRepository: Repository<Delivery>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly listingsService: ListingsService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentsService: PaymentsService,
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
    private readonly walletsService: WalletsService,
    private readonly messagesService: MessagesService,
    private readonly configService: ConfigService
  ) {}

  private async isCourier(user: AuthUser): Promise<boolean> {
    const fullUser = await this.usersService.findOne(user.id);
    return Boolean(
      (fullUser.settings as Record<string, unknown> | undefined)?.isCourier &&
        fullUser.courierVerificationStatus === 'approved'
    );
  }

  private getCourierLocation(fullUser: { settings?: Record<string, unknown> | null }): CourierLocation | null {
    const courierLocation = (fullUser.settings as Record<string, unknown> | undefined)?.courierLocation as
      | CourierLocation
      | undefined;
    if (!courierLocation) return null;
    const lat = typeof courierLocation.lat === 'number' ? courierLocation.lat : undefined;
    const lng = typeof courierLocation.lng === 'number' ? courierLocation.lng : undefined;
    const radiusKmRaw = (fullUser.settings as Record<string, unknown> | undefined)?.courierRadiusKm as
      | number
      | undefined;
    const radiusKm =
      typeof radiusKmRaw === 'number' && Number.isFinite(radiusKmRaw) ? radiusKmRaw : null;
    return { ...courierLocation, lat, lng, radiusKm };
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

  private generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async notifyNearbyCouriers(
    delivery: Delivery,
    pickup: { lat: number; lng: number; city?: string; zipcode?: string }
  ) {
    const candidates = await this.usersService.listCouriersNearby({
      city: pickup.city,
      zipcode: pickup.zipcode,
      limit: 25
    });
    const nearby = candidates.filter(courier => {
      if (!courier.lat || !courier.lng) return false;
      const radiusKm =
        typeof (courier as any).radiusKm === 'number' && Number.isFinite((courier as any).radiusKm)
          ? (courier as any).radiusKm
          : 15;
      return this.haversineKm(pickup, { lat: courier.lat, lng: courier.lng }) <= radiusKm;
    });
    await Promise.all(
      nearby.map(courier =>
        this.notificationsService.createNotification({
          userId: courier.id,
          category: NotificationCategory.SYSTEM,
          title: 'Nouvelle course disponible',
          body: 'Une livraison est disponible près de vous.',
          metadata: { deliveryId: delivery.id }
        })
      )
    );
  }

  async createDelivery(user: AuthUser, dto: CreateDeliveryDto): Promise<Delivery> {
    const listing = await this.listingsService.findOne(dto.listingId);

    if (listing.owner.id === user.id) {
      throw new BadRequestException('Vous ne pouvez pas demander la livraison de votre propre annonce.');
    }

    const pickupAddress =
      dto.pickupAddress ??
      listing.location?.address ??
      (listing.location?.city && listing.location?.zipcode
        ? `${listing.location.city} ${listing.location.zipcode}`
        : listing.location?.city ?? null) ??
      null;
    const delivery = this.deliveriesRepository.create({
      listingId: dto.listingId,
      buyerId: user.id,
      sellerId: listing.owner.id,
      pickupAddress,
      dropoffAddress: dto.dropoffAddress,
      dropoffNotes: dto.dropoffNotes ?? null,
      pickupLat: dto.pickupLat ?? listing.location?.lat ?? null,
      pickupLng: dto.pickupLng ?? listing.location?.lng ?? null,
      dropoffLat: dto.dropoffLat ?? null,
      dropoffLng: dto.dropoffLng ?? null,
      price: dto.price ? dto.price.toFixed(2) : null,
      currency: dto.currency ?? 'XAF',
      status: DeliveryStatus.REQUESTED,
      pickupCode: this.generateVerificationCode(),
      deliveryCode: this.generateVerificationCode(),
      escrowStatus: 'none',
      escrowCurrency: listing.currency || 'XAF'
    });

    const saved = await this.deliveriesRepository.save(delivery);
    await this.notificationsService.createNotification({
      userId: listing.owner.id,
      category: NotificationCategory.SYSTEM,
      title: 'Nouvelle demande de livraison',
      body: `Une demande de livraison a été créée pour "${listing.title}".`,
      metadata: { deliveryId: saved.id, listingId: listing.id }
    });
    if (
      typeof saved.pickupLat === 'number' &&
      typeof saved.pickupLng === 'number'
    ) {
      await this.notifyNearbyCouriers(saved, {
        lat: saved.pickupLat,
        lng: saved.pickupLng,
        city: listing.location?.city ?? undefined,
        zipcode: listing.location?.zipcode ?? undefined
      });
    }
    return saved;
  }

  async initDeliveryEscrow(
    user: AuthUser,
    dto: InitDeliveryEscrowDto
  ): Promise<{
    paymentId: string;
    orderId: string;
    paymentUrl?: string;
    reference?: string;
  }> {
    const listing = await this.listingsService.findOne(dto.listingId);
    const buyer = await this.usersService.findOne(user.id);

    if (listing.owner.id === user.id) {
      throw new BadRequestException('Vous ne pouvez pas payer votre propre annonce.');
    }

    const listingPrice = Number(listing.price ?? 0);
    if (!Number.isFinite(listingPrice) || listingPrice <= 0) {
      throw new BadRequestException('Le montant de l’annonce est invalide.');
    }

    const existing = await this.deliveriesRepository.findOne({
      where: { listingId: dto.listingId, buyerId: user.id },
      order: { created_at: 'DESC' }
    });
    if (existing && existing.status !== DeliveryStatus.CANCELED) {
      let order = await this.ordersService.findByDeliveryId(existing.id);
      const existingPaymentId = existing.escrowPaymentId ?? null;
      const existingPayment =
        existingPaymentId
          ? await this.paymentsRepository.findOne({ where: { id: existingPaymentId } })
          : null;

      if (!order && existingPayment) {
        order = await this.ordersService.createPendingOrder({
          listing,
          buyerId: user.id,
          paymentId: existingPayment.id,
          handoverMode: existing.handoverMode ?? 'delivery',
          deliveryPrice: existing.price ? Number(existing.price) : null
        });
        await this.ordersService.attachDelivery(order.id, existing.id);
        await this.ordersService.updateFromDelivery(order.id, existing.status);
      }

      const existingMeta =
        typeof existingPayment?.metadata === 'object' && existingPayment?.metadata
          ? (existingPayment.metadata as Record<string, unknown>)
          : {};

      if (order && existingPayment?.status === PaymentStatus.COMPLETED) {
        if (!order.deliveryId) {
          await this.ordersService.attachDelivery(order.id, existing.id);
        }
        await this.ordersService.markPaid(order.id);
        await this.ordersService.updateFromDelivery(order.id, existing.status);
        return {
          paymentId: existingPayment.id,
          orderId: order.id,
          reference:
            existingPayment.externalReference ??
            (typeof existingMeta.zikopayReference === 'string'
              ? existingMeta.zikopayReference
              : undefined)
        };
      }

      if (order && existingPayment?.status === PaymentStatus.PENDING) {
        return {
          paymentId: existingPayment.id,
          orderId: order.id,
          paymentUrl:
            typeof existingMeta.zikopayPaymentUrl === 'string'
              ? existingMeta.zikopayPaymentUrl
              : undefined,
          reference:
            existingPayment.externalReference ??
            (typeof existingMeta.zikopayReference === 'string'
              ? existingMeta.zikopayReference
              : undefined)
        };
      }

      if (
        existingPayment &&
        (existingPayment.status === PaymentStatus.FAILED ||
          existingPayment.status === PaymentStatus.REFUNDED)
      ) {
        existing.status = DeliveryStatus.CANCELED;
        existing.canceledAt = new Date();
        existing.cancelReason = 'retry_after_failed_payment';
        await this.deliveriesRepository.save(existing);
        if (order) {
          await this.ordersService.updateFromDelivery(order.id, existing.status);
        }
      } else {
        throw new BadRequestException('Une livraison existe déjà pour cette annonce.');
      }

    }

    const handoverMode = dto.handoverMode ?? 'delivery';
    const allowedModes =
      listing.formData && typeof listing.formData === 'object'
        ? (listing.formData as any).handover_modes
        : null;
    if (Array.isArray(allowedModes) && allowedModes.length > 0) {
      const normalized = allowedModes.map(mode => String(mode).toLowerCase());
      if (!normalized.includes(handoverMode)) {
        throw new BadRequestException('Ce mode de remise n’est pas disponible pour cette annonce.');
      }
    }

    if (handoverMode === 'delivery' && !dto.dropoffAddress) {
      throw new BadRequestException('Adresse de livraison requise.');
    }

    const paymentMethod = dto.paymentMethod ?? 'mobile_money';
    const deliveryPriceValue = Number(dto.price ?? 0);
    const deliveryPrice = Number.isFinite(deliveryPriceValue) ? deliveryPriceValue : 0;
    const paymentAmount = listingPrice + deliveryPrice;

    const baseMeta = {
      type: 'delivery_escrow',
      listingId: listing.id,
      dropoffAddress: dto.dropoffAddress?.trim() || null,
      dropoffNotes: dto.dropoffNotes?.trim() || null,
      deliveryPrice: deliveryPrice || null,
      deliveryCurrency: dto.currency ?? listing.currency ?? 'XAF',
      preferredCourierId: dto.preferredCourierId ?? null,
      handoverMode,
      paymentMethod
    };

    if (paymentMethod === 'wallet') {
      const totalAmount = paymentAmount;
      const balance = await this.walletsService.getBalance(user.id);
      if (balance.currency !== (listing.currency || 'XAF')) {
        throw new BadRequestException('Devise du wallet incompatible.');
      }
      if (balance.balance < totalAmount) {
        throw new BadRequestException('Solde wallet insuffisant.');
      }

      const payment = await this.paymentsRepository.save(
        this.paymentsRepository.create({
          amount: totalAmount.toFixed(2),
          currency: listing.currency || 'XAF',
          description: `Paiement sécurisé pour ${listing.title}`,
          status: PaymentStatus.COMPLETED,
          userId: user.id,
          provider: 'wallet',
          metadata: baseMeta
        })
      );

      await this.walletsService.debit({
        userId: user.id,
        amount: totalAmount,
        currency: listing.currency || 'XAF',
        type: WalletTransactionType.HOLD,
        metadata: { paymentId: payment.id, listingId: listing.id }
      });

      const pickupAddress =
        listing.location?.address ??
        (listing.location?.city && listing.location?.zipcode
          ? `${listing.location.city} ${listing.location.zipcode}`
          : listing.location?.city ?? null) ??
        null;

      const delivery = this.deliveriesRepository.create({
        listingId: listing.id,
        buyerId: user.id,
        sellerId: listing.owner.id,
        pickupAddress,
        dropoffAddress: dto.dropoffAddress?.trim() || null,
        dropoffNotes: dto.dropoffNotes?.trim() || null,
        pickupLat: listing.location?.lat ?? null,
        pickupLng: listing.location?.lng ?? null,
        price: Number.isFinite(deliveryPrice) ? deliveryPrice.toFixed(2) : null,
        currency: dto.currency ?? listing.currency ?? 'XAF',
        status: DeliveryStatus.REQUESTED,
        deliveredAt: null,
        pickupCode: handoverMode === 'delivery' ? this.generateVerificationCode() : null,
        deliveryCode: handoverMode === 'delivery' ? this.generateVerificationCode() : null,
        escrowStatus: 'held',
        escrowPaymentId: payment.id,
        escrowAmount: payment.amount,
        escrowCurrency: payment.currency,
        preferredCourierId: dto.preferredCourierId ?? null,
        handoverMode
      });

      const savedDelivery = await this.deliveriesRepository.save(delivery);
      const order = await this.ordersService.createPendingOrder({
        listing,
        buyerId: user.id,
        paymentId: payment.id,
        handoverMode,
        deliveryPrice: deliveryPrice || null
      });
      await this.ordersService.attachDelivery(order.id, savedDelivery.id);
      await this.ordersService.markPaid(order.id);
      await this.ordersService.updateFromDelivery(order.id, savedDelivery.status);

      payment.metadata = { ...(payment.metadata ?? {}), orderId: order.id, deliveryId: savedDelivery.id };
      await this.paymentsRepository.save(payment);

      await Promise.all([
        this.notificationsService.createNotification({
          userId: user.id,
          category: NotificationCategory.SYSTEM,
          title: 'Paiement confirmé',
          body: `Votre paiement sécurisé pour "${listing.title}" est confirmé.`,
          metadata: { deliveryId: savedDelivery.id, listingId: listing.id }
        }),
        this.notificationsService.createNotification({
          userId: listing.owner.id,
          category: NotificationCategory.SYSTEM,
          title: 'Paiement reçu',
          body: `Un acheteur a payé pour "${listing.title}". Préparez le colis.`,
          metadata: { deliveryId: savedDelivery.id, listingId: listing.id }
        })
      ]);

      if (
        handoverMode === 'delivery' &&
        typeof savedDelivery.pickupLat === 'number' &&
        typeof savedDelivery.pickupLng === 'number'
      ) {
        await this.notifyNearbyCouriers(savedDelivery, {
          lat: savedDelivery.pickupLat,
          lng: savedDelivery.pickupLng,
          city: listing.location?.city ?? undefined,
          zipcode: listing.location?.zipcode ?? undefined
        });
      }

      await this.messagesService.sendTimelineEvent({
        listingId: listing.id,
        buyerId: user.id,
        sellerId: listing.owner.id,
        actorId: user.id,
        content:
          handoverMode === 'pickup'
            ? 'Paiement sécurisé confirmé. Vous pouvez convenir d’un rendez-vous pour la remise en main propre.'
            : 'Paiement sécurisé confirmé. Recherche d’un livreur en cours.'
      });

      return { paymentId: payment.id, paymentUrl: '', orderId: order.id };
    }

    const paymentPhone =
      typeof dto.paymentPhone === 'string' && dto.paymentPhone.trim()
        ? dto.paymentPhone.trim()
        : buyer.phoneNumber ?? '';
    const paymentOperator = dto.paymentOperator ?? undefined;

    if (paymentMethod === 'mobile_money' && !paymentOperator) {
      throw new BadRequestException('Opérateur Mobile Money requis.');
    }
    if (paymentMethod === 'mobile_money' && !paymentPhone) {
      throw new BadRequestException('Numéro Mobile Money requis.');
    }

    const payment = await this.paymentsService.initZikopayEscrowPayment({
      user,
      amount: paymentAmount,
      currency: listing.currency || 'XAF',
      description: `Paiement sécurisé pour ${listing.title}`,
      deliveryId: null,
      listingId: listing.id,
      paymentMethod: paymentMethod === 'card' ? 'card' : 'mobile_money',
      paymentOperator,
      paymentPhone,
      extraMeta: baseMeta
    });

    const order = await this.ordersService.createPendingOrder({
      listing,
      buyerId: user.id,
      paymentId: payment.paymentId,
      handoverMode,
      deliveryPrice: deliveryPrice || null
    });

    const paymentRecord = await this.paymentsRepository.findOne({
      where: { id: payment.paymentId }
    });
    if (paymentRecord) {
      paymentRecord.metadata = {
        ...(typeof paymentRecord.metadata === 'object' && paymentRecord.metadata
          ? paymentRecord.metadata
          : {}),
        orderId: order.id
      };
      await this.paymentsRepository.save(paymentRecord);

      // In mock mode the payment can be completed before the order is created.
      // Reconcile order/delivery linkage and status immediately in that case.
      if (paymentRecord.status === PaymentStatus.COMPLETED) {
        let deliveryId: string | null = null;
        if (
          typeof paymentRecord.metadata === 'object' &&
          paymentRecord.metadata &&
          typeof (paymentRecord.metadata as Record<string, unknown>).deliveryId === 'string'
        ) {
          deliveryId = (paymentRecord.metadata as Record<string, string>).deliveryId;
        }
        if (!deliveryId) {
          const linkedDelivery = await this.deliveriesRepository.findOne({
            where: { escrowPaymentId: paymentRecord.id },
            order: { created_at: 'DESC' }
          });
          deliveryId = linkedDelivery?.id ?? null;
        }
        if (deliveryId) {
          await this.ordersService.attachDelivery(order.id, deliveryId);
          const linkedDelivery = await this.deliveriesRepository.findOne({
            where: { id: deliveryId }
          });
          await this.ordersService.markPaid(order.id);
          if (linkedDelivery) {
            await this.ordersService.updateFromDelivery(order.id, linkedDelivery.status);
          }
        } else {
          await this.ordersService.markPaid(order.id);
        }
      }
    }

    return {
      paymentId: payment.paymentId,
      paymentUrl: payment.paymentUrl,
      reference: payment.reference,
      orderId: order.id
    };
  }

  async listAvailable(user: AuthUser): Promise<Delivery[]> {
    if (!(await this.isCourier(user))) {
      throw new ForbiddenException('Vous devez activer le mode livreur.');
    }
    const fullUser = await this.usersService.findOne(user.id);
    const courierLocation = this.getCourierLocation(fullUser);
    if (!courierLocation?.lat || !courierLocation?.lng) {
      return [];
    }
    const radiusKm = 15;
    const deliveries = await this.deliveriesRepository.find({
      where: {
        status: DeliveryStatus.REQUESTED,
        courierId: null,
        escrowStatus: 'held',
        handoverMode: 'delivery'
      },
      relations: { listing: true, buyer: true, seller: true }
    });
    return deliveries
      .map(delivery => {
        if (typeof delivery.pickupLat !== 'number' || typeof delivery.pickupLng !== 'number') {
          return { delivery, distanceKm: null };
        }
        const distanceKm = this.haversineKm(
          { lat: courierLocation.lat!, lng: courierLocation.lng! },
          { lat: delivery.pickupLat, lng: delivery.pickupLng }
        );
        return { delivery, distanceKm };
      })
      .filter(item => item.distanceKm !== null && item.distanceKm <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      .map(item => ({ ...item.delivery, distanceKm: item.distanceKm! }) as Delivery & {
        distanceKm: number;
      });
  }

  async listMine(user: AuthUser): Promise<Delivery[]> {
    return this.deliveriesRepository.find({
      where: [
        { buyerId: user.id },
        { sellerId: user.id },
        { courierId: user.id }
      ],
      relations: { listing: true, buyer: true, seller: true, courier: true },
      order: { created_at: 'DESC' }
    });
  }

  async acceptDelivery(id: string, user: AuthUser): Promise<Delivery> {
    const delivery = await this.findOrFail(id);
    if (delivery.status !== DeliveryStatus.REQUESTED || delivery.courierId) {
      throw new BadRequestException('Cette course n’est plus disponible.');
    }
    if (delivery.escrowStatus !== 'held') {
      throw new BadRequestException('Le paiement sécurisé doit être confirmé avant acceptation.');
    }
    if (!(await this.isCourier(user))) {
      throw new ForbiddenException('Vous devez activer le mode livreur.');
    }
    delivery.courierId = user.id;
    delivery.status = DeliveryStatus.ACCEPTED;
    delivery.acceptedAt = new Date();
    const saved = await this.deliveriesRepository.save(delivery);
    const order = await this.ordersService.findByDeliveryId(saved.id);
    if (order) {
      await this.ordersService.updateFromDelivery(order.id, saved.status);
    }
    await Promise.all([
      this.notificationsService.createNotification({
        userId: delivery.buyerId,
        category: NotificationCategory.SYSTEM,
        title: 'Livraison acceptée',
        body: 'Un livreur a accepté votre course.',
        metadata: { deliveryId: delivery.id }
      }),
      this.notificationsService.createNotification({
        userId: delivery.sellerId,
        category: NotificationCategory.SYSTEM,
        title: 'Livraison acceptée',
        body: 'Un livreur a accepté la course.',
        metadata: { deliveryId: delivery.id }
      })
    ]);
    await this.messagesService.attachCourierToConversation({
      listingId: saved.listingId,
      buyerId: saved.buyerId,
      sellerId: saved.sellerId,
      courierId: user.id
    });
    await this.messagesService.sendTimelineEvent({
      listingId: saved.listingId,
      buyerId: saved.buyerId,
      sellerId: saved.sellerId,
      actorId: user.id,
      content: 'Un livreur a accepté la course. Le retrait du colis est en préparation.'
    });
    return saved;
  }

  async updateStatus(
    id: string,
    user: AuthUser,
    dto: UpdateDeliveryStatusDto
  ): Promise<Delivery> {
    const delivery = await this.findOrFail(id);
    if (delivery.courierId !== user.id) {
      throw new ForbiddenException('Accès refusé.');
    }

    if (dto.status === DeliveryStatus.PICKED_UP) {
      if (delivery.escrowStatus !== 'held') {
        throw new BadRequestException('Le paiement sécurisé doit être confirmé avant le retrait.');
      }
      throw new BadRequestException('Utilisez le code de remise pour confirmer le retrait.');
    } else if (dto.status === DeliveryStatus.DELIVERED) {
      throw new BadRequestException('Utilisez le code de réception pour confirmer la livraison.');
    } else {
      throw new BadRequestException('Statut non supporté pour cette action.');
    }

    const saved = await this.deliveriesRepository.save(delivery);
    const order = await this.ordersService.findByDeliveryId(saved.id);
    if (order) {
      await this.ordersService.updateFromDelivery(order.id, saved.status);
    }
    return saved;
  }

  async cancelDelivery(id: string, user: AuthUser, reason?: string): Promise<Delivery> {
    const delivery = await this.findOrFail(id);
    const isOwner =
      delivery.buyerId === user.id || delivery.sellerId === user.id || delivery.courierId === user.id;
    if (!isOwner) {
      throw new ForbiddenException('Accès refusé.');
    }
    if (delivery.status === DeliveryStatus.DELIVERED) {
      throw new BadRequestException('La livraison est déjà terminée.');
    }
    delivery.status = DeliveryStatus.CANCELED;
    delivery.canceledAt = new Date();
    delivery.cancelReason = reason ?? null;
    if (delivery.escrowPaymentId && delivery.escrowStatus === 'held') {
      const payment = await this.paymentsRepository.findOne({
        where: { id: delivery.escrowPaymentId }
      });
      if (payment?.provider === 'flutterwave') {
        await this.paymentsService.refundFlutterwavePayment(payment);
      } else {
        await this.paymentsRepository.update(delivery.escrowPaymentId, {
          status: PaymentStatus.REFUNDED
        });
      }
      delivery.escrowStatus = 'refunded';
    }
    const saved = await this.deliveriesRepository.save(delivery);
    const order = await this.ordersService.findByDeliveryId(saved.id);
    if (order) {
      await this.ordersService.updateFromDelivery(order.id, saved.status);
    }
    const actorLabel =
      delivery.buyerId === user.id
        ? 'Acheteur'
        : delivery.sellerId === user.id
          ? 'Vendeur'
          : 'Livreur';
    await this.messagesService.sendTimelineEvent({
      listingId: saved.listingId,
      buyerId: saved.buyerId,
      sellerId: saved.sellerId,
      actorId: user.id,
      content: `La livraison a été annulée par ${actorLabel.toLowerCase()}${
        reason?.trim() ? ` (${reason.trim()})` : '.'
      }`
    });
    return saved;
  }

  async getPickupCode(id: string, user: AuthUser): Promise<{ code: string }> {
    const delivery = await this.findOrFail(id);
    if (delivery.sellerId !== user.id) {
      throw new ForbiddenException('Accès refusé.');
    }
    if (!delivery.pickupCode) {
      delivery.pickupCode = this.generateVerificationCode();
      await this.deliveriesRepository.save(delivery);
    }
    return { code: delivery.pickupCode };
  }

  async confirmPickupCode(id: string, user: AuthUser, code: string): Promise<Delivery> {
    const delivery = await this.findOrFail(id);
    if (delivery.courierId !== user.id) {
      throw new ForbiddenException('Accès refusé.');
    }
    if (delivery.status !== DeliveryStatus.ACCEPTED) {
      throw new BadRequestException('La course doit être acceptée avant le retrait.');
    }
    if (delivery.escrowStatus !== 'held') {
      throw new BadRequestException('Le paiement sécurisé doit être confirmé avant le retrait.');
    }
    if (!delivery.pickupCode || delivery.pickupCode !== code) {
      throw new BadRequestException('Code invalide.');
    }
    if (!delivery.deliveryCode) {
      delivery.deliveryCode = this.generateVerificationCode();
    }
    delivery.status = DeliveryStatus.PICKED_UP;
    delivery.pickedUpAt = new Date();
    delivery.pickupCodeVerifiedAt = new Date();
    const saved = await this.deliveriesRepository.save(delivery);
    const order = await this.ordersService.findByDeliveryId(saved.id);
    if (order) {
      await this.ordersService.updateFromDelivery(order.id, saved.status);
    }
    await Promise.all([
      this.notificationsService.createNotification({
        userId: delivery.buyerId,
        category: NotificationCategory.SYSTEM,
        title: 'Colis récupéré',
        body: 'Le livreur a récupéré votre colis.',
        metadata: { deliveryId: delivery.id }
      }),
      this.notificationsService.createNotification({
        userId: delivery.sellerId,
        category: NotificationCategory.SYSTEM,
        title: 'Colis récupéré',
        body: 'Le livreur a récupéré le colis.',
        metadata: { deliveryId: delivery.id }
      })
    ]);
    if (delivery.buyer?.phoneNumber && delivery.deliveryCode) {
      await this.notificationsService.sendSms(
        delivery.buyer.phoneNumber,
        `Votre code de réception: ${delivery.deliveryCode}`
      );
    }
    await this.messagesService.sendTimelineEvent({
      listingId: saved.listingId,
      buyerId: saved.buyerId,
      sellerId: saved.sellerId,
      actorId: user.id,
      content:
        'Le livreur a récupéré le colis. Livraison en cours, un code de réception a été envoyé à l’acheteur.'
    });
    return saved;
  }

  async getDeliveryCode(id: string, user: AuthUser): Promise<{ sent: boolean }> {
    const delivery = await this.findOrFail(id);
    if (delivery.buyerId !== user.id) {
      throw new ForbiddenException('Accès refusé.');
    }
    if (!delivery.deliveryCode) {
      delivery.deliveryCode = this.generateVerificationCode();
      await this.deliveriesRepository.save(delivery);
    }
    if (!delivery.buyer?.phoneNumber) {
      throw new BadRequestException('Numéro de téléphone introuvable.');
    }
    await this.notificationsService.sendSms(
      delivery.buyer.phoneNumber,
      `Votre code de réception: ${delivery.deliveryCode}`
    );
    return { sent: true };
  }

  async confirmDeliveryCode(id: string, user: AuthUser, code: string): Promise<Delivery> {
    const delivery = await this.findOrFail(id);
    if (delivery.courierId !== user.id) {
      throw new ForbiddenException('Accès refusé.');
    }
    if (delivery.status !== DeliveryStatus.PICKED_UP) {
      throw new BadRequestException('Le colis doit être récupéré avant la livraison.');
    }
    if (!delivery.deliveryCode || delivery.deliveryCode !== code) {
      throw new BadRequestException('Code invalide.');
    }
    delivery.status = DeliveryStatus.DELIVERED;
    delivery.deliveredAt = new Date();
    delivery.deliveryCodeVerifiedAt = new Date();
    const saved = await this.deliveriesRepository.save(delivery);
    const order = await this.ordersService.findByDeliveryId(saved.id);
    if (order) {
      await this.ordersService.updateFromDelivery(order.id, saved.status);
    }
    await Promise.all([
      this.notificationsService.createNotification({
        userId: delivery.buyerId,
        category: NotificationCategory.SYSTEM,
        title: 'Colis livré',
        body: 'Votre colis a été livré.',
        metadata: { deliveryId: delivery.id }
      }),
      this.notificationsService.createNotification({
        userId: delivery.sellerId,
        category: NotificationCategory.SYSTEM,
        title: 'Colis livré',
        body: 'Le colis a été livré à l’acheteur.',
        metadata: { deliveryId: delivery.id }
      })
    ]);
    await this.messagesService.sendTimelineEvent({
      listingId: saved.listingId,
      buyerId: saved.buyerId,
      sellerId: saved.sellerId,
      actorId: user.id,
      content:
        'Le colis est indiqué comme livré. L’acheteur peut confirmer la réception pour libérer le paiement.'
    });
    return saved;
  }

  async getForListing(user: AuthUser, listingId: string): Promise<Delivery | null> {
    const delivery = await this.deliveriesRepository.findOne({
      where: [
        { listingId, buyerId: user.id },
        { listingId, sellerId: user.id },
        { listingId, courierId: user.id }
      ],
      order: { created_at: 'DESC' },
      relations: { listing: true, buyer: true, seller: true, courier: true }
    });
    if (!delivery) {
      return null;
    }
    const isParticipant =
      delivery.buyerId === user.id || delivery.sellerId === user.id || delivery.courierId === user.id;
    if (!isParticipant) {
      throw new ForbiddenException('Accès refusé.');
    }
    const sellerPayoutReady = await this.isSellerPayoutReady(delivery.sellerId);
    return {
      ...delivery,
      sellerPayoutReady
    } as Delivery & { sellerPayoutReady: boolean };
  }

  async requestEscrowPayment(
    user: AuthUser,
    deliveryId: string
  ): Promise<{ paymentId: string; paymentUrl: string }> {
    const delivery = await this.findOrFail(deliveryId);
    if (delivery.buyerId !== user.id) {
      throw new ForbiddenException('Seul l’acheteur peut initier le paiement sécurisé.');
    }
    if (delivery.escrowStatus === 'held' || delivery.escrowStatus === 'pending') {
      const existing = await this.paymentsRepository.findOne({
        where: { id: delivery.escrowPaymentId ?? undefined }
      });
      if (existing?.metadata?.flutterwaveLink) {
        return { paymentId: existing.id, paymentUrl: existing.metadata.flutterwaveLink as string };
      }
    }

    const listingPrice = Number(delivery.listing?.price ?? 0);
    if (!Number.isFinite(listingPrice) || listingPrice <= 0) {
      throw new BadRequestException('Le montant de l’annonce est invalide.');
    }

    const paymentInit = await this.paymentsService.initZikopayEscrowPayment({
      user,
      amount: listingPrice,
      currency: delivery.listing.currency || 'XAF',
      description: `Paiement sécurisé pour ${delivery.listing.title}`,
      deliveryId: delivery.id,
      listingId: delivery.listingId,
      paymentMethod: 'card',
      paymentPhone: delivery.buyer?.phoneNumber ?? '',
      extraMeta: {
        type: 'delivery_escrow',
        listingId: delivery.listingId,
        handoverMode: delivery.handoverMode ?? 'delivery'
      }
    });

    delivery.escrowPaymentId = paymentInit.paymentId;
    delivery.escrowStatus = 'pending';
    delivery.escrowAmount = listingPrice.toFixed(2);
    delivery.escrowCurrency = delivery.listing.currency || 'XAF';
    await this.deliveriesRepository.save(delivery);

    await this.notificationsService.createNotification({
      userId: delivery.sellerId,
      category: NotificationCategory.SYSTEM,
      title: 'Paiement sécurisé initié',
      body: 'Le paiement de l’acheteur est en attente de confirmation.',
      metadata: { deliveryId: delivery.id }
    });
    await this.messagesService.sendTimelineEvent({
      listingId: delivery.listingId,
      buyerId: delivery.buyerId,
      sellerId: delivery.sellerId,
      actorId: user.id,
      content: 'Paiement sécurisé lancé. Confirmation du paiement en cours.'
    });

    return { paymentId: paymentInit.paymentId, paymentUrl: paymentInit.paymentUrl ?? '' };
  }

  async releaseEscrow(user: AuthUser, deliveryId: string): Promise<Delivery> {
    const delivery = await this.findOrFail(deliveryId);
    if (delivery.buyerId !== user.id) {
      throw new ForbiddenException('Seul l’acheteur peut libérer le paiement.');
    }
    if (delivery.handoverMode === 'delivery' && delivery.status !== DeliveryStatus.DELIVERED) {
      throw new BadRequestException('La livraison doit être marquée comme livrée.');
    }
    if (delivery.handoverMode === 'pickup' && delivery.status === DeliveryStatus.CANCELED) {
      throw new BadRequestException('La remise a été annulée.');
    }
    if (!delivery.escrowPaymentId || delivery.escrowStatus !== 'held') {
      throw new BadRequestException('Aucun paiement sécurisé en attente.');
    }
    const payment = await this.paymentsRepository.findOne({
      where: { id: delivery.escrowPaymentId }
    });
    if (!payment) {
      throw new NotFoundException('Paiement introuvable.');
    }

    const currency = delivery.escrowCurrency || payment.currency;
    const listingPriceRaw = Number(delivery.listing?.price ?? 0);
    const listingPrice = Number.isFinite(listingPriceRaw)
      ? listingPriceRaw
      : Number(delivery.escrowAmount ?? payment.amount);
    const deliveryFeeRaw = Number(delivery.price ?? 0);
    const deliveryFee = Number.isFinite(deliveryFeeRaw) ? deliveryFeeRaw : 0;
    const commissionRateRaw = this.configService.get<number>('payments.deliveryCommissionRate');
    const commissionRate = Number.isFinite(commissionRateRaw) ? commissionRateRaw : 0.05;
    const commission = Math.max(listingPrice * commissionRate, 0);
    const sellerPayout = Math.max(listingPrice - commission, 0);
    const courierPayout =
      delivery.courierId && deliveryFee > 0 ? deliveryFee : 0;

    await this.walletsService.credit({
      userId: delivery.sellerId,
      amount: sellerPayout,
      currency,
      type: WalletTransactionType.RELEASE,
      metadata: {
        deliveryId: delivery.id,
        paymentId: payment.id,
        commission
      }
    });

    if (delivery.courierId && courierPayout > 0) {
      await this.walletsService.credit({
        userId: delivery.courierId,
        amount: courierPayout,
        currency,
        type: WalletTransactionType.RELEASE,
        metadata: { deliveryId: delivery.id, paymentId: payment.id }
      });
    }

    const platformWalletUserId = this.configService.get<string>('payments.platformWalletUserId');
    if (platformWalletUserId) {
      await this.walletsService.credit({
        userId: platformWalletUserId,
        amount: commission,
        currency,
        type: WalletTransactionType.ADJUSTMENT,
        metadata: { deliveryId: delivery.id, paymentId: payment.id, type: 'commission' }
      });
    } else if (commission > 0) {
      this.logger.warn('Platform wallet user id missing. Commission not recorded.');
    }

    await this.paymentsRepository.update(payment.id, {
      status: PaymentStatus.COMPLETED
    });

    if (delivery.handoverMode === 'pickup' && delivery.status !== DeliveryStatus.DELIVERED) {
      delivery.status = DeliveryStatus.DELIVERED;
      delivery.deliveredAt = delivery.deliveredAt ?? new Date();
    }

    delivery.escrowStatus = 'released';
    const saved = await this.deliveriesRepository.save(delivery);
    const order = await this.ordersService.findByDeliveryId(saved.id);
    if (order) {
      await this.ordersService.markCompleted(order.id);
    }

    await this.notificationsService.createNotification({
      userId: delivery.sellerId,
      category: NotificationCategory.SYSTEM,
      title: 'Paiement libéré',
      body: 'Le paiement sécurisé a été libéré.',
      metadata: { deliveryId: delivery.id }
    });
    if (delivery.courierId && courierPayout > 0) {
      await this.notificationsService.createNotification({
        userId: delivery.courierId,
        category: NotificationCategory.SYSTEM,
        title: 'Paiement reçu',
        body: 'Le paiement de la livraison a été crédité.',
        metadata: { deliveryId: delivery.id }
      });
    }
    await this.messagesService.sendTimelineEvent({
      listingId: saved.listingId,
      buyerId: saved.buyerId,
      sellerId: saved.sellerId,
      actorId: user.id,
      content:
        'Réception confirmée. Le paiement sécurisé est libéré: vendeur et livreur sont crédités.'
    });

    return saved;
  }

  private async findOrFail(id: string): Promise<Delivery> {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id },
      relations: { listing: true, buyer: true, seller: true, courier: true }
    });
    if (!delivery) {
      throw new NotFoundException('Livraison introuvable.');
    }
    return delivery;
  }

  private async isSellerPayoutReady(sellerId: string): Promise<boolean> {
    const seller = await this.usersService.findOne(sellerId);
    const settings = (seller.settings ?? {}) as Record<string, unknown>;
    const network = (settings.payoutMobileNetwork as string | undefined) ?? '';
    const number = (settings.payoutMobileNumber as string | undefined) ?? '';
    return Boolean(network && number.trim());
  }
}
