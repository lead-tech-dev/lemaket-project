import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { MessageAttachment } from './message-attachment.entity';
import { MessageNotificationLog } from './message-notification-log.entity';
import { QuickReply } from './quick-reply.entity';
import { ListingsModule } from '../listings/listings.module';
import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';
import { MessageNotificationService } from './message-notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, MessageAttachment, QuickReply, MessageNotificationLog]),
    ListingsModule,
    MediaModule,
    UsersModule
  ],
  providers: [MessagesService, MessageNotificationService],
  controllers: [MessagesController],
  exports: [MessagesService]
})
export class MessagesModule {}
