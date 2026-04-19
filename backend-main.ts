/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACELERA DIGITAL PRO — BACK-END ARCHITECTURE
 * Stack: NestJS + TypeScript + PostgreSQL + Redis + JWT + WebAuthn
 * Security: OWASP Top 10 2026 compliance · RBAC · MFA · CSP · HSTS
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── src/main.ts ──────────────────────────────────────────────────────────────
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // ── SECURITY HEADERS (OWASP + CSP + HSTS) ──────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'nonce-{nonce}'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: ["'self'", 'https://api.acelera.digital'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year — OWASP recommended
        includeSubDomains: true,
        preload: true,
      },
      crossOriginEmbedderPolicy: { policy: 'require-corp' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      permissionsPolicy: {
        features: {
          camera: ["'none'"],
          microphone: ["'none'"],
          geolocation: ["'self'"],
        },
      },
    }),
  );

  // ── API VERSIONING ──────────────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  // ── VALIDATION PIPE (prevents injection) ───────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // strips unknown properties
      forbidNonWhitelisted: true, // throws on unknown properties
      transform: true,           // auto-transforms payloads
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // ── CORS ────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://acelera.digital'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
  });

  // ── COMPRESSION ─────────────────────────────────────────────────────────
  app.use(compression());

  // ── SWAGGER (disabled in production) ───────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Acelera Digital Pro API')
      .setDescription('RESTful API — v1')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication & Authorization')
      .addTag('users', 'User management')
      .addTag('courses', 'Course & module content')
      .addTag('analytics', 'Platform analytics')
      .addTag('payments', 'Payment gateway integration')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT || 3001);
  console.log(`🚀 API running on port ${process.env.PORT || 3001}`);
}

bootstrap();


// ── src/app.module.ts ─────────────────────────────────────────────────────────
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SocialModule } from './modules/social/social.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    // ── Config ────────────────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // ── Database: PostgreSQL ──────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
        synchronize: false,
        logging: config.get('NODE_ENV') !== 'production',
        ssl: config.get('NODE_ENV') === 'production' ? { rejectUnauthorized: true } : false,
        poolSize: 20,
        connectTimeoutMS: 5000,
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
    }),

    // ── Cache: Redis ──────────────────────────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        store: redisStore,
        url: config.get('REDIS_URL'),
        ttl: 300,
        max: 10000,
      }),
    }),

    // ── Rate Limiting (Redis-backed) ──────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: 1000, limit: 10 },       // 10 req/sec
          { name: 'medium', ttl: 60000, limit: 100 },     // 100 req/min
          { name: 'long', ttl: 3600000, limit: 1000 },    // 1000 req/hr
        ],
        storage: new ThrottlerStorageRedisService(config.get('REDIS_URL')),
      }),
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    CoursesModule,
    AnalyticsModule,
    PaymentsModule,
    SocialModule,
    NotificationsModule,
  ],
})
export class AppModule {}
