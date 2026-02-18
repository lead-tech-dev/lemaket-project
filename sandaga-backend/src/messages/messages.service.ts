
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { fromEventPattern, Observable } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { MessageAttachment } from './message-attachment.entity';
import { QuickReply } from './quick-reply.entity';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ListingsService } from '../listings/listings.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { MediaService } from '../media/media.service';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';
import { MessageNotificationService } from './message-notification.service';

export type ConversationListResponse = {
  data: Conversation[]
  nextCursor: string | null
  unreadTotal: number
};

export type MessageListResponse = {
  data: Message[]
  nextCursor: string | null
};

export type MessageEventPayload = {
  type: 'message.created' | 'message.read' | 'conversation.updated'
  conversationId: string
  messageId?: string
  payload?: unknown
};

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(MessageAttachment)
    private readonly attachmentsRepository: Repository<MessageAttachment>,
    @InjectRepository(QuickReply)
    private readonly quickRepliesRepository: Repository<QuickReply>,
    private readonly listingsService: ListingsService,
    private readonly mediaService: MediaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly messageNotificationService: MessageNotificationService
  ) {}

  private buildEventName(userId: string): string {
    return `messages.${userId}`;
  }

  subscribeToEvents(userId: string): Observable<MessageEventPayload> {
    const eventName = this.buildEventName(userId);
    return fromEventPattern<MessageEventPayload>(
      handler => this.eventEmitter.on(eventName, handler),
      handler => this.eventEmitter.off(eventName, handler)
    );
  }

  private getParticipantIds(conversation: Conversation): string[] {
    const ids = [conversation.buyerId, conversation.sellerId];
    if (conversation.courierId) {
      ids.push(conversation.courierId);
    }
    return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  }

  private isParticipant(conversation: Conversation, userId: string): boolean {
    return this.getParticipantIds(conversation).includes(userId);
  }

  private incrementUnreadCounts(conversation: Conversation, senderId: string) {
    if (conversation.buyerId !== senderId) {
      conversation.unreadCountBuyer += 1;
    }
    if (conversation.sellerId !== senderId) {
      conversation.unreadCountSeller += 1;
    }
    if (conversation.courierId && conversation.courierId !== senderId) {
      conversation.unreadCountCourier += 1;
    }
  }

  private emitToParticipants(conversation: Conversation, payload: MessageEventPayload) {
    this.getParticipantIds(conversation).forEach(userId => {
      this.eventEmitter.emit(this.buildEventName(userId), payload);
    });
  }

  private async ensureConversation(
    listingId: string,
    buyerId: string,
    sellerId: string
  ): Promise<Conversation> {
    let conversation = await this.conversationsRepository.findOne({
      where: { listingId, buyerId },
      relations: { listing: true, buyer: true, seller: true, courier: true }
    });

    if (conversation) {
      return conversation;
    }

    conversation = this.conversationsRepository.create({
      listingId,
      buyerId,
      sellerId,
      lastMessageAt: new Date(),
      lastMessagePreview: '',
      unreadCountSeller: 0,
      unreadCountBuyer: 0,
      unreadCountCourier: 0
    });
    conversation = await this.conversationsRepository.save(conversation);

    return (
      (await this.conversationsRepository.findOne({
        where: { id: conversation.id },
        relations: { listing: true, buyer: true, seller: true, courier: true }
      })) ?? conversation
    );
  }

  async attachCourierToConversation(params: {
    listingId: string;
    buyerId: string;
    sellerId: string;
    courierId: string;
  }): Promise<void> {
    const conversation = await this.ensureConversation(
      params.listingId,
      params.buyerId,
      params.sellerId
    );

    if (conversation.courierId === params.courierId) {
      return;
    }

    conversation.courierId = params.courierId;
    await this.conversationsRepository.save(conversation);
  }

  async sendTimelineEvent(params: {
    listingId: string;
    buyerId: string;
    sellerId: string;
    content: string;
    actorId?: string;
  }): Promise<void> {
    const content = params.content?.trim();
    if (!content) {
      return;
    }

    try {
      const conversation = await this.ensureConversation(
        params.listingId,
        params.buyerId,
        params.sellerId
      );
      const senderId =
        params.actorId && this.isParticipant(conversation, params.actorId)
          ? params.actorId
          : conversation.sellerId;
      const messageContent = content.startsWith('[Système]')
        ? content
        : `[Système] ${content}`;

      const message = this.messagesRepository.create({
        conversationId: conversation.id,
        senderId,
        content: messageContent,
        deliveryStatus: 'sent'
      });
      const savedMessage = await this.messagesRepository.save(message);

      conversation.lastMessageAt = savedMessage.created_at;
      conversation.lastMessagePreview = messageContent.slice(0, 250);
      this.incrementUnreadCounts(conversation, senderId);
      await this.conversationsRepository.save(conversation);

      const messageWithSender = await this.messagesRepository.findOne({
        where: { id: savedMessage.id },
        relations: { sender: true, attachments: true }
      });

      if (messageWithSender) {
        this.emitToParticipants(conversation, {
          type: 'message.created',
          conversationId: conversation.id,
          messageId: messageWithSender.id,
          payload: messageWithSender
        });
      }
    } catch (error) {
      this.logger.warn(
        `Impossible d'envoyer un message timeline pour listing=${params.listingId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async buildAiSuggestion(conversation: Conversation): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException('AI is not configured.');
    }

    const model = this.configService.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';

    const recentMessages = await this.messagesRepository.find({
      where: { conversationId: conversation.id },
      order: { created_at: 'ASC' },
      take: 12
    });

    const sellerName = `${conversation.seller?.firstName ?? ''} ${conversation.seller?.lastName ?? ''}`.trim();
    const buyerName = `${conversation.buyer?.firstName ?? ''} ${conversation.buyer?.lastName ?? ''}`.trim();
    const listingTitle = conversation.listing?.title ?? 'une annonce';

    const systemPrompt = [
      'Tu es l’assistant de messagerie d’un vendeur sur un marketplace.',
      'Rédige une réponse courte, polie et utile en français.',
      'Pose une question si des informations manquent (lieu, prix, disponibilité, état, livraison).',
      'Ne promets pas de paiement ou de livraison, reste factuel.',
      `Contexte: Annonce = "${listingTitle}". Vendeur = "${sellerName || 'Vendeur'}". Acheteur = "${buyerName || 'Acheteur'}".`
    ].join(' ');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages
        .filter(msg => msg.content?.trim())
        .map(msg => ({
          role: msg.senderId === conversation.sellerId ? 'assistant' : 'user',
          content: msg.content!.trim()
        })),
      {
        role: 'user',
        content: 'Rédige la prochaine réponse du vendeur.'
      }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ServiceUnavailableException(`AI request failed: ${errorText}`);
    }

    const payload = await response.json();
    const suggestion = payload?.choices?.[0]?.message?.content?.trim();

    if (!suggestion) {
      throw new ServiceUnavailableException('AI returned an empty response.');
    }

    return suggestion;
  }

  async listConversations(
    user: AuthUser,
    cursor?: string,
    limit = 20
  ): Promise<ConversationListResponse> {
    const pageSize = Math.min(Math.max(limit ?? 20, 1), 100)

    const qb = this.conversationsRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.listing', 'listing')
      .leftJoinAndSelect('conversation.buyer', 'buyer')
      .leftJoinAndSelect('conversation.seller', 'seller')
      .leftJoinAndSelect('conversation.courier', 'courier')
      .where(
        'conversation.buyerId = :userId OR conversation.sellerId = :userId OR conversation.courierId = :userId',
        {
          userId: user.id
        }
      )
      .orderBy('conversation.lastMessageAt', 'DESC')
      .addOrderBy('conversation.updatedAt', 'DESC')
      .take(pageSize + 1);

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        qb.andWhere('conversation.lastMessageAt < :cursor', { cursor: cursorDate });
      }
    }

    const conversations = await qb.getMany();
    let nextCursor: string | null = null;
    if (conversations.length > pageSize) {
      const tail = conversations.pop();
      nextCursor = tail?.lastMessageAt?.toISOString() ?? tail?.updatedAt?.toISOString() ?? null;
    }

    const unreadTotal = conversations.reduce((total, conversation) => {
      if (conversation.buyerId === user.id) {
        return total + (conversation.unreadCountBuyer ?? 0);
      }
      if (conversation.sellerId === user.id) {
        return total + (conversation.unreadCountSeller ?? 0);
      }
      return total + (conversation.unreadCountCourier ?? 0);
    }, 0);

    return {
      data: conversations,
      nextCursor,
      unreadTotal
    };
  }

  async getConversation(
    conversationId: string,
    user: AuthUser
  ): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
      relations: {
        listing: true,
        buyer: true,
        seller: true,
        courier: true
      }
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    if (!this.isParticipant(conversation, user.id)) {
      throw new ForbiddenException('Access denied.');
    }

    return conversation;
  }

  async getMessages(
    conversationId: string,
    user: AuthUser,
    cursor?: string,
    limit = 50
  ): Promise<MessageListResponse> {
    const pageSize = Math.min(Math.max(limit ?? 50, 1), 200)

    const conversation = await this.getConversation(conversationId, user);

    await this.markAsDelivered(conversationId, user.id);

    const qb = this.messagesRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.attachments', 'attachments')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.created_at', 'DESC')
      .take(pageSize + 1);

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        qb.andWhere('message.created_at < :cursor', { cursor: cursorDate });
      }
    }

    const rows = await qb.getMany();
    let nextCursor: string | null = null;
    if (rows.length > pageSize) {
      const tail = rows.pop();
      nextCursor = tail?.created_at?.toISOString() ?? null;
    }

    const data = rows.reverse();

    return {
      data,
      nextCursor
    };
  }

  async startConversation(
    dto: StartConversationDto,
    user: AuthUser
  ): Promise<Conversation> {
    const listing = await this.listingsService.findOne(dto.listingId);

    let conversation = await this.conversationsRepository.findOne({
      where: { listingId: dto.listingId, buyerId: user.id },
      relations: { listing: true, buyer: true, seller: true, courier: true }
    });

    if (!conversation) {
      conversation = this.conversationsRepository.create({
        listingId: dto.listingId,
        buyerId: user.id,
        sellerId: listing.owner.id,
        lastMessageAt: new Date(),
        lastMessagePreview: dto.content,
        unreadCountSeller: 0,
        unreadCountBuyer: 0,
        unreadCountCourier: 0
      });

      conversation = await this.conversationsRepository.save(conversation);
    }

    await this.sendMessage(
      conversation.id,
      { content: dto.content, attachmentIds: dto.attachmentIds },
      user,
      false
    );

    await this.listingsService.recordMessage(dto.listingId);

    return this.getConversation(conversation.id, user);
  }

  async sendMessage(
    conversationId: string,
    dto: SendMessageDto,
    user: AuthUser,
    incrementListing = true
  ): Promise<Message> {
    const conversation = await this.getConversation(conversationId, user);

    const message = this.messagesRepository.create({
      conversationId,
      senderId: user.id,
      content: dto.content,
      deliveryStatus: 'sent'
    });

    const savedMessage = await this.messagesRepository.save(message);

    if (dto.attachmentIds?.length) {
      const attachments = await this.attachmentsRepository.find({
        where: { id: In(dto.attachmentIds) }
      });

      if (attachments.length !== dto.attachmentIds.length) {
        throw new NotFoundException('One or more attachments are missing.');
      }

      for (const attachment of attachments) {
        if (attachment.conversationId !== conversationId) {
          throw new ForbiddenException('Attachment does not belong to this conversation.');
        }
        attachment.messageId = savedMessage.id;
      }

      await this.attachmentsRepository.save(attachments);
      savedMessage.attachments = attachments;
    } else {
      savedMessage.attachments = [];
    }

    conversation.lastMessageAt = savedMessage.created_at;
    conversation.lastMessagePreview = dto.content.slice(0, 250);
    this.incrementUnreadCounts(conversation, user.id);

    await this.conversationsRepository.save(conversation);

    if (incrementListing) {
      await this.listingsService.recordMessage(conversation.listingId);
    }

    const messageWithSender = await this.messagesRepository.findOne({
      where: { id: savedMessage.id },
      relations: { sender: true, attachments: true }
    });

    if (messageWithSender) {
      this.emitToParticipants(conversation, {
        type: 'message.created',
        conversationId,
        messageId: messageWithSender.id,
        payload: messageWithSender
      });
      const participants = [conversation.buyer, conversation.seller, conversation.courier].filter(
        participant => Boolean(participant && participant.id !== user.id)
      );
      for (const recipient of participants) {
        if (!recipient) {
          continue;
        }
        void this.messageNotificationService.notifyNewMessage({
          recipient,
          sender: messageWithSender.sender,
          conversation,
          message: messageWithSender
        });
      }
      if (user.id === conversation.buyerId) {
        void this.maybeAutoReply(conversation, messageWithSender.created_at);
      }
      return messageWithSender;
    }

    return savedMessage;
  }

  private async maybeAutoReply(conversation: Conversation, buyerMessageAt: Date) {
    const autoEnabled = this.configService.get<string>('OPENAI_AUTOREPLY_ENABLED') !== 'false';
    if (!autoEnabled) {
      return;
    }

    const sellerSettings = (conversation.seller?.settings ?? {}) as Record<string, unknown>;
    const sellerAutoEnabled =
      typeof sellerSettings.aiAutoReplyEnabled === 'boolean'
        ? sellerSettings.aiAutoReplyEnabled
        : true;
    if (!sellerAutoEnabled) {
      return;
    }

    const cooldownMinutesRaw = Number(sellerSettings.aiAutoReplyCooldownMinutes ?? 60);
    const cooldownMinutes = Number.isFinite(cooldownMinutesRaw)
      ? Math.min(Math.max(cooldownMinutesRaw, 5), 720)
      : 60;

    const dailyLimitRaw = Number(sellerSettings.aiAutoReplyDailyLimit ?? 1);
    const dailyLimit = Number.isFinite(dailyLimitRaw)
      ? Math.min(Math.max(dailyLimitRaw, 1), 10)
      : 1;

    const cooldownAgo = new Date(buyerMessageAt.getTime() - cooldownMinutes * 60 * 1000);
    const lastSellerMessage = await this.messagesRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId: conversation.id })
      .andWhere('message.senderId = :sellerId', { sellerId: conversation.sellerId })
      .orderBy('message.created_at', 'DESC')
      .getOne();

    if (lastSellerMessage && lastSellerMessage.created_at > cooldownAgo) {
      return;
    }

    const dayAgo = new Date(buyerMessageAt.getTime() - 24 * 60 * 60 * 1000);
    const autoCount = await this.messagesRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId: conversation.id })
      .andWhere('message.senderId = :sellerId', { sellerId: conversation.sellerId })
      .andWhere("message.content ILIKE :prefix", { prefix: '[Réponse automatique]%' })
      .andWhere('message.created_at >= :since', { since: dayAgo })
      .getCount();

    if (autoCount >= dailyLimit) {
      return;
    }

    try {
      const suggestion = await this.buildAiSuggestion(conversation);
      const autoContent = `[Réponse automatique] ${suggestion}`;
      const autoMessage = this.messagesRepository.create({
        conversationId: conversation.id,
        senderId: conversation.sellerId,
        content: autoContent,
        deliveryStatus: 'sent'
      });

      const savedAuto = await this.messagesRepository.save(autoMessage);
      conversation.lastMessageAt = savedAuto.created_at;
      conversation.lastMessagePreview = autoContent.slice(0, 250);
      this.incrementUnreadCounts(conversation, conversation.sellerId);
      await this.conversationsRepository.save(conversation);
      await this.listingsService.recordMessage(conversation.listingId);

      const messageWithSender = await this.messagesRepository.findOne({
        where: { id: savedAuto.id },
        relations: { sender: true, attachments: true }
      });

      if (messageWithSender) {
        this.emitToParticipants(conversation, {
          type: 'message.created',
          conversationId: conversation.id,
          messageId: messageWithSender.id,
          payload: messageWithSender
        });
        const recipients = [conversation.buyer, conversation.courier].filter(Boolean);
        for (const recipient of recipients) {
          if (!recipient) {
            continue;
          }
          void this.messageNotificationService.notifyNewMessage({
            recipient,
            sender: conversation.seller,
            conversation,
            message: messageWithSender
          });
        }
      }
    } catch (error) {
      console.warn('AI auto-reply failed', error);
    }
  }

  async markAsRead(conversationId: string, user: AuthUser): Promise<void> {
    const conversation = await this.getConversation(conversationId, user);

    const now = new Date();
    await this.messagesRepository
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: now, deliveryStatus: 'read' })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_id <> :userId', { userId: user.id })
      .andWhere('"readAt" IS NULL')
      .execute();

    if (conversation.buyerId === user.id) {
      conversation.unreadCountBuyer = 0;
    } else if (conversation.sellerId === user.id) {
      conversation.unreadCountSeller = 0;
    } else if (conversation.courierId === user.id) {
      conversation.unreadCountCourier = 0;
    }

    await this.conversationsRepository.save(conversation);

    this.emitToParticipants(conversation, {
      type: 'message.read',
      conversationId,
      payload: { readerId: user.id, readAt: now.toISOString() }
    });
  }

  private async markAsDelivered(conversationId: string, viewerId: string) {
    const now = new Date();
    await this.messagesRepository
      .createQueryBuilder()
      .update(Message)
      .set({ deliveryStatus: 'delivered', deliveredAt: now })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_id <> :viewerId', { viewerId })
      .andWhere('"deliveryStatus" = :status', { status: 'sent' })
      .execute();
  }

  async uploadAttachment(
    conversationId: string,
    file: Express.Multer.File,
    user: AuthUser
  ): Promise<MessageAttachment> {
    const conversation = await this.getConversation(conversationId, user);

    const upload = await this.mediaService.uploadFile(file, { watermark: false });

    const attachment = this.attachmentsRepository.create({
      conversationId,
      url: upload.url,
      fileName: upload.originalName ?? file.originalname,
      mimeType: file.mimetype,
      size: file.size
    });

    const saved = await this.attachmentsRepository.save(attachment);

    this.emitToParticipants(conversation, {
      type: 'conversation.updated',
      conversationId,
      payload: { attachmentId: saved.id, event: 'attachment.ready' }
    });

    return saved;
  }

  async listQuickReplies(user: AuthUser): Promise<QuickReply[]> {
    const [globals, personals] = await Promise.all([
      this.quickRepliesRepository.find({ where: { isGlobal: true } }),
      this.quickRepliesRepository.find({ where: { ownerId: user.id } })
    ]);
    return [...globals, ...personals];
  }

  async createQuickReply(user: AuthUser, dto: CreateQuickReplyDto): Promise<QuickReply> {
    if (dto.isGlobal && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can create global replies.');
    }
    const quickReply = this.quickRepliesRepository.create({
      label: dto.label,
      content: dto.content,
      isGlobal: dto.isGlobal ?? false,
      ownerId: dto.isGlobal ? null : user.id
    });
    return this.quickRepliesRepository.save(quickReply);
  }

  async updateQuickReply(
    user: AuthUser,
    id: string,
    dto: UpdateQuickReplyDto
  ): Promise<QuickReply> {
    const quickReply = await this.quickRepliesRepository.findOne({ where: { id } });
    if (!quickReply) {
      throw new NotFoundException('Quick reply not found.');
    }
    if (!quickReply.isGlobal && quickReply.ownerId !== user.id && user.role === UserRole.USER) {
      throw new ForbiddenException('You cannot modify this reply.');
    }
    if (quickReply.isGlobal && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can modify global replies.');
    }

    Object.assign(quickReply, dto);
    if (dto.isGlobal !== undefined) {
      quickReply.isGlobal = dto.isGlobal;
      quickReply.ownerId = dto.isGlobal ? null : user.id;
    }
    return this.quickRepliesRepository.save(quickReply);
  }

  async deleteQuickReply(user: AuthUser, id: string): Promise<void> {
    const quickReply = await this.quickRepliesRepository.findOne({ where: { id } });
    if (!quickReply) {
      throw new NotFoundException('Quick reply not found.');
    }
    if (!quickReply.isGlobal && quickReply.ownerId !== user.id && user.role === UserRole.USER) {
      throw new ForbiddenException('You cannot delete this reply.');
    }
    if (quickReply.isGlobal && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can delete global replies.');
    }
    await this.quickRepliesRepository.delete(id);
  }

  async generateAiReply(conversationId: string, user: AuthUser): Promise<{ suggestion: string }> {
    const conversation = await this.getConversation(conversationId, user);

    if (conversation.sellerId !== user.id) {
      throw new ForbiddenException('Only sellers can use AI suggestions.');
    }

    const suggestion = await this.buildAiSuggestion(conversation);
    return { suggestion };
  }
}
