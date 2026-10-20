import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type PrismaClient, type TenantTx, withTenant } from '@repo/db';
import { ENV, type Env } from '../config/env.js';

/** RLS-restricted client (role `shop_app`). Tenant tables are only visible via TenantDb.run. */
export const APP_DB = Symbol('APP_DB');
/** BYPASSRLS client (role `shop_platform`). Only for platform admin and cross-tenant jobs. */
export const PLATFORM_DB = Symbol('PLATFORM_DB');

@Injectable()
export class TenantDb {
  constructor(@Inject(APP_DB) private readonly db: PrismaClient) {}

  /** Runs `fn` in a transaction scoped by row-level security to `storeId`. */
  run<T>(storeId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return withTenant(this.db, storeId, fn);
  }
}

@Injectable()
class DatabaseLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(APP_DB) private readonly app: PrismaClient,
    @Inject(PLATFORM_DB) private readonly platform: PrismaClient,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.app.$disconnect(), this.platform.$disconnect()]);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: APP_DB,
      inject: [ENV],
      useFactory: (env: Env) => createPrismaClient(env.DATABASE_URL),
    },
    {
      provide: PLATFORM_DB,
      inject: [ENV],
      useFactory: (env: Env) => createPrismaClient(env.DATABASE_URL_PLATFORM),
    },
    TenantDb,
    DatabaseLifecycle,
  ],
  exports: [APP_DB, PLATFORM_DB, TenantDb],
})
export class DatabaseModule {}
