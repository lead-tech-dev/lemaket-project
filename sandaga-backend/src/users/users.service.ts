import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from './user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { PaginationQueryDto } from '../common/dtos/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { UserAddress } from './user-address.entity';
import { UpsertAddressDto } from './dto/upsert-address.dto';
import { IdentityDocumentType } from './enums/identity-document-type.enum';
import { IdentityVerificationStatus } from './enums/identity-verification-status.enum';
import { IdentityDocumentRecord } from './interfaces/identity-document.interface';
import { CompanyVerificationStatus } from './enums/company-verification-status.enum';
import { CourierVerificationStatus } from './enums/courier-verification-status.enum';
import { Listing } from '../listings/listing.entity';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { Favorite } from '../favorites/favorite.entity';
import { UserFollow } from './user-follow.entity';
import { Review } from '../reviews/review.entity';
import { ReviewStatus } from '../common/enums/review-status.enum';
import { Message } from '../messages/message.entity';

const SALT_ROUNDS = 12;
const PREFERRED_CONTACT_CHANNELS = ['email', 'sms', 'phone', 'whatsapp', 'in_app'] as const;
type PreferredContactChannel = (typeof PREFERRED_CONTACT_CHANNELS)[number];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserAddress)
    private readonly addressesRepository: Repository<UserAddress>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    @InjectRepository(Favorite)
    private readonly favoritesRepository: Repository<Favorite>,
    @InjectRepository(UserFollow)
    private readonly userFollowsRepository: Repository<UserFollow>,
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const firstName = createUserDto.firstName?.trim();
    const lastName = createUserDto.lastName?.trim();
    const user = this.usersRepository.create({
      email: createUserDto.email.toLowerCase(),
      firstName,
      lastName,
      phoneNumber: createUserDto.phoneNumber,
      avatarUrl: createUserDto.avatarUrl,
      bio: createUserDto.bio,
      location: createUserDto.location,
      isActive: createUserDto.isActive ?? true,
      isPro: createUserDto.isPro ?? false,
      role: createUserDto.role ?? UserRole.USER,
      settings: this.buildDefaultSettings(),
      companyVerificationStatus: (createUserDto.isPro ?? false)
        ? CompanyVerificationStatus.PENDING
        : CompanyVerificationStatus.UNVERIFIED
    });

    user.proActivatedAt = createUserDto.isPro
      ? createUserDto.proActivatedAt
        ? new Date(createUserDto.proActivatedAt)
        : new Date()
      : createUserDto.proActivatedAt
      ? new Date(createUserDto.proActivatedAt)
      : null;

    user.companyName = createUserDto.companyName;
    user.companyId = createUserDto.companyId;
    user.companyNiu = createUserDto.companyNiu;
    user.companyRccm = createUserDto.companyRccm;
    user.companyCity = createUserDto.companyCity;
    if (user.isPro) {
      user.companyVerificationSubmittedAt = new Date();
    }

    if (!user.storefrontSlug && firstName && lastName) {
      user.storefrontSlug = await this.generateUniqueStorefrontSlug(firstName, lastName);
    }

    user.password = await this.hashPassword(createUserDto.password);

    try {
      const saved = await this.usersRepository.save(user);
      delete (saved as unknown as { password?: string }).password;
      return saved;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        typeof error.driverError?.code === 'string' &&
        error.driverError.code === '23505'
      ) {
        throw new ConflictException('Email is already in use.');
      }

      throw error;
    }
  }

  async findAll(
    paginationQuery: PaginationQueryDto
  ): Promise<PaginatedResult<User>> {
    const page = paginationQuery.page ?? 1;
    const limit = paginationQuery.limit ?? 20;
    const [data, total] = await this.usersRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' }
    });

    return {
      data,
      total,
      page,
      limit
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found.`);
    }

    return user;
  }

  private async buildPublicProfile(user: User) {
    const listingCount = await this.listingsRepository.count({
      where: {
        owner: { id: user.id },
        status: ListingStatus.PUBLISHED
      }
    });

    const proFollowsRaw = await this.userFollowsRepository
      .createQueryBuilder('follow')
      .leftJoin('follow.seller', 'seller')
      .select('COUNT(DISTINCT seller.id)', 'count')
      .where('follow.followerId = :userId', { userId: user.id })
      .andWhere('seller.isPro = true')
      .getRawOne<{ count?: string }>();

    const proFollowsCount = Number(proFollowsRaw?.count ?? 0);

    const reviewSummary = await this.reviewsRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.seller_id = :userId', { userId: user.id })
      .andWhere('review.status = :status', { status: ReviewStatus.APPROVED })
      .getRawOne<{ average: string | null; count: string | null }>();

    const averageRating = reviewSummary?.average ? Number(reviewSummary.average) : 0;
    const reviewsCount = reviewSummary?.count ? Number(reviewSummary.count) : 0;

    const responseStats = await this.computeResponseStats(user.id);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
      location: user.location ?? null,
      createdAt: user.created_at,
      lastLoginAt: user.lastLoginAt ?? null,
      hasPhoneNumber: Boolean(user.phoneNumber),
      averageRating: Number.isFinite(averageRating) ? averageRating : 0,
      reviewsCount: Number.isFinite(reviewsCount) ? reviewsCount : 0,
      responseTimeHours: responseStats.averageResponseHours,
      responseRate: responseStats.responseRate,
      listingCount,
      proFollowsCount
    };
  }

  async getPublicProfile(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, isActive: true },
      select: [
        'id',
        'firstName',
        'lastName',
        'avatarUrl',
        'location',
        'created_at',
        'lastLoginAt',
        'phoneNumber',
        'isPro',
        'isActive'
      ]
    });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found.`);
    }

    if (user.isPro) {
      throw new BadRequestException('Public profile is only available for individual users.');
    }

    return this.buildPublicProfile(user);
  }

  async getPublicProfileBySlug(slug: string) {
    const user = await this.usersRepository.findOne({
      where: { storefrontSlug: slug, isActive: true },
      select: [
        'id',
        'firstName',
        'lastName',
        'avatarUrl',
        'location',
        'created_at',
        'lastLoginAt',
        'phoneNumber',
        'isPro',
        'isActive',
        'storefrontSlug'
      ]
    });

    if (!user) {
      throw new NotFoundException(`User with slug ${slug} not found.`);
    }

    if (user.isPro) {
      throw new BadRequestException('Public profile is only available for individual users.');
    }

    return this.buildPublicProfile(user);
  }

  async listFollowedSellerIds(followerId: string): Promise<string[]> {
    const rows = await this.userFollowsRepository.find({
      where: { followerId },
      select: ['sellerId']
    });
    return rows.map(row => row.sellerId);
  }

  async listFollowedSellers(followerId: string) {
    const sellerIds = await this.listFollowedSellerIds(followerId);
    if (!sellerIds.length) {
      return [];
    }

    const sellers = await this.usersRepository.find({
      where: {
        id: In(sellerIds),
        isActive: true,
        isPro: true
      }
    });

    const listingCounts = await this.listingsRepository
      .createQueryBuilder('listing')
      .select('listing.owner_id', 'ownerId')
      .addSelect('COUNT(listing.id)', 'count')
      .where('listing.owner_id IN (:...sellerIds)', { sellerIds })
      .andWhere('listing.status = :status', { status: ListingStatus.PUBLISHED })
      .groupBy('listing.owner_id')
      .getRawMany<{ ownerId: string; count: string }>();

    const followersCounts = await this.userFollowsRepository
      .createQueryBuilder('follow')
      .select('follow.sellerId', 'sellerId')
      .addSelect('COUNT(follow.id)', 'count')
      .where('follow.sellerId IN (:...sellerIds)', { sellerIds })
      .groupBy('follow.sellerId')
      .getRawMany<{ sellerId: string; count: string }>();

    const listingCountMap = new Map(listingCounts.map(row => [row.ownerId, Number(row.count)]));
    const followersCountMap = new Map(followersCounts.map(row => [row.sellerId, Number(row.count)]));

    return sellers.map(seller => ({
      id: seller.id,
      name: seller.companyName?.trim() || `${seller.firstName ?? ''} ${seller.lastName ?? ''}`.trim(),
      storefrontSlug: seller.storefrontSlug ?? null,
      avatarUrl: seller.avatarUrl ?? null,
      location: seller.location ?? null,
      listingCount: listingCountMap.get(seller.id) ?? 0,
      followersCount: followersCountMap.get(seller.id) ?? 0
    }));
  }

  async listCouriersNearby(query: {
    city?: string;
    zipcode?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(query.limit ?? 8, 1), 50);
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .where("user.settings ->> 'isCourier' = 'true'")
      .andWhere('user.isActive = true')
      .andWhere('user.courierVerificationStatus = :status', {
        status: CourierVerificationStatus.APPROVED
      });

    if (query.city || query.zipcode) {
      qb.andWhere(
        new Brackets(builder => {
          if (query.city) {
            builder.where('user.location ILIKE :city', {
              city: `%${query.city}%`
            });
          }
          if (query.zipcode) {
            const condition = 'user.location ILIKE :zipcode';
            const params = { zipcode: `%${query.zipcode}%` };
            if (query.city) {
              builder.orWhere(condition, params);
            } else {
              builder.where(condition, params);
            }
          }
        })
      );
    }

    const couriers = await qb
      .orderBy('user.lastLoginAt', 'DESC')
      .limit(limit)
      .getMany();

    return couriers.map(courier => {
      const courierLocation = (courier.settings as Record<string, unknown> | undefined)?.courierLocation as
        | { city?: string; zipcode?: string; lat?: number; lng?: number }
        | undefined;
      const courierRadiusKm = (courier.settings as Record<string, unknown> | undefined)?.courierRadiusKm as
        | number
        | undefined;
      return {
        id: courier.id,
        name: `${courier.firstName ?? ''} ${courier.lastName ?? ''}`.trim() || courier.email,
        avatarUrl: courier.avatarUrl ?? null,
        location: courier.location ?? courierLocation?.city ?? null,
        lastLoginAt: courier.lastLoginAt ?? null,
        lat: courierLocation?.lat ?? null,
        lng: courierLocation?.lng ?? null,
        city: courierLocation?.city ?? null,
        zipcode: courierLocation?.zipcode ?? null,
        radiusKm:
          typeof courierRadiusKm === 'number' && Number.isFinite(courierRadiusKm)
            ? courierRadiusKm
            : null
      };
    });
  }

  async updateCourierVerificationDocument(userId: string, url: string): Promise<User> {
    const user = await this.findOne(userId);
    user.courierVerificationDocumentUrl = url;
    user.courierVerificationStatus = CourierVerificationStatus.PENDING;
    user.courierVerificationSubmittedAt = new Date();
    user.courierVerificationReviewNotes = null;
    const saved = await this.usersRepository.save(user);
    delete (saved as unknown as { password?: string }).password;
    return saved;
  }

  private async computeResponseStats(userId: string) {
    const rows = await this.messagesRepository
      .createQueryBuilder('message')
      .innerJoin('message.conversation', 'conversation')
      .select([
        'message.conversationId AS "conversationId"',
        'message.senderId AS "senderId"',
        'message.created_at AS "createdAt"',
        'conversation.buyerId AS "buyerId"',
        'conversation.sellerId AS "sellerId"'
      ])
      .where('conversation.seller_id = :sellerId', { sellerId: userId })
      .orderBy('message.created_at', 'ASC')
      .getRawMany<{
        conversationId: string;
        senderId: string;
        createdAt: Date;
        buyerId: string;
        sellerId: string;
      }>();

    const conversations = new Map<
      string,
      { buyerId: string; sellerId: string; buyerFirst?: Date; sellerFirst?: Date }
    >();

    for (const row of rows) {
      const convo =
        conversations.get(row.conversationId) ??
        { buyerId: row.buyerId, sellerId: row.sellerId };

      if (row.senderId === row.buyerId && !convo.buyerFirst) {
        convo.buyerFirst = new Date(row.createdAt);
      }
      if (
        row.senderId === row.sellerId &&
        convo.buyerFirst &&
        !convo.sellerFirst
      ) {
        convo.sellerFirst = new Date(row.createdAt);
      }
      conversations.set(row.conversationId, convo);
    }

    let totalConversations = 0;
    let responded = 0;
    let totalHours = 0;

    for (const convo of conversations.values()) {
      if (!convo.buyerFirst) continue;
      totalConversations += 1;
      if (convo.sellerFirst) {
        responded += 1;
        const diffMs = convo.sellerFirst.getTime() - convo.buyerFirst.getTime();
        if (diffMs >= 0) {
          totalHours += diffMs / (1000 * 60 * 60);
        }
      }
    }

    const averageResponseHours =
      responded > 0 ? Math.max(1, Math.round(totalHours / responded)) : null;
    const responseRate =
      totalConversations > 0 ? Math.round((responded / totalConversations) * 100) : null;

    return { averageResponseHours, responseRate };
  }

  private normalizeSlugPart(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async generateUniqueStorefrontSlug(firstName: string, lastName: string) {
    const base = [firstName, lastName]
      .filter(Boolean)
      .map(part => this.normalizeSlugPart(part))
      .filter(Boolean)
      .join('-');

    const fallbackBase = base || `user-${randomUUID().slice(0, 8)}`;

    let candidate = fallbackBase;
    let counter = 1;

    while (await this.usersRepository.exist({ where: { storefrontSlug: candidate } })) {
      counter += 1;
      candidate = `${fallbackBase}-${counter}`;
    }

    return candidate;
  }

  async getFollowersForSeller(sellerId: string): Promise<User[]> {
    const follows = await this.userFollowsRepository
      .createQueryBuilder('follow')
      .leftJoinAndSelect('follow.follower', 'follower')
      .where('follow.sellerId = :sellerId', { sellerId })
      .andWhere('follower.isActive = true')
      .getMany();
    return follows.map(row => row.follower);
  }

  async followSeller(followerId: string, sellerId: string) {
    if (followerId === sellerId) {
      throw new BadRequestException('Vous ne pouvez pas vous suivre vous-même.');
    }

    const seller = await this.usersRepository.findOne({
      where: { id: sellerId, isActive: true, isPro: true }
    });
    if (!seller) {
      throw new NotFoundException('Vendeur introuvable.');
    }

    const existing = await this.userFollowsRepository.findOne({
      where: { followerId, sellerId }
    });
    if (existing) {
      return { following: true };
    }

    const follow = this.userFollowsRepository.create({ followerId, sellerId });
    await this.userFollowsRepository.save(follow);
    return { following: true };
  }

  async unfollowSeller(followerId: string, sellerId: string) {
    await this.userFollowsRepository.delete({ followerId, sellerId });
    return { following: false };
  }

  async getFollowersCount(sellerId: string): Promise<number> {
    return this.userFollowsRepository.count({
      where: { sellerId }
    });
  }

  async isFollowingSeller(followerId: string, sellerId: string): Promise<boolean> {
    const existing = await this.userFollowsRepository.findOne({
      where: { followerId, sellerId },
      select: ['id']
    });
    return Boolean(existing);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() }
    });
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();

    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    delete (user as unknown as { password?: string }).password;
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.findByEmail(updateUserDto.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email is already in use.');
      }
    }

    const merged = this.usersRepository.merge(user, {
      ...updateUserDto,
      email: updateUserDto.email?.toLowerCase()
    });

    if (updateUserDto.proExpiresAt) {
      merged.proExpiresAt = new Date(updateUserDto.proExpiresAt);
    }

    if (updateUserDto.password) {
      merged.password = await this.hashPassword(updateUserDto.password);
    }

    if (updateUserDto.companyVerificationStatus) {
      merged.companyVerificationStatus = updateUserDto.companyVerificationStatus;
      merged.companyVerificationReviewedAt = new Date();
      if (updateUserDto.companyVerificationReviewNotes !== undefined) {
        merged.companyVerificationReviewNotes = updateUserDto.companyVerificationReviewNotes;
      }
    }

    if (updateUserDto.courierVerificationStatus) {
      merged.courierVerificationStatus = updateUserDto.courierVerificationStatus;
      merged.courierVerificationReviewedAt = new Date();
      if (updateUserDto.courierVerificationReviewNotes !== undefined) {
        merged.courierVerificationReviewNotes = updateUserDto.courierVerificationReviewNotes;
      }
    }

    const saved = await this.usersRepository.save(merged);
    delete (saved as unknown as { password?: string }).password;
    return saved;
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto
  ): Promise<User> {
    const user = await this.findOne(userId);
    const payload: UpdateProfileDto = { ...updateProfileDto };

    if (payload.firstName) {
      payload.firstName = payload.firstName.trim();
    }
    if (payload.lastName) {
      payload.lastName = payload.lastName.trim();
    }
    if (payload.companyName) {
      payload.companyName = payload.companyName.trim();
    }
    if (payload.companyNiu) {
      payload.companyNiu = payload.companyNiu.trim();
    }
    if (payload.companyRccm) {
      payload.companyRccm = payload.companyRccm.trim();
    }
    if (payload.companyCity) {
      payload.companyCity = payload.companyCity.trim();
    }
    if (payload.businessWebsite) {
      payload.businessWebsite = payload.businessWebsite.trim();
    }
    if (payload.storefrontSlug) {
      payload.storefrontSlug = payload.storefrontSlug.trim().toLowerCase();
    }
    if (payload.storefrontHeroUrl) {
      payload.storefrontHeroUrl = payload.storefrontHeroUrl.trim();
    }

    if (!user.isPro) {
      delete payload.storefrontSlug;
      delete payload.storefrontTagline;
      delete payload.storefrontHeroUrl;
      delete payload.storefrontTheme;
      delete payload.storefrontShowReviews;
    }

    const merged = this.usersRepository.merge(user, payload);
    if (user.isPro) {
      const hasCompanyChanges = Boolean(
        payload.companyName ??
          payload.companyId ??
          payload.companyNiu ??
          payload.companyRccm ??
          payload.companyCity
      );
      if (hasCompanyChanges) {
        merged.companyVerificationStatus = CompanyVerificationStatus.PENDING;
        merged.companyVerificationSubmittedAt = new Date();
        merged.companyVerificationReviewNotes = null;
      }
    } else if (!merged.storefrontSlug && merged.firstName && merged.lastName) {
      merged.storefrontSlug = await this.generateUniqueStorefrontSlug(
        merged.firstName,
        merged.lastName
      );
    }
    const saved = await this.usersRepository.save(merged);
    delete (saved as unknown as { password?: string }).password;
    return saved;
  }

  async updateCompanyVerificationDocument(userId: string, url: string): Promise<User> {
    const user = await this.findOne(userId);
    if (!user.isPro) {
      throw new BadRequestException('Only pro accounts can submit verification documents.');
    }

    user.companyVerificationDocumentUrl = url;
    user.companyVerificationStatus = CompanyVerificationStatus.PENDING;
    user.companyVerificationSubmittedAt = new Date();
    user.companyVerificationReviewNotes = null;

    const saved = await this.usersRepository.save(user);
    delete (saved as unknown as { password?: string }).password;
    return saved;
  }

  async updateSettings(
    userId: string,
    updateSettingsDto: UpdateSettingsDto
  ): Promise<User> {
    const user = await this.findOne(userId);
    const nextSettings = {
      ...this.buildDefaultSettings(),
      ...(user.settings ?? {})
    };

    const entries = Object.entries(updateSettingsDto) as Array<[keyof UpdateSettingsDto, unknown]>;

    entries.forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      if (key === 'preferredContactChannels') {
        const normalized = this.normalizePreferredChannels(value as PreferredContactChannel[] | undefined);
        const filtered = (
          user.isPro ? normalized : normalized.filter(channel => channel !== 'whatsapp')
        ) as PreferredContactChannel[];

        if (!filtered.includes('in_app')) {
          filtered.push('in_app');
        }

        nextSettings.preferredContactChannels = filtered.length ? filtered : ['in_app'];
        return;
      }

      (nextSettings as Record<string, unknown>)[key] = value;
    });

    user.settings = nextSettings;
    const saved = await this.usersRepository.save(user);
    delete (saved as unknown as { password?: string }).password;
    return saved;
  }

  async updateTwoFactor(userId: string, enable: boolean): Promise<User> {
    const user = await this.findOne(userId);
    user.settings = {
      ...this.buildDefaultSettings(),
      ...user.settings,
      enableTwoFactorAuth: enable
    };
    const saved = await this.usersRepository.save(user);
    delete (saved as unknown as { password?: string }).password;
    return saved;
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto
  ): Promise<void> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password
    );

    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    user.password = await this.hashPassword(changePasswordDto.newPassword);
    await this.usersRepository.save(user);
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    await this.usersRepository.update(userId, {
      password: await this.hashPassword(newPassword)
    });
  }

  async markLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { lastLoginAt: new Date() });
  }

  async listAddresses(userId: string): Promise<UserAddress[]> {
    return this.addressesRepository.find({
      where: { userId },
      order: { created_at: 'DESC' }
    });
  }

  async createAddress(userId: string, payload: UpsertAddressDto): Promise<UserAddress> {
    const address = this.addressesRepository.create({
      ...payload,
      userId
    });

    const saved = await this.addressesRepository.save(address);
    await this.syncAddressDefaults(userId, saved);
    return saved;
  }

  async updateAddress(
    userId: string,
    addressId: string,
    payload: UpsertAddressDto
  ): Promise<UserAddress> {
    const address = await this.addressesRepository.findOne({
      where: { id: addressId, userId }
    });

    if (!address) {
      throw new NotFoundException('Adresse introuvable.');
    }

    Object.assign(address, payload);
    const saved = await this.addressesRepository.save(address);
    await this.syncAddressDefaults(userId, saved);
    return saved;
  }

  async deleteAddress(userId: string, addressId: string): Promise<{ success: boolean }> {
    const address = await this.addressesRepository.findOne({
      where: { id: addressId, userId }
    });

    if (!address) {
      throw new NotFoundException('Adresse introuvable.');
    }

    const wasDefaultShipping = address.isDefaultShipping;
    const wasDefaultBilling = address.isDefaultBilling;

    await this.addressesRepository.remove(address);

    if (wasDefaultShipping || wasDefaultBilling) {
      const fallback = await this.addressesRepository.findOne({
        where: { userId },
        order: { created_at: 'ASC' }
      });

      if (fallback) {
        if (wasDefaultShipping) {
          fallback.isDefaultShipping = true;
        }
        if (wasDefaultBilling) {
          fallback.isDefaultBilling = true;
        }
        const saved = await this.addressesRepository.save(fallback);
        await this.syncAddressDefaults(userId, saved);
      }
    }

    return { success: true };
  }

  async addIdentityDocument(
    userId: string,
    type: IdentityDocumentType,
    details: { url: string; description?: string }
  ): Promise<{
    status: IdentityVerificationStatus;
    documents: IdentityDocumentRecord[];
    submittedAt: string | null;
  }> {
    if (!details.url) {
      throw new BadRequestException('URL de document manquante.');
    }

    const user = await this.findOne(userId);
    const documents = this.extractIdentityDocuments(user.identityDocuments);

    const document: IdentityDocumentRecord = {
      id: randomUUID(),
      type,
      url: details.url,
      uploadedAt: new Date().toISOString(),
      description: details.description,
      status: 'pending'
    };

    const existingIndex = documents.findIndex(item => item.type === type);
    if (existingIndex >= 0) {
      documents[existingIndex] = document;
    } else {
      documents.push(document);
    }

    user.identityDocuments = documents;
    user.identityVerificationStatus = IdentityVerificationStatus.PENDING;
    user.identitySubmittedAt = new Date();
    user.identityReviewNotes = null;

    await this.usersRepository.save(user);

    return {
      status: user.identityVerificationStatus,
      documents,
      submittedAt: user.identitySubmittedAt ? user.identitySubmittedAt.toISOString() : null
    };
  }

  async removeIdentityDocument(
    userId: string,
    documentId: string
  ): Promise<{
    status: IdentityVerificationStatus;
    documents: IdentityDocumentRecord[];
    submittedAt: string | null;
  }> {
    const user = await this.findOne(userId);
    const documents = this.extractIdentityDocuments(user.identityDocuments);
    const index = documents.findIndex(doc => doc.id === documentId);

    if (index === -1) {
      throw new NotFoundException('Document introuvable.');
    }

    documents.splice(index, 1);
    user.identityDocuments = documents.length ? documents : null;

    if (!documents.length) {
      user.identityVerificationStatus = IdentityVerificationStatus.UNVERIFIED;
      user.identitySubmittedAt = null;
    }

    await this.usersRepository.save(user);

    return {
      status: user.identityVerificationStatus,
      documents,
      submittedAt: user.identitySubmittedAt ? user.identitySubmittedAt.toISOString() : null
    };
  }

  async setProStatus(userId: string, expiresAt?: Date): Promise<User> {
    const user = await this.findOne(userId);
    user.isPro = true;
    user.proActivatedAt = user.proActivatedAt ?? new Date();
    user.proExpiresAt = expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const saved = await this.usersRepository.save(user);
    delete (saved as unknown as { password?: string }).password;
    return saved;
  }

  async deactivate(userId: string, reason?: string): Promise<User> {
    const user = await this.findOne(userId);
    user.isActive = false;
    if (reason) {
      user.settings = {
        ...user.settings,
        lastDeactivationReason: reason
      };
    }
    const saved = await this.usersRepository.save(user);
    delete (saved as unknown as { password?: string }).password;
    return saved;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  async countActivePros(): Promise<number> {
    return this.usersRepository.count({
      where: { isPro: true, isActive: true }
    });
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  private buildDefaultSettings(): Record<string, unknown> {
    return {
      showPhoneToApprovedOnly: true,
      maskPreciseLocation: false,
      enableTwoFactorAuth: false,
      tipsNotifications: true,
      favoritePriceAlerts: true,
      emailAlerts: true,
      importantSmsNotifications: false,
      savedSearchAlerts: true,
      moderationAlerts: true,
      systemAlerts: true,
      marketingOptIn: false,
      preferredContactChannels: ['email', 'in_app'],
      onboardingChecklistDismissed: false,
      isCourier: false,
      courierLocation: null,
      courierRadiusKm: 15,
      aiAutoReplyEnabled: true,
      aiAutoReplyCooldownMinutes: 60,
      aiAutoReplyDailyLimit: 1,
      payoutMobileNetwork: null,
      payoutMobileNumber: null,
      payoutMobileName: null
    };
  }

  private normalizePreferredChannels(
    channels?: PreferredContactChannel[]
  ): PreferredContactChannel[] {
    if (!channels?.length) {
      // keep at least in-app channel for critical communications
      return ['in_app'];
    }

    const unique = Array.from(
      new Set(
        channels
          .map(channel => channel?.toString().toLowerCase() as PreferredContactChannel)
          .filter(channel =>
            (PREFERRED_CONTACT_CHANNELS as readonly string[]).includes(channel)
          )
      )
    ) as PreferredContactChannel[];

    if (!unique.length) {
      throw new BadRequestException('Aucun canal de contact valide fourni.');
    }

    return unique;
  }

  private async syncAddressDefaults(userId: string, reference: UserAddress) {
    if (reference.isDefaultShipping) {
      await this.addressesRepository
        .createQueryBuilder()
        .update(UserAddress)
        .set({ isDefaultShipping: false })
        .where('userId = :userId AND id != :id', { userId, id: reference.id })
        .execute();
    }

    if (reference.isDefaultBilling) {
      await this.addressesRepository
        .createQueryBuilder()
        .update(UserAddress)
        .set({ isDefaultBilling: false })
        .where('userId = :userId AND id != :id', { userId, id: reference.id })
        .execute();
    }
  }

  private extractIdentityDocuments(
    raw: IdentityDocumentRecord[] | null | undefined
  ): IdentityDocumentRecord[] {
    if (!raw?.length) {
      return [];
    }

    return raw.map(doc => ({
      ...doc,
      status: doc.status ?? 'pending'
    }));
  }
}
