import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CommerceModule } from './commerce/commerce.module.js';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { EmailModule } from './email/email.module.js';
import { HealthModule } from './health/health.module.js';
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
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60_000, limit: 300 }],
          // Integration tests sign up many users from one IP.
          skipIf: () => env.NODE_ENV === 'test',
        }),
        DatabaseModule,
        AuditModule,
        PlatformCoreModule,
        EmailModule,
        StorageModule,
        AuthModule,
        HealthModule,
        StoresModule,
        CatalogModule,
        StaffModule,
        StorefrontModule,
        CommerceModule,
        SettingsModule,
        PlatformAdminModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      ],
    };
  }
}
