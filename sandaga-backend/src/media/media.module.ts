import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { storageProvider } from './storage/storage.provider';

@Module({
  imports: [ConfigModule],
  controllers: [MediaController],
  providers: [MediaService, storageProvider],
  exports: [MediaService]
})
export class MediaModule {}
