import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_SERVICE } from './storage.constants';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { StorageService } from './storage.service';

export const storageProvider: Provider = {
  provide: STORAGE_SERVICE,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): StorageService => {
    const driver = (configService.get<string>('storage.driver') ?? 'local').toLowerCase();

    switch (driver) {
      case 's3':
        return new S3StorageService(configService);
      case 'local':
      default:
        return new LocalStorageService(configService);
    }
  }
};
