import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type Menu,
  type MenuHandle,
  menuHandleSchema,
  menuInputSchema,
  type Page,
  pageInputSchema,
  type Policy,
  policyInputSchema,
  type PolicyKind,
  policyKindSchema,
} from '@repo/contracts';
import type { z } from 'zod';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { OnlineStoreService } from './online-store.service.js';

type PageBody = z.output<typeof pageInputSchema>;

/** Online store content: pages, policies and navigation menus. */
@ApiTags('online-store')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId')
export class OnlineStoreController {
  constructor(private readonly onlineStore: OnlineStoreService) {}

  @Get('pages')
  @RequirePermission('settings:read')
  listPages(@CurrentStore() store: StoreContext): Promise<Page[]> {
    return this.onlineStore.listPages(store.id);
  }

  @Post('pages')
  @RequirePermission('themes:write')
  @ApiZodBody(pageInputSchema)
  createPage(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(pageInputSchema)) body: PageBody,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Page> {
    return this.onlineStore.createPage(store.id, body, user, meta);
  }

  @Get('pages/:pageId')
  @RequirePermission('settings:read')
  getPage(
    @CurrentStore() store: StoreContext,
    @Param('pageId', UuidParam) id: string,
  ): Promise<Page> {
    return this.onlineStore.getPage(store.id, id);
  }

  @Put('pages/:pageId')
  @RequirePermission('themes:write')
  @ApiZodBody(pageInputSchema)
  updatePage(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('pageId', UuidParam) id: string,
    @Body(new ZodPipe(pageInputSchema)) body: PageBody,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Page> {
    return this.onlineStore.updatePage(store.id, id, body, user, meta);
  }

  @Delete('pages/:pageId')
  @HttpCode(204)
  @RequirePermission('themes:write')
  removePage(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('pageId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.onlineStore.removePage(store.id, id, user, meta);
  }

  @Get('policies')
  @RequirePermission('settings:read')
  listPolicies(@CurrentStore() store: StoreContext): Promise<Policy[]> {
    return this.onlineStore.listPolicies(store.id);
  }

  @Put('policies/:kind')
  @RequirePermission('themes:write')
  @ApiZodBody(policyInputSchema)
  setPolicy(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('kind', new ZodPipe(policyKindSchema)) kind: PolicyKind,
    @Body(new ZodPipe(policyInputSchema)) body: z.output<typeof policyInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Policy> {
    return this.onlineStore.setPolicy(store.id, kind, body.body, user, meta);
  }

  @Get('menus')
  @RequirePermission('settings:read')
  listMenus(@CurrentStore() store: StoreContext): Promise<Menu[]> {
    return this.onlineStore.listMenus(store.id);
  }

  @Put('menus/:handle')
  @RequirePermission('themes:write')
  @ApiZodBody(menuInputSchema)
  setMenu(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('handle', new ZodPipe(menuHandleSchema)) handle: MenuHandle,
    @Body(new ZodPipe(menuInputSchema)) body: z.output<typeof menuInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Menu> {
    return this.onlineStore.setMenu(store.id, handle, body.items, user, meta);
  }

  /** Back to the default menu (catalog + collections for main, search for footer). */
  @Delete('menus/:handle')
  @HttpCode(204)
  @RequirePermission('themes:write')
  resetMenu(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('handle', new ZodPipe(menuHandleSchema)) handle: MenuHandle,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.onlineStore.resetMenu(store.id, handle, user, meta);
  }
}
