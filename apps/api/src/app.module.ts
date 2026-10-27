import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { PurchasingModule } from './purchasing/purchasing.module.js';
import { CommerceModule } from './commerce/commerce.module.js';
import { PostgresThrottlerStorage } from './common/postgres-throttler.storage.js';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import type { PrismaClient } from '@repo/db';
import { DatabaseModule, PLATFORM_DB } from './database/database.module.js';
import { EmailModule } from './email/email.module.js';
import { GiftCardsModule } from './gift-cards/gift-cards.module.js';
import { DeveloperModule } from './webhooks/developer.js';
import { WebhooksCoreModule } from './webhooks/webhooks.service.js';
import { HealthModule } from './health/health.module.js';
import { OnlineStoreModule } from './online-store/online-store.module.js';
import { PlatformAdminModule } from './platform/platform-admin.module.js';
import { PlatformCoreModule } from './platform/platform-core.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { StaffModule } from './staff/staff.module.js';
import { StorageModule } from './storage/storage.module.js';
import { StorefrontModule } from './storefront/storefront.module.js';
import { StoresModule } from './stores/stores.module.js';

@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.register(env),
        ThrottlerModule.forRootAsync({
          imports: [DatabaseModule],
          inject: [PLATFORM_DB],
          useFactory: (db: PrismaClient) => ({
            throttlers: [{ ttl: 60_000, limit: 300 }],
            // Integration tests sign up many users from one IP.
            skipIf: () => env.NODE_ENV === 'test',
            // Shared across instances by default; per-process memory only when opted in.
            storage:
              env.RATE_LIMIT_STORE === 'memory' ? undefined : new PostgresThrottlerStorage(db),
          }),
        }),
        DatabaseModule,
        AuditModule,
        WebhooksCoreModule,
        PlatformCoreModule,
        EmailModule,
        StorageModule,
        AuthModule,
        HealthModule,
        StoresModule,
        CatalogModule,
        PurchasingModule,
        StaffModule,
        StorefrontModule,
        CommerceModule,
        SettingsModule,
        OnlineStoreModule,
        GiftCardsModule,
        DeveloperModule,
        PlatformAdminModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      ],
    };
  }
}
