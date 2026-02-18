import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Like, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Listing } from '../listings/listing.entity';
import { Report } from '../reports/report.entity';
import { User } from '../users/user.entity';
import { AdminLog } from './admin-log.entity';
import { AdminSetting } from './admin-setting.entity';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { ReportStatus } from '../common/enums/report-status.enum';
import { Category } from '../categories/category.entity';
import { ModerationFiltersDto } from './dto/moderation-filters.dto';
import { BulkUpdateListingStatusDto } from './dto/bulk-update-listing-status.dto';
import { AuditQueryDto, AuditScope } from './dto/audit-query.dto';
import { MessageNotificationLog } from '../messages/message-notification-log.entity';
import { MessageNotificationLogQueryDto } from './dto/message-notification-log-query.dto';
import { CompanyVerificationQueryDto } from './dto/company-verification-query.dto';
import { CourierVerificationQueryDto } from './dto/courier-verification-query.dto';
import { CompanyVerificationStatus } from '../users/enums/company-verification-status.enum';
import { CourierVerificationStatus } from '../users/enums/courier-verification-status.enum';
import { WalletTransaction } from '../payments/wallet-transaction.entity';
import { Payment } from '../payments/payment.entity';
import { PaymentStatus } from '../common/enums/payment-status.enum';

type SettingDefinition = {
  key: string;
  label: string;
  group: string;
  description?: string;
  type: 'boolean' | 'number' | 'text';
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

const ADMIN_SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'security.enforceTwoFactor',
    label: 'Exiger la double authentification',
    group: 'Sécurité',
    description: 'Impose l’activation de la double authentification pour tous les comptes administrateurs.',
    type: 'boolean',
    defaultValue: false
  },
  {
    key: 'security.sessionDurationMinutes',
    label: 'Durée de session (minutes)',
    group: 'Sécurité',
    description: 'Durée pendant laquelle une session administrateur reste active sans activité.',
    type: 'number',
    defaultValue: 60,
    min: 15,
    max: 480,
    step: 15
  },
  {
    key: 'security.maxFailedAttempts',
    label: 'Tentatives de connexion autorisées',
    group: 'Sécurité',
    description: 'Nombre maximal de tentatives avant verrouillage temporaire.',
    type: 'number',
    defaultValue: 5,
    min: 3,
    max: 10,
    step: 1
  },
  {
    key: 'notifications.dailyDigestEnabled',
    label: 'Envoyer le résumé quotidien',
    group: 'Notifications',
    description: 'Transmettre un résumé quotidien des activités clés aux administrateurs.',
    type: 'boolean',
    defaultValue: true
  },
  {
    key: 'legal.termsVersion',
    label: 'Version des CGU',
    group: 'Légal',
    description: 'Identifiant de version affiché aux utilisateurs pour les Conditions Générales.',
    type: 'text',
    defaultValue: 'v1.0.0',
    placeholder: 'v1.2.0'
  },
  {
    key: 'legal.privacyRevision',
    label: 'Révision de la politique de confidentialité',
    group: 'Légal',
    description: 'Date ou référence de la dernière mise à jour de la politique de confidentialité.',
    type: 'text',
    defaultValue: '2024-01-01',
    placeholder: '2024-09-01'
  }
];

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(AdminLog)
    private readonly logsRepository: Repository<AdminLog>,
    @InjectRepository(AdminSetting)
    private readonly settingsRepository: Repository<AdminSetting>,
    @InjectRepository(MessageNotificationLog)
    private readonly notificationLogsRepository: Repository<MessageNotificationLog>,
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionsRepository: Repository<WalletTransaction>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly configService: ConfigService
  ) {}

  private async getPlatformUser() {
    const platformUserId = this.configService.get<string>('payments.platformWalletUserId');
    if (!platformUserId) {
      throw new BadRequestException('PLATFORM_WALLET_USER_ID manquant.');
    }
    const user = await this.usersRepository.findOne({ where: { id: platformUserId } });
    if (!user) {
      throw new NotFoundException('Utilisateur plateforme introuvable.');
    }
    return user;
  }

  async getPlatformWalletSummary() {
    const user = await this.getPlatformUser();
    return {
      userId: user.id,
      email: user.email,
      balance: Number(user.walletBalance ?? 0),
      currency: user.walletCurrency || 'XAF'
    };
  }

  async getPlatformWalletTransactions(filters: {
    limit?: number;
    offset?: number;
    type?: string;
    status?: string;
    from?: Date;
    to?: Date;
  }) {
    const user = await this.getPlatformUser();
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const where: Record<string, any> = { userId: user.id };
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.from || filters.to) {
      const from = filters.from ?? new Date(0);
      const to = filters.to ?? new Date();
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

  async exportPlatformWalletTransactions(filters: {
    type?: string;
    status?: string;
    from?: Date;
    to?: Date;
  }) {
    const { items } = await this.getPlatformWalletTransactions({
      limit: 1000,
      offset: 0,
      type: filters.type,
      status: filters.status,
      from: filters.from,
      to: filters.to
    });

    const typeLabels: Record<string, string> = {
      topup: 'Recharge',
      hold: 'Réservation',
      release: 'Versement',
      refund: 'Remboursement',
      withdrawal: 'Retrait',
      adjustment: 'Commission'
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
      const date =
        tx.created_at instanceof Date ? tx.created_at.toISOString() : String(tx.created_at);
      const type = typeLabels[tx.type] ?? tx.type;
      const amount = String(tx.amount);
      const currency = tx.currency ?? 'XAF';
      const status = statusLabels[tx.status] ?? tx.status;
      return [date, type, amount, currency, status].map(escape).join(',');
    });

    return [header.join(','), ...rows].join('\n');
  }

  async getZikopayTransactions(filters: {
    limit?: number;
    offset?: number;
    status?: PaymentStatus;
    from?: Date;
    to?: Date;
    search?: string;
    method?: string;
  }) {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);

    const query = this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.user', 'user')
      .where('payment.provider = :provider', { provider: 'zikopay' });

    if (filters.status) {
      query.andWhere('payment.status = :status', { status: filters.status });
    }

    if (filters.from || filters.to) {
      const from = filters.from ?? new Date(0);
      const to = filters.to ?? new Date();
      query.andWhere('payment.created_at BETWEEN :from AND :to', { from, to });
    }

    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      query.andWhere(
        `(user.email ILIKE :search OR user."firstName" ILIKE :search OR user."lastName" ILIKE :search OR payment.externalReference ILIKE :search)`,
        { search }
      );
    }

    if (filters.method) {
      const method = filters.method.toLowerCase();
      if (method === 'card') {
        query.andWhere(
          `(
            payment.metadata ->> 'paymentMethod' = :card
            OR payment.metadata ->> 'payment_method' = :card
            OR payment.metadata ->> 'channel' ILIKE :cardLike
          )`,
          { card: 'card', cardLike: '%card%' }
        );
      } else if (method === 'mobile_money') {
        query.andWhere(
          `(
            payment.metadata ->> 'paymentMethod' = :momo
            OR payment.metadata ->> 'payment_method' = :momo
            OR payment.metadata ? 'paymentOperator'
            OR payment.metadata ? 'operator'
            OR payment.metadata ->> 'channel' ILIKE :momoLike
          )`,
          { momo: 'mobile_money', momoLike: '%mobile%' }
        );
      }
    }

    const [items, total] = await query
      .orderBy('payment.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return {
      items: items.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        description: payment.description ?? null,
        reference:
          payment.externalReference ??
          (typeof payment.metadata === 'object' && payment.metadata
            ? (payment.metadata as Record<string, unknown>).zikopayReference
            : null),
        method: (() => {
          const meta =
            typeof payment.metadata === 'object' && payment.metadata
              ? (payment.metadata as Record<string, unknown>)
              : null;
          const rawMethod =
            (meta?.paymentMethod as string | undefined) ??
            (meta?.payment_method as string | undefined) ??
            (meta?.channel as string | undefined) ??
            '';
          const operator =
            (meta?.paymentOperator as string | undefined) ??
            (meta?.operator as string | undefined) ??
            '';
          const normalized = String(rawMethod).toLowerCase();
          if (normalized.includes('mobile')) {
            return operator ? `mobile_money:${operator}` : 'mobile_money';
          }
          if (normalized.includes('mtn') || normalized.includes('orange')) {
            return `mobile_money:${normalized}`;
          }
          if (normalized.includes('card')) {
            return 'card';
          }
          return rawMethod || null;
        })(),
        customerEmail: payment.user?.email ?? null,
        customerName: payment.user
          ? `${payment.user.firstName ?? ''} ${payment.user.lastName ?? ''}`.trim() || null
          : null,
        created_at: payment.created_at
      })),
      total
    };
  }

  async exportZikopayTransactions(filters: {
    status?: PaymentStatus;
    from?: Date;
    to?: Date;
    search?: string;
    method?: string;
  }) {
    const { items } = await this.getZikopayTransactions({
      limit: 1000,
      offset: 0,
      status: filters.status,
      from: filters.from,
      to: filters.to,
      search: filters.search,
      method: filters.method
    });

    const statusLabels: Record<string, string> = {
      completed: 'Confirmé',
      pending: 'En attente',
      failed: 'Échec',
      refunded: 'Remboursé'
    };

    const escape = (value: string) => {
      if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const header = [
      'Date',
      'Référence',
      'Client',
      'Méthode',
      'Montant',
      'Devise',
      'Statut',
      'Description'
    ];
    const rows = items.map(tx => {
      const date =
        tx.created_at instanceof Date ? tx.created_at.toISOString() : String(tx.created_at);
      const reference = tx.reference ? String(tx.reference) : '';
      const client =
        tx.customerEmail || tx.customerName
          ? `${tx.customerName ?? ''}${tx.customerName && tx.customerEmail ? ' · ' : ''}${tx.customerEmail ?? ''}`
          : '';
      const amount = String(tx.amount);
      const currency = tx.currency ?? 'XAF';
      const status = statusLabels[tx.status] ?? tx.status;
      const description = tx.description ?? '';
      const method = tx.method ? String(tx.method) : '';
      return [date, reference, client, method, amount, currency, status, description]
        .map(value => escape(String(value)))
        .join(',');
    });

    return [header.join(','), ...rows].join('\n');
  }

  async getMetrics() {
    const [pendingListings, openReports, activeUsers] = await Promise.all([
      this.listingsRepository.count({ where: { status: ListingStatus.PENDING } }),
      this.reportsRepository.count({
        where: [{ status: ReportStatus.OPEN }, { status: ReportStatus.IN_REVIEW }]
      }),
      this.usersRepository.count({ where: { isActive: true } })
    ]);

    return {
      pendingListings,
      openReports,
      activeUsers,
      supportResponseRate: 0.92
    };
  }

  async getRecentActivities(limit = 10) {
    const logs = await this.logsRepository.find({
      order: { created_at: 'DESC' },
      take: limit
    });

    return logs.map(log => ({
      id: log.id,
      action: log.action,
      details: log.details,
      actorName: log.actorName,
      actorRole: log.actorRole,
      created_at: log.created_at
    }));
  }

  listLogs(limit = 100) {
    return this.logsRepository.find({
      order: { created_at: 'DESC' },
      take: limit
    });
  }

  async getMessageNotificationLogs(filters: MessageNotificationLogQueryDto) {
    const query = this.notificationLogsRepository
      .createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC');

    if (filters.status) {
      query.andWhere('log.status = :status', { status: filters.status });
    }

    if (filters.channel) {
      query.andWhere('log.channel = :channel', { channel: filters.channel });
    }

    if (filters.provider) {
      query.andWhere('log.provider = :provider', { provider: filters.provider });
    }

    if (filters.messageId) {
      query.andWhere('log.message_id = :messageId', {
        messageId: filters.messageId
      });
    }

    if (filters.conversationId) {
      query.andWhere('log.conversation_id = :conversationId', {
        conversationId: filters.conversationId
      });
    }

    if (filters.recipientId) {
      query.andWhere('log.recipient_id = :recipientId', {
        recipientId: filters.recipientId
      });
    }

    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      query.andWhere(
        '(log.destination ILIKE :search OR log.error ILIKE :search)',
        { search }
      );
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    query.take(limit).skip(offset);

    const [items, total] = await query.getManyAndCount();

    return {
      items: items.map(log => ({
        id: log.id,
        messageId: log.messageId,
        conversationId: log.conversationId,
        recipientId: log.recipientId,
        channel: log.channel,
        provider: log.provider,
        destination: log.destination,
        status: log.status,
        error: log.error,
        created_at: log.created_at
      })),
      total
    };
  }

  async getCompanyVerifications(filters: CompanyVerificationQueryDto) {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .where('user.isPro = true');

    if (filters.status) {
      query.andWhere('user.companyVerificationStatus = :status', {
        status: filters.status
      });
    }

    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      query.andWhere(
        `(
          user.email ILIKE :search
          OR user."companyName" ILIKE :search
          OR user."companyId" ILIKE :search
          OR user."companyNiu" ILIKE :search
          OR user."companyRccm" ILIKE :search
          OR user."companyCity" ILIKE :search
        )`,
        { search }
      );
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    query
      .orderBy(
        `CASE "user"."companyVerificationStatus"
          WHEN :pending THEN 1
          WHEN :rejected THEN 2
          WHEN :approved THEN 3
          ELSE 4
        END`,
        'ASC'
      )
      .addOrderBy('"user"."companyVerificationSubmittedAt"', 'DESC')
      .take(limit)
      .skip(offset)
      .setParameters({
        pending: CompanyVerificationStatus.PENDING,
        rejected: CompanyVerificationStatus.REJECTED,
        approved: CompanyVerificationStatus.APPROVED
      });

    const [items, total] = await query.getManyAndCount();

    return {
      items: items.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isPro: user.isPro,
        companyName: user.companyName,
        companyId: user.companyId,
        companyNiu: user.companyNiu,
        companyRccm: user.companyRccm,
        companyCity: user.companyCity,
        companyVerificationStatus: user.companyVerificationStatus,
        companyVerificationDocumentUrl: user.companyVerificationDocumentUrl,
        companyVerificationSubmittedAt: user.companyVerificationSubmittedAt,
        companyVerificationReviewedAt: user.companyVerificationReviewedAt,
        companyVerificationReviewNotes: user.companyVerificationReviewNotes
      })),
      total
    };
  }

  async getCourierVerifications(filters: CourierVerificationQueryDto) {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .where("user.settings ->> 'isCourier' = 'true'");

    if (filters.status) {
      query.andWhere('user.courierVerificationStatus = :status', {
        status: filters.status
      });
    }

    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      query.andWhere(
        `(
          user.email ILIKE :search
          OR user."firstName" ILIKE :search
          OR user."lastName" ILIKE :search
          OR user."location" ILIKE :search
        )`,
        { search }
      );
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    query
      .orderBy(
        `CASE "user"."courierVerificationStatus"
          WHEN :pending THEN 1
          WHEN :rejected THEN 2
          WHEN :approved THEN 3
          ELSE 4
        END`,
        'ASC'
      )
      .addOrderBy('"user"."courierVerificationSubmittedAt"', 'DESC')
      .take(limit)
      .skip(offset)
      .setParameters({
        pending: CourierVerificationStatus.PENDING,
        rejected: CourierVerificationStatus.REJECTED,
        approved: CourierVerificationStatus.APPROVED
      });

    const [items, total] = await query.getManyAndCount();

    return {
      items: items.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isPro: user.isPro,
        location: user.location,
        courierVerificationStatus: user.courierVerificationStatus,
        courierVerificationDocumentUrl: user.courierVerificationDocumentUrl,
        courierVerificationSubmittedAt: user.courierVerificationSubmittedAt,
        courierVerificationReviewedAt: user.courierVerificationReviewedAt,
        courierVerificationReviewNotes: user.courierVerificationReviewNotes
      })),
      total
    };
  }

  async recordLog(entry: Partial<AdminLog>): Promise<AdminLog> {
    const log = this.logsRepository.create(entry);
    return this.logsRepository.save(log);
  }

  async getSettings() {
    const storedSettings = await this.settingsRepository.find();
    const storedMap = new Map(storedSettings.map(item => [item.key, item]));

    const resolved = ADMIN_SETTING_DEFINITIONS.map(definition => {
      const entity = storedMap.get(definition.key);
      const value = this.resolveSettingValue(entity, definition);
      return {
        key: definition.key,
        label: definition.label,
        description: definition.description,
        group: definition.group,
        type: definition.type,
        value,
        min: definition.min,
        max: definition.max,
        step: definition.step,
        placeholder: definition.placeholder
      };
    });

    storedMap.forEach((setting, key) => {
      const alreadyDefined = ADMIN_SETTING_DEFINITIONS.some(def => def.key === key);
      if (!alreadyDefined) {
        const raw = (setting.value as Record<string, unknown>) ?? {};
        resolved.push({
          key,
          label: key,
          description: (raw.description as string) ?? undefined,
          group: 'Autres',
          type: 'text',
          value: 'value' in raw ? raw.value : raw,
          min: undefined,
          max: undefined,
          step: undefined,
          placeholder: undefined
        });
      }
    });

    return resolved;
  }

  async updateSetting(key: string, value: unknown) {
    let setting = await this.settingsRepository.findOne({ where: { key } });
    const payload = this.serializeSettingValue(value);

    if (!setting) {
      setting = this.settingsRepository.create({ key, value: payload });
    } else {
      setting.value = payload;
    }
    await this.settingsRepository.save(setting);
    return this.resolveSettingValue(setting, this.findDefinition(key));
  }

  async updateSettingsBatch(updates: Array<{ key: string; value: unknown }>) {
    const results: Array<{ key: string; value: unknown }> = [];
    for (const update of updates) {
      const value = await this.updateSetting(update.key, update.value);
      results.push({ key: update.key, value });
    }
    return results;
  }

  async getModerationQueue(filters: ModerationFiltersDto) {
    const moderationStatuses: ListingStatus[] = [
      ListingStatus.PENDING,
      ListingStatus.REJECTED,
      ListingStatus.ARCHIVED
    ];

    const query = this.listingsRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.owner', 'owner')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.images', 'image')
      .leftJoinAndSelect('listing.reports', 'report')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .loadRelationCountAndMap('listing.reportsCount', 'listing.reports')
      .orderBy('owner.isPro', 'DESC')
      .addOrderBy('listing.created_at', 'DESC');

    const limit = filters.limit ?? 50;
    query.take(limit);

    if (filters.status) {
      query.andWhere('listing.status = :status', { status: filters.status });
    } else {
      query.andWhere('listing.status IN (:...statuses)', {
        statuses: moderationStatuses
      });
    }

    if (filters.categoryId) {
      query.andWhere('listing.category_id = :categoryId', {
        categoryId: filters.categoryId
      });
    }

    if (filters.search) {
      const search = `%${filters.search.toLowerCase()}%`;
      query.andWhere(
        '(LOWER(listing.title) LIKE :search OR LOWER(owner.email) LIKE :search)',
        { search }
      );
    }

    if (filters.flagType) {
      if (filters.flagType === 'none') {
        query.andWhere('report.id IS NULL');
      } else if (filters.flagType === 'any') {
        query.andWhere('report.id IS NOT NULL');
      } else {
        query.andWhere('LOWER(report.reason) = LOWER(:flagType)', {
          flagType: filters.flagType
        });
      }
    }

    const listings = await query.getMany();

    return listings.map(listing => {
      const reports = (listing.reports ?? []).map(report => ({
        id: report.id,
        reason: report.reason,
        details: report.details,
        status: report.status,
        created_at: report.created_at,
        reporter: report.reporter
          ? {
              id: report.reporter.id,
              firstName: report.reporter.firstName,
              lastName: report.reporter.lastName,
              email: report.reporter.email
            }
          : null
      }));

      const latestReportAt = reports.reduce<Date | null>((latest, report) => {
        const created = new Date(report.created_at);
        if (!latest || created > latest) {
          return created;
        }
        return latest;
      }, null);

      return {
        id: listing.id,
        title: listing.title,
        status: listing.status,
        price: listing.price,
        currency: listing.currency,
        created_at: listing.created_at,
        updatedAt: listing.updatedAt,
        category: listing.category,
        owner: listing.owner,
        reports,
        reportsCount: (listing as Listing & { reportsCount?: number }).reportsCount ?? reports.length,
        latestReportAt,
        images: listing.images
      };
    });
  }

  async getFlagReasons(): Promise<string[]> {
    const rows = await this.reportsRepository
      .createQueryBuilder('report')
      .select('DISTINCT LOWER(report.reason)', 'reason')
      .orderBy('reason', 'ASC')
      .getRawMany<{ reason: string | null }>();

    return rows
      .map(row => row.reason)
      .filter((reason): reason is string => Boolean(reason))
      .filter(Boolean);
  }

  async bulkUpdateListingStatus(
    dto: BulkUpdateListingStatusDto,
    actor: { email: string; role: string }
  ) {
    const listings = await this.listingsRepository.find({
      where: { id: In(dto.listingIds) }
    });

    if (!listings.length) {
      return { updated: 0 };
    }

    const now = new Date();
    listings.forEach(listing => {
      listing.status = dto.status;
      if (dto.status === ListingStatus.PUBLISHED) {
        listing.publishedAt = now;
      } else if (dto.status === ListingStatus.REJECTED) {
        listing.publishedAt = null;
      }
    });

    await this.listingsRepository.save(listings);

    await Promise.all(
      listings.map(listing =>
        this.recordLog({
          action: 'listings.status',
          actorName: actor.email,
          actorRole: actor.role,
          details: `Statut ${dto.status} appliqué à l'annonce ${listing.id} (${listing.title})`
        })
      )
    );

    return { updated: listings.length };
  }

  async getAuditTrail(query: AuditQueryDto) {
    const criteria = query.targetId
      ? { action: Like(`${query.scope}.%`), details: Like(`%${query.targetId}%`) }
      : { action: Like(`${query.scope}.%`) };

    const logs = await this.logsRepository.find({
      where: criteria,
      order: { created_at: 'DESC' },
      take: query.limit ?? 50
    });

    return logs.map(log => ({
      id: log.id,
      action: log.action,
      details: log.details,
      actorName: log.actorName,
      actorRole: log.actorRole,
      ipAddress: log.ipAddress,
      created_at: log.created_at
    }));
  }

  async getModerationFilters() {
    const [categories, flagReasons] = await Promise.all([
      this.categoriesRepository.find({
        select: ['id', 'name'],
        order: { name: 'ASC' }
      }),
      this.getFlagReasons()
    ]);

    return {
      categories: categories.map(category => ({
        id: category.id,
        name: category.name
      })),
      statuses: [
        ListingStatus.PENDING,
        ListingStatus.REJECTED,
        ListingStatus.ARCHIVED,
        ListingStatus.PUBLISHED
      ],
      flagReasons
    };
  }

  private findDefinition(key: string): SettingDefinition | undefined {
    return ADMIN_SETTING_DEFINITIONS.find(def => def.key === key);
  }

  private resolveSettingValue(
    setting: AdminSetting | undefined,
    definition?: SettingDefinition
  ): unknown {
    if (!definition) {
      return setting?.value && 'value' in setting.value
        ? (setting.value as Record<string, unknown>).value
        : setting?.value ?? null;
    }

    if (!setting) {
      return definition.defaultValue ?? null;
    }

    const raw = setting.value as unknown;

    if (raw === null || raw === undefined) {
      return definition.defaultValue ?? null;
    }

    if (typeof raw === 'object') {
      const container = raw as Record<string, unknown>;
      if ('value' in container) {
        return container.value;
      }
      if (definition.type === 'boolean' && 'enabled' in container) {
        return Boolean(container.enabled);
      }
      if (definition.type === 'number' && 'amount' in container) {
        const parsed = Number(container.amount);
        return Number.isFinite(parsed)
          ? parsed
          : Number(definition.defaultValue ?? 0);
      }
    }

    if (definition.type === 'boolean') {
      return Boolean(raw);
    }

    if (definition.type === 'number') {
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        return Number(definition.defaultValue ?? 0);
      }
      return numeric;
    }

    return typeof raw === 'string' ? raw : String(raw ?? definition.defaultValue ?? '');
  }

  private serializeSettingValue(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return { value };
  }
}
