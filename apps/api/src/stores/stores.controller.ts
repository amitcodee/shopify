import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import {
  type AuditLogEntry,
  closeStoreInputSchema,
  type CreateStoreInput,
  createStoreInputSchema,
  type Paginated,
  type PaginationQuery,
  paginationQuerySchema,
  type StoreDetail,
  type StoreOverview,
  type StoreSummary,
  type UpdateStoreInput,
  updateStoreInputSchema,
} from '@repo/contracts';
import { AuditService } from '../audit/audit.service.js';
import type { AppRequest, AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import {
  AllowBillingLocked,
  AllowClosedStore,
  AllowSuspendedStore,
  RequirePermission,
  StoreAccessGuard,
} from '../tenancy/store-access.guard.js';
import { StoreClosureService } from './store-closure.service.js';
import { StoresService } from './stores.service.js';

@ApiTags('stores')
@ApiBearerAuth()
@Controller('admin/stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Post()
  @ApiZodBody(createStoreInputSchema)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createStoreInputSchema)) body: CreateStoreInput,
    @ReqMeta() meta: RequestMeta,
  ): Promise<StoreSummary> {
    return this.stores.create(user, body, meta);
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<StoreSummary[]> {
    return this.stores.listForUser(user.id);
  }

  /** The store picker's cards. Sessions only: an access token belongs to a single store. */
  @Get('overview')
  overview(@CurrentUser() user: AuthUser, @Req() req: AppRequest): Promise<StoreOverview[]> {
    if (req.auth?.apiToken) {
      throw new ForbiddenException('Access tokens cannot read the store overview.');
    }
    return this.stores.overviewForUser(user.id);
  }
}

@ApiTags('stores')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId')
export class StoreController {
  constructor(
    private readonly stores: StoresService,
    private readonly audit: AuditService,
    private readonly closures: StoreClosureService,
  ) {}

  @Get()
  @AllowSuspendedStore()
  @AllowBillingLocked()
  @AllowClosedStore()
  get(@CurrentStore() store: StoreContext): Promise<StoreDetail> {
    return this.stores.get(store);
  }

  /** Owner closes the store: storefront offline now, data erased after the grace period. */
  @Post('close')
  @HttpCode(200)
  @AllowBillingLocked()
  @ApiZodBody(closeStoreInputSchema)
  close(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(closeStoreInputSchema)) body: z.output<typeof closeStoreInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<StoreDetail> {
    return this.closures.close(store, body.confirmSubdomain, user, meta);
  }

  @Post('reopen')
  @HttpCode(200)
  @AllowBillingLocked()
  @AllowClosedStore()
  reopen(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<StoreDetail> {
    return this.closures.reopen(store, user, meta);
  }

  @Patch()
  @RequirePermission('settings:write')
  @ApiZodBody(updateStoreInputSchema)
  update(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateStoreInputSchema)) body: UpdateStoreInput,
    @ReqMeta() meta: RequestMeta,
  ): Promise<StoreDetail> {
    return this.stores.update(store, body, user, meta);
  }

  @Get('audit-logs')
  @RequirePermission('settings:read')
  auditLogs(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<AuditLogEntry>> {
    return this.audit.list(store.id, query);
  }
}
