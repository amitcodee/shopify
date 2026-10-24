import { Inject, Injectable } from '@nestjs/common';
import { parseTheme, type Theme } from '@repo/contracts';
import { verifyToken } from '../common/crypto.js';
import { ENV, type Env } from '../config/env.js';
import { TenantDb } from '../database/database.module.js';

/** Must match PREVIEW_PURPOSE in settings/theme-editor.ts (which signs these tokens). */
const PREVIEW_PURPOSE = 'theme-preview';

/** Resolves the theme editor's draft for a storefront request carrying a valid preview token. */
@Injectable()
export class ThemePreviewService {
  constructor(
    private readonly tenantDb: TenantDb,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async draftFor(storeId: string, token: string | undefined): Promise<Theme | null> {
    if (!token) return null;
    const payload = verifyToken<{ s: string }>(this.env.APP_ENCRYPTION_KEY, PREVIEW_PURPOSE, token);
    if (!payload || payload.s !== storeId) return null;
    const store = await this.tenantDb.run(storeId, (tx) =>
      tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { themeDraft: true } }),
    );
    if (!store.themeDraft) return null;
    const raw = store.themeDraft as { preset?: string; settings?: unknown };
    return parseTheme(raw.preset ?? '', raw.settings);
  }
}
