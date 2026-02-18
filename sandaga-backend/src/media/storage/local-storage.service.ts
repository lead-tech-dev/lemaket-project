import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import type { Express } from 'express';
import { UploadResult, StorageService } from './storage.service';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly uploadDir: string;
  private readonly publicUrlPrefix: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('storage.local.directory', 'uploads');
    this.publicUrlPrefix = this.configService.get<string>('storage.local.publicUrl', '/uploads');
  }

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    if (!file?.buffer) {
      throw new Error('File buffer is empty');
    }

    const fileName = this.buildFilename(file.originalname);
    const filePath = join(process.cwd(), this.uploadDir, fileName);

    await fs.mkdir(join(process.cwd(), this.uploadDir), { recursive: true });
    await fs.writeFile(filePath, file.buffer);

    const normalizedPrefix = this.publicUrlPrefix.replace(/\/$/, '');

    return {
      url: `${normalizedPrefix}/${fileName}`,
      key: fileName,
      originalName: file.originalname
    };
  }

  private buildFilename(originalName: string): string {
    const extension = extname(originalName) || '.dat';
    const baseName = originalName
      .replace(extension, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .toLowerCase();
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    return `${baseName || 'file'}-${timestamp}-${random}${extension}`;
  }
}
