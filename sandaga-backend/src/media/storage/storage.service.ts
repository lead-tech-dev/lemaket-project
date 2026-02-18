import type { Express } from 'express';

export type UploadResult = {
  url: string;
  key: string;
  originalName?: string | null;
  metadata?: Record<string, unknown>;
};

export interface StorageService {
  upload(file: Express.Multer.File): Promise<UploadResult>;
  remove?(key: string): Promise<void>;
}
