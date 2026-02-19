
import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from '../src/messages/messages.controller';
import { MessagesService } from '../src/messages/messages.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { UserRole } from '../src/common/enums/user-role.enum';
import { StartConversationDto } from '../src/messages/dto/start-conversation.dto';
import { SendMessageDto } from '../src/messages/dto/send-message.dto';

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: MessagesService;

  const mockMessagesService = {
    listConversations: jest.fn(),
    getConversation: jest.fn(),
    getMessages: jest.fn(),
    startConversation: jest.fn(),
    sendMessage: jest.fn(),
    markAsRead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessagesController>(MessagesController);
    service = module.get<MessagesService>(MessagesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should call messagesService.listConversations with the correct user', async () => {
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.list(user);
      expect(service.listConversations).toHaveBeenCalledWith(user, undefined, undefined);
    });
  });

  describe('startConversation', () => {
    it('should call messagesService.startConversation with the correct parameters', async () => {
      const dto: StartConversationDto = {
        listingId: '1',
        content: 'Test message',
      };
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.startConversation(dto, user);
      expect(service.startConversation).toHaveBeenCalledWith(dto, user);
    });
  });

  describe('sendMessage', () => {
    it('should call messagesService.sendMessage with the correct parameters', async () => {
      const id = '1';
      const dto: SendMessageDto = { content: 'Test message' };
      const user = { id: '1', email: 'test@example.com', role: UserRole.USER };
      await controller.sendMessage(id, dto, user);
      expect(service.sendMessage).toHaveBeenCalledWith(id, dto, user);
    });
  });
});
