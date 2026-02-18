
import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from '../src/messages/messages.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Conversation } from '../src/messages/conversation.entity';
import { Message } from '../src/messages/message.entity';
import { ListingsService } from '../src/listings/listings.service';
import { Repository } from 'typeorm';
import { UserRole } from '../src/common/enums/user-role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StartConversationDto } from '../src/messages/dto/start-conversation.dto';
import { Listing } from '../src/listings/listing.entity';
import { User } from '../src/users/user.entity';

describe('MessagesService', () => {
  let service: MessagesService;
  let conversationRepository: Repository<Conversation>;
  let messageRepository: Repository<Message>;
  let listingsService: ListingsService;

  const mockConversationRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockMessageRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    })),
  };

  const mockListingsService = {
    findOne: jest.fn(),
    recordMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: mockConversationRepository,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
        {
          provide: ListingsService,
          useValue: mockListingsService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    conversationRepository = module.get<Repository<Conversation>>(
      getRepositoryToken(Conversation),
    );
    messageRepository = module.get<Repository<Message>>(getRepositoryToken(Message));
    listingsService = module.get<ListingsService>(ListingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConversation', () => {
    it('should return a conversation if found and user is a participant', async () => {
      const conversation = new Conversation();
      conversation.id = '1';
      conversation.buyerId = '1';
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };

      mockConversationRepository.findOne.mockResolvedValue(conversation);

      const result = await service.getConversation('1', user);

      expect(result).toEqual(conversation);
    });

    it('should throw a NotFoundException if conversation is not found', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      mockConversationRepository.findOne.mockResolvedValue(null);

      await expect(service.getConversation('1', user)).rejects.toThrow(
        new NotFoundException('Conversation not found.'),
      );
    });

    it('should throw a ForbiddenException if user is not a participant', async () => {
      const conversation = new Conversation();
      conversation.id = '1';
      conversation.buyerId = '2';
      conversation.sellerId = '3';
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };

      mockConversationRepository.findOne.mockResolvedValue(conversation);

      await expect(service.getConversation('1', user)).rejects.toThrow(
        new ForbiddenException('Access denied.'),
      );
    });
  });

  describe('startConversation', () => {
    it('should start a new conversation', async () => {
      const dto: StartConversationDto = {
        listingId: '1',
        content: 'Test message',
      };
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      const listing = new Listing();
      listing.owner = new User();
      listing.owner.id = '2';
      const conversation = new Conversation();
      conversation.id = '1';

      mockListingsService.findOne.mockResolvedValue(listing);
      mockConversationRepository.findOne.mockResolvedValue(null);
      mockConversationRepository.create.mockReturnValue(conversation);
      mockConversationRepository.save.mockResolvedValue(conversation);
      jest.spyOn(service, 'sendMessage').mockResolvedValue(new Message());
      jest.spyOn(service, 'getConversation').mockResolvedValue(conversation);

      const result = await service.startConversation(dto, user);

      expect(result).toEqual(conversation);
    });
  });
});
