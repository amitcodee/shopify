import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Post,
  Put,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  parseStoreApps,
  parseTheme,
  type StoreApps,
  storeAppsSchema,
  type Theme,
  type ThemeAiResult,
  themeAiInputSchema,
  type ThemeDraft,
  themeInputSchema,
  type ThemePreviewToken,
  themeSettingsSchema,
} from '@repo/contracts';
import { Prisma } from '@repo/db';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { signToken } from '../common/crypto.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { ENV, type Env } from '../config/env.js';
import { TenantDb } from '../database/database.module.js';
import { StoreResolver } from '../storefront/store-resolver.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { THEME_AI_CLIENT, type ThemeAiClient } from './theme-ai.js';

export const PREVIEW_PURPOSE = 'theme-preview';
const PREVIEW_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * The theme editor's backend: an unpublished draft per store, signed tokens that let the
 * editor's preview frame render that draft, publishing, store apps and the AI assistant.
 */
@Injectable()
export class ThemeEditorService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly resolver: StoreResolver,
    @Inject(ENV) private readonly env: Env,
    @Inject(THEME_AI_CLIENT) private readonly ai: ThemeAiClient | null,
  ) {}

  async getDraft(storeId: string): Promise<ThemeDraft | null> {
    const store = await this.tenantDb.run(storeId, (tx) =>
      tx.store.findUniqueOrThrow({
        where: { id: storeId },
        select: { themeDraft: true, themeDraftUpdatedAt: true },
      }),
    );
    if (!store.themeDraft || !store.themeDraftUpdatedAt) return null;
    const raw = store.themeDraft as { preset?: string; settings?: unknown };
    return {
      ...parseTheme(raw.preset ?? '', raw.settings),
      updatedAt: store.themeDraftUpdatedAt.toISOString(),
    };
  }

  async saveDraft(storeId: string, theme: Theme): Promise<ThemeDraft> {
    const updatedAt = new Date();
    await this.tenantDb.run(storeId, (tx) =>
      tx.store.update({
        where: { id: storeId },
        data: {
          themeDraft: theme,
          themeDraftUpdatedAt: updatedAt,
        },
      }),
    );
    return { ...theme, updatedAt: updatedAt.toISOString() };
  }

  async discardDraft(storeId: string): Promise<void> {
    await this.tenantDb.run(storeId, (tx) =>
      tx.store.update({
        where: { id: storeId },
        data: { themeDraft: Prisma.DbNull, themeDraftUpdatedAt: null },
      }),
    );
  }

  /** Makes the draft the live theme and clears it. */
  async publishDraft(storeId: string, actor: AuthUser, meta: RequestMeta): Promise<Theme> {
    const draft = await this.getDraft(storeId);
    if (!draft) throw new NotFoundException('There is no draft to publish.');
    const theme: Theme = { preset: draft.preset, settings: draft.settings };
    await this.tenantDb.run(storeId, async (tx) => {
      await tx.store.update({
        where: { id: storeId },
        data: {
          themePreset: theme.preset,
          themeSettings: theme.settings,
          themeDraft: Prisma.DbNull,
          themeDraftUpdatedAt: null,
        },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'theme.published',
        entityType: 'theme',
        entityId: storeId,
        data: { preset: theme.preset, template: theme.settings.template },
        meta,
      });
    });
    this.resolver.invalidate();
    return theme;
  }

  previewToken(storeId: string): ThemePreviewToken {
    const token = signToken(
      this.env.APP_ENCRYPTION_KEY,
      PREVIEW_PURPOSE,
      { s: storeId },
      PREVIEW_TTL_MS,
    );
    return { token, expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString() };
  }

  // Apps
  async getApps(storeId: string): Promise<StoreApps> {
    const store = await this.tenantDb.run(storeId, (tx) =>
      tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { apps: true } }),
    );
    return parseStoreApps(store.apps);
  }

  async saveApps(
    storeId: string,
    apps: StoreApps,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<StoreApps> {
    await this.tenantDb.run(storeId, async (tx) => {
      await tx.store.update({
        where: { id: storeId },
        data: { apps: apps },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'apps.updated',
        entityType: 'apps',
        entityId: storeId,
        data: Object.fromEntries(Object.entries(apps).map(([id, app]) => [id, app.enabled])),
        meta,
      });
    });
    this.resolver.invalidate();
    return apps;
  }

  // AI design assistant
  aiEnabled(): boolean {
    return this.ai !== null;
  }

  async askAi(storeId: string, prompt: string, theme: Theme): Promise<ThemeAiResult> {
    if (!this.ai) {
      throw new ServiceUnavailableException(
        'The AI design assistant is not set up on this platform yet.',
      );
    }
    const { name } = await this.tenantDb.run(storeId, (tx) =>
      tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { name: true } }),
    );
    const output = await this.ai.suggest(prompt, theme, name);
    if (!output) {
      throw new UnprocessableEntityException(
        'The assistant could not help with that request. Try describing the look you want.',
      );
    }
    // Apply each suggested value only if it passes the same validation as a manual edit.
    let settings = theme.settings;
    const changed: string[] = [];
    for (const [key, value] of Object.entries(output.changes)) {
      if (value === null || value === undefined) continue;
      const candidate = themeSettingsSchema.safeParse({ ...settings, [key]: value });
      if (!candidate.success) continue;
      if (
        JSON.stringify(candidate.data[key as keyof typeof settings]) ===
        JSON.stringify(settings[key as keyof typeof settings])
      )
        continue;
      settings = candidate.data;
      changed.push(key);
    }
    const preset = output.preset ?? theme.preset;
    if (preset !== theme.preset) changed.unshift('preset');
    return { summary: output.summary, theme: { preset, settings }, changed };
  }
}

type AiBody = z.output<typeof themeAiInputSchema>;

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId')
export class ThemeEditorController {
  constructor(private readonly editor: ThemeEditorService) {}

  @Get('theme/draft')
  @RequirePermission('settings:read')
  async draft(@CurrentStore() store: StoreContext): Promise<{ draft: ThemeDraft | null }> {
    return { draft: await this.editor.getDraft(store.id) };
  }

  @Put('theme/draft')
  @RequirePermission('themes:write')
  @ApiZodBody(themeInputSchema)
  saveDraft(
    @CurrentStore() store: StoreContext,
    @Body(new ZodPipe(themeInputSchema)) body: Theme,
  ): Promise<ThemeDraft> {
    return this.editor.saveDraft(store.id, body);
  }

  @Delete('theme/draft')
  @RequirePermission('themes:write')
  @HttpCode(204)
  discardDraft(@CurrentStore() store: StoreContext): Promise<void> {
    return this.editor.discardDraft(store.id);
  }

  @Post('theme/draft/publish')
  @RequirePermission('themes:write')
  @HttpCode(200)
  publish(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Theme> {
    return this.editor.publishDraft(store.id, user, meta);
  }

  @Post('theme/preview-token')
  @RequirePermission('themes:write')
  @HttpCode(200)
  previewToken(@CurrentStore() store: StoreContext): ThemePreviewToken {
    return this.editor.previewToken(store.id);
  }

  /** Whether "Ask AI" is available (the platform has an Anthropic API key). */
  @Get('theme/ai')
  @RequirePermission('settings:read')
  aiStatus(): { enabled: boolean } {
    return { enabled: this.editor.aiEnabled() };
  }

  @Post('theme/ai')
  @RequirePermission('themes:write')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(themeAiInputSchema)
  askAi(
    @CurrentStore() store: StoreContext,
    @Body(new ZodPipe(themeAiInputSchema)) body: AiBody,
  ): Promise<ThemeAiResult> {
    return this.editor.askAi(store.id, body.prompt, body.theme);
  }

  @Get('apps')
  @RequirePermission('settings:read')
  apps(@CurrentStore() store: StoreContext): Promise<StoreApps> {
    return this.editor.getApps(store.id);
  }

  @Put('apps')
  @RequirePermission('themes:write')
  @ApiZodBody(storeAppsSchema)
  saveApps(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(storeAppsSchema)) body: StoreApps,
    @ReqMeta() meta: RequestMeta,
  ): Promise<StoreApps> {
    return this.editor.saveApps(store.id, body, user, meta);
  }
}
