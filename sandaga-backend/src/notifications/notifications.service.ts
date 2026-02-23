import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { request } from 'https';
import { URL } from 'url';
import { URLSearchParams } from 'url';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationCategory } from './notification-category.enum';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private readonly configService: ConfigService
  ) {}

  listForUser(userId: string, limit = 50) {
    return this.notificationsRepository.find({
      where: { userId },
      order: { created_at: 'DESC' },
      take: limit
    });
  }

  async getUnreadCounts(userId: string) {
    const categories = Object.values(NotificationCategory);
    const result: Record<NotificationCategory, { unread: number; total: number }> = {} as Record<
      NotificationCategory,
      { unread: number; total: number }
    >;

    await Promise.all(
      categories.map(async category => {
        const [total, unread] = await Promise.all([
          this.notificationsRepository.count({ where: { userId, category } }),
          this.notificationsRepository.count({
            where: { userId, category, isRead: false }
          })
        ]);
        result[category] = { total, unread };
      })
    );

    const overallUnread = await this.notificationsRepository.count({
      where: { userId, isRead: false }
    });

    return {
      categories: result,
      totalUnread: overallUnread
    };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.notificationsRepository.findOne({
      where: { id, userId }
    });

    if (!notification) {
      throw new NotFoundException('Notification introuvable.');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await this.notificationsRepository.save(notification);
    }

    return notification;
  }

  async markAllAsRead(userId: string) {
    await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('userId = :userId AND isRead = false', { userId })
      .execute();

    return { success: true };
  }

  async createNotification(payload: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }) {
    const notification = this.notificationsRepository.create({
      ...payload,
      isRead: false
    });
    return this.notificationsRepository.save(notification);
  }

  async notifyFollowedSellerListing(
    recipient: User,
    seller: User,
    listing: Listing
  ): Promise<void> {
    const settings = (recipient.settings ?? {}) as Record<string, unknown>;
    const preferred = Array.isArray(settings.preferredContactChannels)
      ? (settings.preferredContactChannels as string[]).map(channel =>
          channel.toString().toLowerCase()
        )
      : ['in_app'];

    const systemAlerts =
      typeof settings.systemAlerts === 'boolean' ? settings.systemAlerts : true;
    const emailAlerts =
      typeof settings.emailAlerts === 'boolean' ? settings.emailAlerts : true;

    const sellerName =
      seller.companyName?.trim() ||
      `${seller.firstName ?? ''} ${seller.lastName ?? ''}`.trim() ||
      'LEMAKET';
    const listingTitle = listing.title ?? 'nouvelle annonce';

    const baseUrl =
      this.configService.get<string>('APP_PUBLIC_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:5173';
    const listingUrl = `${baseUrl.replace(/\/$/, '')}/listing/${listing.id}`;

    const title = `Nouveau chez ${sellerName}`;
    const body = `Nouvelle annonce publiée : "${listingTitle}". Voir l'annonce : ${listingUrl}`;

    if (systemAlerts && preferred.includes('in_app')) {
      await this.createNotification({
        userId: recipient.id,
        category: NotificationCategory.SYSTEM,
        title,
        body,
        metadata: {
          listingId: listing.id,
          sellerId: seller.id
        }
      });
    }

    if (emailAlerts && preferred.includes('email') && recipient.email) {
      await this.sendEmail(recipient.email, title, body);
    }
  }

  async sendSms(to: string, body: string): Promise<void> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.configService.get<string>('TWILIO_FROM_SMS');
    if (!accountSid || !authToken || !from) {
      this.logger.warn('Twilio SMS config missing, skipping SMS.');
      return;
    }

    const url = new URL(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    );
    const payload = new URLSearchParams({
      From: from,
      To: to,
      Body: body
    }).toString();

    await this.postForm(url, payload, accountSid, authToken, 'twilio sms');
  }

  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL');
    if (!apiKey || !fromEmail) {
      this.logger.warn('SendGrid config missing, skipping email.');
      return;
    }

    const payload = JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: fromEmail },
      content: [{ type: 'text/plain', value: body }]
    });

    await this.postJson(
      new URL('https://api.sendgrid.com/v3/mail/send'),
      payload,
      { Authorization: `Bearer ${apiKey}` },
      'sendgrid'
    );
  }

  private postJson(
    url: URL,
    payload: string,
    extraHeaders: Record<string, string>,
    label: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...extraHeaders
        }
      };

      const req = request(url, requestOptions, response => {
        response.on('data', () => undefined);
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
          } else {
            this.logger.warn(
              `${label} request failed: ${response.statusCode ?? 'unknown'}`
            );
            resolve();
          }
        });
      });

      req.on('error', err => {
        this.logger.warn(`${label} request failed: ${err.message}`);
        resolve();
      });

      req.write(payload);
      req.end();
    });
  }

  private postForm(
    url: URL,
    payload: string,
    accountSid: string,
    authToken: string,
    label: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`
        }
      };

      const req = request(url, requestOptions, response => {
        response.on('data', () => undefined);
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
          } else {
            this.logger.warn(`${label} request failed: ${response.statusCode ?? 'unknown'}`);
            resolve();
          }
        });
      });

      req.on('error', error => {
        this.logger.warn(`${label} request error: ${error.message}`);
        resolve();
      });

      req.write(payload);
      req.end();
    });
  }
}
