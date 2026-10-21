import { randomBytes } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  API_TOKEN_PREFIX,
  type ApiToken,
  apiTokenInputSchema,
  type CreatedApiToken,
  type CreatedWebhook,
  type Permission,
  type Webhook,
  type WebhookDelivery,
  webhookInputSchema,
} from '@repo/contracts';
import type { PrismaClient } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { hashToken } from '../auth/session.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { APP_DB, TenantDb } from '../database/database.module.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { WebhooksService } from './webhooks.service.js';

const MAX_TOKENS = 25;

@Injectable()
export class ApiTokensService {
  constructor(
    // ApiToken is a global table (looked up before the store is known), always filtered by store.
    @Inject(APP_DB) private readonly db: PrismaClient,
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async list(storeId: string): Promise<ApiToken[]> {
    const rows = await this.db.apiToken.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { email: true } } },
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      prefix: t.prefix,
      permissions: t.permissions as Permission[],
      createdBy: t.createdBy.email,
      lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      revokedAt: t.revokedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async create(
    store: StoreContext,
    input: z.output<typeof apiTokenInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<CreatedApiToken> {
    const beyond = input.permissions.filter((p) => !store.permissions.includes(p));
    if (beyond.length > 0) {
      throw new ForbiddenException(
        `You cannot grant permissions you do not have: ${beyond.join(', ')}.`,
      );
    }
    const active = await this.db.apiToken.count({ where: { storeId: store.id, revokedAt: null } });
    if (active >= MAX_TOKENS) throw new ForbiddenException(`At most ${MAX_TOKENS} active tokens.`);
    const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const created = await this.db.apiToken.create({
      data: {
        storeId: store.id,
        name: input.name,
        tokenHash: hashToken(token),
        prefix: token.slice(0, 12),
        permissions: input.permissions,
        createdById: actor.id,
      },
    });
    await this.tenantDb.run(store.id, (tx) =>
      this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'api_token.created',
        entityType: 'api_token',
        entityId: created.id,
        data: { name: input.name, permissions: input.permissions },
        meta,
      }),
    );
    return {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      permissions: input.permissions,
      createdBy: actor.email,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: created.createdAt.toISOString(),
      token,
    };
  }

  async revoke(storeId: string, id: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    const revoked = await this.db.apiToken.updateMany({
      where: { id, storeId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw new NotFoundException('Token not found.');
    await this.tenantDb.run(storeId, (tx) =>
      this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'api_token.revoked',
        entityType: 'api_token',
        entityId: id,
        meta,
      }),
    );
  }
}

@ApiTags('developer')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/api-tokens')
export class ApiTokensController {
  constructor(private readonly tokens: ApiTokensService) {}

  @Get()
  @RequirePermission('settings:write')
  list(@CurrentStore() store: StoreContext): Promise<ApiToken[]> {
    return this.tokens.list(store.id);
  }

  @Post()
  @RequirePermission('settings:write')
  @ApiZodBody(apiTokenInputSchema)
  create(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(apiTokenInputSchema)) body: z.output<typeof apiTokenInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<CreatedApiToken> {
    return this.tokens.create(store, body, user, meta);
  }

  @Delete(':tokenId')
  @HttpCode(204)
  @RequirePermission('settings:write')
  revoke(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('tokenId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.tokens.revoke(store.id, id, user, meta);
  }
}

/** Webhook subscriptions; usable with an access token too, so integrations register their own. */
@ApiTags('developer')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @RequirePermission('settings:write')
  list(@CurrentStore() store: StoreContext): Promise<Webhook[]> {
    return this.webhooks.list(store.id);
  }

  @Post()
  @RequirePermission('settings:write')
  @ApiZodBody(webhookInputSchema)
  create(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(webhookInputSchema)) body: z.output<typeof webhookInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<CreatedWebhook> {
    return this.webhooks.create(store.id, body, user, meta);
  }

  @Delete(':webhookId')
  @HttpCode(204)
  @RequirePermission('settings:write')
  remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('webhookId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.webhooks.remove(store.id, id, user, meta);
  }

  @Post(':webhookId/enable')
  @HttpCode(200)
  @RequirePermission('settings:write')
  enable(
    @CurrentStore() store: StoreContext,
    @Param('webhookId', UuidParam) id: string,
  ): Promise<Webhook> {
    return this.webhooks.enable(store.id, id);
  }

  @Get(':webhookId/deliveries')
  @RequirePermission('settings:write')
  deliveries(
    @CurrentStore() store: StoreContext,
    @Param('webhookId', UuidParam) id: string,
  ): Promise<WebhookDelivery[]> {
    return this.webhooks.deliveries(store.id, id);
  }
}

@Module({
  controllers: [ApiTokensController, WebhooksController],
  providers: [ApiTokensService, WebhooksService],
  exports: [WebhooksService],
})
export class DeveloperModule {}
