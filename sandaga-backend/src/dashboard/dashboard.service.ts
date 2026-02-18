import { Injectable } from '@nestjs/common';
import { ListingsService } from '../listings/listings.service';
import { MessagesService } from '../messages/messages.service';
import { PaymentsService } from '../payments/payments.service';
import { FavoritesService } from '../favorites/favorites.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/notification-category.enum';
import { IdentityVerificationStatus } from '../users/enums/identity-verification-status.enum';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';

@Injectable()
export class DashboardService {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly messagesService: MessagesService,
    private readonly paymentsService: PaymentsService,
    private readonly favoritesService: FavoritesService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService
  ) {}

  async getOverview(user: AuthUser) {
    const [
      listings,
      conversationsResponse,
      payments,
      favorites,
      me,
      sellerSplit,
      notifications,
      notificationCounts
    ] = await Promise.all([
      this.listingsService.findMine(user.id),
      this.messagesService.listConversations(user),
      this.paymentsService.getPayments(user),
      this.favoritesService.getForUser(user),
      this.usersService.findOne(user.id),
      this.listingsService.countBySellerType(),
      this.notificationsService.listForUser(user.id, 30),
      this.notificationsService.getUnreadCounts(user.id)
    ]);

    const conversations = conversationsResponse.data;

    const activeListings = listings.filter(
      listing => listing.status === ListingStatus.PUBLISHED
    ).length;
    const pendingListings = listings.filter(
      listing => listing.status === ListingStatus.PENDING
    ).map(listing => listing.title);
    const expiredListings = listings.filter(
      listing => listing.status === ListingStatus.EXPIRED
    ).map(listing => listing.title);

    const pendingMessages = conversationsResponse.unreadTotal;

    const completedSales = payments.filter(
      payment => payment.status === PaymentStatus.COMPLETED
    ).length;

    const stats = [
      {
        label: 'Annonces actives',
        value: activeListings.toString(),
        trend: pendingListings.length
          ? `${pendingListings.length} en attente`
          : 'Parfaitement à jour'
      },
      {
        label: 'Messages en attente',
        value: pendingMessages.toString(),
        trend: pendingMessages ? 'Répondez rapidement' : 'Tous traités'
      },
      {
        label: 'Ventes conclues',
        value: completedSales.toString(),
        trend: `${payments.length} transactions au total`
      },
      {
        label: 'Visibilité',
        value: me.isPro ? 'Premium' : 'Standard',
        trend: favorites.length ? `${favorites.length} favoris enregistrés` : 'Boostez vos annonces'
      }
    ];

    const reminders = [
      ...pendingListings.slice(0, 2).map(title => ({
        title: `Publier « ${title} »`,
        due: 'En attente de validation',
        action: 'Mettre à jour'
      })),
      ...expiredListings.slice(0, 1).map(title => ({
        title: `Renouveler « ${title} »`,
        due: 'Annonce expirée',
        action: 'Renouveler'
      }))
    ];

    if (!reminders.length && !me.isPro) {
      reminders.push({
        title: 'Activez le compte PRO',
        due: 'Profitez des promos en cours',
        action: 'Découvrir'
      });
    }

    const messages = conversations.slice(0, 3).map(conversation => ({
      from: conversation.buyerId === user.id
        ? conversation.seller?.firstName ?? 'Vendeur'
        : conversation.buyer?.firstName ?? 'Acheteur',
      excerpt: conversation.lastMessagePreview ?? '',
      time: conversation.lastMessageAt?.toISOString() ?? ''
    }));

    const notificationSummary = this.buildNotificationSummary(notifications, notificationCounts);
    const onboardingChecklist = this.buildOnboardingChecklist(me, listings);

    const sellerInsights = {
      proListings: sellerSplit.proListings,
      individualListings: sellerSplit.individualListings,
      proShare: sellerSplit.proListings + sellerSplit.individualListings
        ? Math.round((sellerSplit.proListings / (sellerSplit.proListings + sellerSplit.individualListings)) * 1000) / 10
        : 0,
      individualShare: sellerSplit.proListings + sellerSplit.individualListings
        ? Math.round((sellerSplit.individualListings / (sellerSplit.proListings + sellerSplit.individualListings)) * 1000) / 10
        : 0
    };

    return {
      stats,
      reminders,
      messages,
      sellerInsights,
      notificationSummary,
      onboardingChecklist
    };
  }

  private buildNotificationSummary(
    notifications: Array<{
      id: string;
      title: string;
      body?: string | null;
      category: NotificationCategory;
      isRead: boolean;
      created_at: Date;
      metadata?: Record<string, unknown>;
    }>,
    counts: {
      categories: Record<NotificationCategory, { unread: number; total: number }>;
      totalUnread: number;
    }
  ) {
    const categories = Object.values(NotificationCategory).map(category => {
      const stats = counts.categories?.[category] ?? { unread: 0, total: 0 };
      const latest = notifications.find(notification => notification.category === category);
      return {
        category,
        unread: stats.unread,
        total: stats.total,
        latest: latest
          ? {
              id: latest.id,
              title: latest.title,
              created_at: latest.created_at.toISOString(),
              isRead: latest.isRead
            }
          : null
      };
    });

    const recent = notifications.slice(0, 5).map(notification => ({
      id: notification.id,
      category: notification.category,
      title: notification.title,
      body: notification.body ?? '',
      created_at: notification.created_at.toISOString(),
      isRead: notification.isRead,
      metadata: notification.metadata ?? {}
    }));

    return {
      totalUnread: counts.totalUnread,
      categories,
      recent
    };
  }

  private buildOnboardingChecklist(user: User, listings: Listing[]) {
    const settings = (user.settings ?? {}) as Record<string, unknown>;
    const hasPublishedListing = listings.some(listing => listing.status === ListingStatus.PUBLISHED);
    const profileComplete = this.isProfileComplete(user);
    const twoFactorEnabled = Boolean(settings.enableTwoFactorAuth);

    return {
      dismissed: Boolean(settings.onboardingChecklistDismissed),
      tasks: [
        {
          key: 'complete_profile',
          title: 'Compléter mon profil',
          description: 'Ajoutez vos informations professionnelles et vérifiez votre identité.',
          actionUrl: '/dashboard/profile',
          completed: profileComplete
        },
        {
          key: 'publish_listing',
          title: 'Publier une première annonce',
          description: 'Mettez votre première annonce en ligne pour attirer vos premiers clients.',
          actionUrl: '/listings/new',
          completed: hasPublishedListing
        },
        {
          key: 'enable_two_factor',
          title: 'Activer la double authentification',
          description: 'Sécurisez votre compte avec une vérification supplémentaire.',
          actionUrl: '/dashboard/settings',
          completed: twoFactorEnabled
        }
      ]
    };
  }

  private isProfileComplete(user: User): boolean {
    const identityApproved = user.identityVerificationStatus === IdentityVerificationStatus.APPROVED;
    const hasIdentityDocs = Array.isArray(user.identityDocuments) && user.identityDocuments.length > 0;
    const hasBusinessDetails = Boolean(
      (user.companyName && user.companyName.trim()) ||
        (user.businessDescription && user.businessDescription.trim())
    );
    const hasContactDetails = Boolean(user.phoneNumber && user.location);

    return identityApproved || (hasIdentityDocs && hasBusinessDetails && hasContactDetails);
  }
}
