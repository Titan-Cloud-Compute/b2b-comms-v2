import 'reflect-metadata';
import './auth/session.types'; // ensure Request augmentation is loaded at boot
import { NestFactory, NestApplication } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { assertSecuritySafe } from './config/security-config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  // Fail fast on an unsafe security config (e.g. default JWT secret in prod)
  // before any listener is bound.
  assertSecuritySafe();
  const app = await NestFactory.create<NestApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    // Disable Nest's default body parser so we can configure express directly
    // (we need urlencoded for the Twilio webhook + JSON for everything else).
    bodyParser: false,
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  );

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:4200';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Enterprise Template API')
    .setDescription('NestJS + Prisma backend API')
    .setVersion('1.0')
    .addCookieAuth(process.env.SESSION_COOKIE_NAME ?? 'session')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Run lifecycle hooks (e.g. RedisService.onModuleDestroy → BullMQ
  // worker.close()) on SIGTERM so a rolling deploy DRAINS in-flight jobs
  // instead of abandoning them mid-run. Without this, NestJS installs no
  // signal handler and background jobs (diagnostic generation, ocr, embed)
  // are killed and orphaned on every rollout.
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
  logger.log(`tRPC endpoint at http://localhost:${port}/trpc`);
}

bootstrap();
