/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { UploadResult, StorageService } from './storage.service';

type S3ClientLike = {
  send(command: any): Promise<any>
}

type S3Module = {
  S3Client: new (config: Record<string, unknown>) => S3ClientLike
  PutObjectCommand: new (input: Record<string, unknown>) => any
}

@Injectable()
export class S3StorageService implements StorageService {
  private readonly client: S3ClientLike;
  private readonly bucket: string;
  private readonly publicUrlBase: string | undefined;
  private readonly putObjectCommand: S3Module['PutObjectCommand'];

  private readonly logger = new Logger(S3StorageService.name);

  constructor(private readonly configService: ConfigService) {
    const s3Module = this.loadS3Module();
    this.bucket = this.configService.get<string>('storage.s3.bucket', 'sandaga-media');
    const region = this.configService.get<string>('storage.s3.region');
    const endpoint = this.configService.get<string>('storage.s3.endpoint');
    this.publicUrlBase = this.configService.get<string>('storage.s3.publicUrl');

    if (!region && !endpoint) {
      throw new Error('S3 storage requires either STORAGE_S3_REGION or STORAGE_S3_ENDPOINT');
    }

    this.client = new s3Module.S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: this.configService.get<string>('storage.s3.accessKeyId') ?? process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: this.configService.get<string>('storage.s3.secretAccessKey') ?? process.env.AWS_SECRET_ACCESS_KEY ?? ''
      },
      forcePathStyle: (this.configService.get('storage.s3.forcePathStyle') ?? 'false') === 'true'
    });
    this.putObjectCommand = s3Module.PutObjectCommand;
  }

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    if (!file?.buffer) {
      throw new Error('File buffer is empty');
    }

    const key = this.buildKey(file.originalname);

    try {
      await this.client.send(
        new this.putObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read'
        })
      );
    } catch (error) {
      this.logger.error('Failed to upload file to S3', error as Error);
      throw new InternalServerErrorException('Failed to upload file to S3', { cause: error });
    }

    return {
      key,
      url: this.resolvePublicUrl(key),
      originalName: file.originalname
    };
  }

  private buildKey(originalName: string): string {
    const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
    return `${this.configService.get<string>('storage.s3.prefix', 'uploads')}/${randomUUID()}${extension}`;
  }

  private resolvePublicUrl(key: string): string {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase.replace(/\/$/, '')}/${key}`;
    }

    const region = this.configService.get<string>('storage.s3.region');
    const customDomain = this.configService.get<string>('storage.s3.cdnDomain');

    if (customDomain) {
      return `https://${customDomain.replace(/\/$/, '')}/${key}`;
    }

    const endpoint = this.configService.get<string>('storage.s3.endpoint');
    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
    }

    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private loadS3Module(): S3Module {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const module = require('@aws-sdk/client-s3') as S3Module;
      return module;
    } catch (error) {
      throw new Error(
        'S3 storage driver requires the "@aws-sdk/client-s3" package. Install it and restart the application.'
      );
    }
  }
}
