import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const corsOrigins = (
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_URL ||
    process.env.APP_PUBLIC_URL ||
    'http://localhost:5173'
  )
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const storageDir = process.env.STORAGE_LOCAL_DIRECTORY || 'uploads';
  const publicPrefix = (process.env.STORAGE_LOCAL_PUBLIC_URL || '/uploads').replace(/\/?$/, '/');
  const uploadsPath = join(process.cwd(), storageDir);
  if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true });
  }
  app.useStaticAssets(uploadsPath, {
    prefix: publicPrefix,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const config = new DocumentBuilder()
    .setTitle('OMAKET API')
    .setDescription('The OMAKET API description')
    .setVersion('1.0')
    .addTag('OMAKET')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const url = await app.getUrl();
  // eslint-disable-next-line no-console
  console.log(`OMAKET API is running at ${url}`);
}

void bootstrap();
