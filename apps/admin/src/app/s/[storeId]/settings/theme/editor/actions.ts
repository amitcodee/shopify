'use server';

import type {
  StoreApps,
  Theme,
  ThemeAiResult,
  ThemeDraft,
  ThemePreviewToken,
} from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

/** Result of an editor action: data on success, or a message to show the merchant. */
export type EditorResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function attempt<T>(run: () => Promise<T>): Promise<EditorResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ok: false, error: error.message };
  }
}

const base = (storeId: string) => `/admin/stores/${storeId}`;

export async function saveDraftAction(storeId: string, theme: Theme) {
  return attempt(() =>
    api<ThemeDraft>(`${base(storeId)}/theme/draft`, { method: 'PUT', body: theme }),
  );
}

export async function discardDraftAction(storeId: string) {
  return attempt(async () => {
    await api(`${base(storeId)}/theme/draft`, { method: 'DELETE' });
    return api<Theme>(`${base(storeId)}/theme`);
  });
}

export async function publishDraftAction(storeId: string, theme: Theme) {
  const result = await attempt(async () => {
    // Save the latest edits first, so what is published is exactly what is on screen.
    await api(`${base(storeId)}/theme/draft`, { method: 'PUT', body: theme });
    return api<Theme>(`${base(storeId)}/theme/draft/publish`, { method: 'POST' });
  });
  if (result.ok) revalidatePath(`/s/${storeId}/settings/theme`);
  return result;
}

export async function previewTokenAction(storeId: string) {
  return attempt(() =>
    api<ThemePreviewToken>(`${base(storeId)}/theme/preview-token`, { method: 'POST' }),
  );
}

export async function askAiAction(
  storeId: string,
  prompt: string,
  theme: Theme,
): Promise<EditorResult<ThemeAiResult>> {
  try {
    const data = await api<ThemeAiResult>(`${base(storeId)}/theme/ai`, {
      method: 'POST',
      body: { prompt, theme },
    });
    return { ok: true, data };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 503) {
      return { ok: false, error: 'The AI design assistant is not set up on this platform yet.' };
    }
    if (error.status === 429) {
      return { ok: false, error: 'That was a lot of requests. Wait a minute and try again.' };
    }
    if (error.status >= 500) {
      return { ok: false, error: 'The AI assistant could not respond. Please try again.' };
    }
    return { ok: false, error: error.message };
  }
}

export async function saveAppsAction(storeId: string, apps: StoreApps) {
  const result = await attempt(() =>
    api<StoreApps>(`${base(storeId)}/apps`, { method: 'PUT', body: apps }),
  );
  if (result.ok) revalidatePath(`/s/${storeId}/apps`);
  return result;
}
