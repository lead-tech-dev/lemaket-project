
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Sse
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { map } from 'rxjs/operators';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  list(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.messagesService.listConversations(
      user,
      cursor,
      limit ? Number(limit) : undefined
    );
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.messagesService.getConversation(id, user);
  }

  @Get('conversations/:id/messages')
  getConversationMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.messagesService.getMessages(
      id,
      user,
      cursor,
      limit ? Number(limit) : undefined
    );
  }

  @Post('conversations')
  startConversation(
    @Body() dto: StartConversationDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.messagesService.startConversation(dto, user);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.messagesService.sendMessage(id, dto, user);
  }

  @Post('conversations/:id/ai-reply')
  generateAiReply(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.messagesService.generateAiReply(id, user);
  }

  @Post('conversations/:id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.messagesService.markAsRead(id, user);
  }

  @Post('conversations/:id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser
  ) {
    return this.messagesService.uploadAttachment(id, file, user);
  }

  @Get('quick-replies')
  listQuickReplies(@CurrentUser() user: AuthUser) {
    return this.messagesService.listQuickReplies(user);
  }

  @Post('quick-replies')
  createQuickReply(
    @Body() dto: CreateQuickReplyDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.messagesService.createQuickReply(user, dto);
  }

  @Patch('quick-replies/:id')
  updateQuickReply(
    @Param('id') id: string,
    @Body() dto: UpdateQuickReplyDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.messagesService.updateQuickReply(user, id, dto);
  }

  @Delete('quick-replies/:id')
  deleteQuickReply(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.messagesService.deleteQuickReply(user, id);
  }

  @Sse('events')
  streamEvents(@CurrentUser() user: AuthUser) {
    return this.messagesService
      .subscribeToEvents(user.id)
      .pipe(map(payload => ({ data: payload })));
  }
}
