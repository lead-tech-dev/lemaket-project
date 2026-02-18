import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  driver: process.env.STORAGE_DRIVER ?? 'local',
  local: {
    directory: process.env.STORAGE_LOCAL_DIRECTORY ?? 'uploads',
    publicUrl: process.env.STORAGE_LOCAL_PUBLIC_URL ?? '/uploads'
  },
  s3: {
    bucket: process.env.STORAGE_S3_BUCKET ?? '',
    region: process.env.STORAGE_S3_REGION,
    accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
    endpoint: process.env.STORAGE_S3_ENDPOINT,
    publicUrl: process.env.STORAGE_S3_PUBLIC_URL,
    cdnDomain: process.env.STORAGE_S3_CDN_DOMAIN,
    prefix: process.env.STORAGE_S3_PREFIX ?? 'uploads',
    forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE
  }
}));
