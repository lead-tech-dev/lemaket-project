import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Listing } from '../listings/listing.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { DeliveryStatus } from '../common/enums/delivery-status.enum';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>
  ) {}

  async createPendingOrder(params: {
    listing: Listing;
    buyerId: string;
    paymentId: string;
    handoverMode: 'delivery' | 'pickup';
    deliveryPrice?: number | null;
  }): Promise<Order> {
    const listingPrice = Number(params.listing.price ?? 0);
    if (!Number.isFinite(listingPrice) || listingPrice <= 0) {
      throw new BadRequestException('Montant invalide.');
    }

    const existing = await this.ordersRepository.findOne({
      where: {
        listingId: params.listing.id,
        buyerId: params.buyerId,
        status: OrderStatus.PENDING
      }
    });
    if (existing) {
      return existing;
    }

    const deliveryAmount = Number(params.deliveryPrice ?? 0);
    const total = listingPrice + (Number.isFinite(deliveryAmount) ? deliveryAmount : 0);

    const order = this.ordersRepository.create({
      listingId: params.listing.id,
      buyerId: params.buyerId,
      sellerId: params.listing.owner.id,
      paymentId: params.paymentId,
      handoverMode: params.handoverMode,
      listingAmount: listingPrice.toFixed(2),
      deliveryAmount: (Number.isFinite(deliveryAmount) ? deliveryAmount : 0).toFixed(2),
      platformFee: '0.00',
      totalAmount: total.toFixed(2),
      currency: params.listing.currency || 'XAF',
      status: OrderStatus.PENDING
    });

    const saved = await this.ordersRepository.save(order);
    await this.orderItemsRepository.save(
      this.orderItemsRepository.create({
        orderId: saved.id,
        listingId: params.listing.id,
        title: params.listing.title,
        unitPrice: listingPrice.toFixed(2),
        quantity: 1,
        currency: params.listing.currency || 'XAF'
      })
    );
    return saved;
  }

  async attachDelivery(orderId: string, deliveryId: string): Promise<void> {
    await this.ordersRepository.update(orderId, { deliveryId });
  }

  async findByDeliveryId(deliveryId: string): Promise<Order | null> {
    return this.ordersRepository.findOne({
      where: { deliveryId },
      relations: { listing: true, buyer: true, seller: true, delivery: true, items: true }
    });
  }

  async markPaid(orderId: string): Promise<void> {
    await this.ordersRepository.update(orderId, {
      status: OrderStatus.PAID_AWAITING_DELIVERY,
      paidAt: new Date()
    });
  }

  async updateFromDelivery(orderId: string, deliveryStatus: DeliveryStatus): Promise<void> {
    const statusMap: Record<DeliveryStatus, OrderStatus> = {
      requested: OrderStatus.PAID_AWAITING_DELIVERY,
      accepted: OrderStatus.COURIER_ASSIGNED,
      picked_up: OrderStatus.PICKED_UP,
      delivered: OrderStatus.DELIVERED,
      canceled: OrderStatus.CANCELLED
    };
    const nextStatus = statusMap[deliveryStatus];
    if (!nextStatus) return;
    await this.ordersRepository.update(orderId, {
      status: nextStatus,
      ...(nextStatus === OrderStatus.CANCELLED ? { cancelledAt: new Date() } : {})
    });
  }

  async markCompleted(orderId: string): Promise<void> {
    await this.ordersRepository.update(orderId, {
      status: OrderStatus.COMPLETED,
      completedAt: new Date()
    });
  }

  async listMine(userId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: [{ buyerId: userId }, { sellerId: userId }],
      relations: { listing: true, buyer: true, seller: true, delivery: true, items: true },
      order: { created_at: 'DESC' }
    });
  }

  async getById(id: string, userId: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: { listing: true, buyer: true, seller: true, delivery: true, items: true }
    });
    if (!order) {
      throw new NotFoundException('Commande introuvable.');
    }
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('Accès refusé.');
    }
    return order;
  }
}
