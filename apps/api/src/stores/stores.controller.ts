import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type AuditLogEntry,
  type CreateStoreInput,
  createStoreInputSchema,
  type Paginated,
  type PaginationQuery,
  paginationQuerySchema,
  type StoreDetail,
  type StoreSummary,
  type UpdateStoreInput,
  updateStoreInputSchema,
} from '@repo/contracts';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import {
  AllowSuspendedStore,
  RequirePermission,
  StoreAccessGuard,
} from '../tenancy/store-access.guard.js';
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
}

@ApiTags('stores')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId')
export class StoreController {
  constructor(
    private readonly stores: StoresService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @AllowSuspendedStore()
  get(@CurrentStore() store: StoreContext): Promise<StoreDetail> {
    return this.stores.get(store);
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
