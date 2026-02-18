import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import * as sharp from 'sharp';
import { STORAGE_SERVICE } from './storage/storage.constants';
import { StorageService } from './storage/storage.service';

type UploadFileOptions = {
  watermark?: boolean;
};

@Injectable()
export class MediaService {
  private readonly watermarkText: string;

  constructor(
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
    private readonly configService: ConfigService
  ) {
    this.watermarkText = this.configService.get<string>('MEDIA_WATERMARK_TEXT', 'LEMAKET');
  }

  async uploadFile(file: Express.Multer.File, options: UploadFileOptions = {}) {
    const applyWatermark = options.watermark ?? true;
    if (applyWatermark && this.shouldWatermark(file)) {
      const buffer = await this.addWatermark(file.buffer);
      return this.storageService.upload({ ...file, buffer });
    }
    return this.storageService.upload(file);
  }

  private shouldWatermark(file: Express.Multer.File): boolean {
    if (!file?.buffer) {
      return false;
    }
    if (!file.mimetype?.startsWith('image/')) {
      return false;
    }
    return !['image/gif', 'image/svg+xml'].includes(file.mimetype);
  }

  private async addWatermark(buffer: Buffer): Promise<Buffer> {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return buffer;
    }

    const fontSize = Math.max(18, Math.round(Math.min(metadata.width, metadata.height) * 0.07));
    const padding = Math.max(12, Math.round(fontSize * 0.6));
    const text = this.watermarkText;

    const svg = `
      <svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .shadow { fill: rgba(0,0,0,0.35); font-size: ${fontSize}px; font-family: Inter, Arial, sans-serif; font-weight: 700; }
          .watermark { fill: rgba(255,255,255,0.75); font-size: ${fontSize}px; font-family: Inter, Arial, sans-serif; font-weight: 700; }
        </style>
        <text x="${metadata.width - padding}" y="${metadata.height - padding}" text-anchor="end" dominant-baseline="ideographic" class="shadow">${text}</text>
        <text x="${metadata.width - padding - 1}" y="${metadata.height - padding - 1}" text-anchor="end" dominant-baseline="ideographic" class="watermark">${text}</text>
      </svg>
    `;

    const composite = image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
    if (metadata.format === 'jpeg') {
      return composite.jpeg({ quality: 90 }).toBuffer();
    }
    if (metadata.format === 'png') {
      return composite.png().toBuffer();
    }
    if (metadata.format === 'webp') {
      return composite.webp({ quality: 90 }).toBuffer();
    }
    return composite.toBuffer();
  }
}
