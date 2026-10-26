import {
  parseStoreApps,
  parseTheme,
  type StoreApps,
  type Theme,
  type ThemeDraft,
  type ThemePreviewToken,
} from '@repo/contracts';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { storefrontUrlFor } from '@/lib/storefront';
import { ThemeEditor } from './theme-editor';

export const metadata: Metadata = { title: 'Theme editor' };

export default async function ThemeEditorPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  const canEdit = store.permissions.includes('themes:write');
  const base = `/admin/stores/${storeId}`;
  const [live, { draft }, apps, ai, token] = await Promise.all([
    api<Theme>(`${base}/theme`),
    api<{ draft: ThemeDraft | null }>(`${base}/theme/draft`),
    api<StoreApps>(`${base}/apps`),
    api<{ enabled: boolean }>(`${base}/theme/ai`),
    canEdit
      ? api<ThemePreviewToken>(`${base}/theme/preview-token`, { method: 'POST' })
      : Promise.resolve({ token: '', expiresAt: '' }),
  ]);
  return (
    <ThemeEditor
      storeId={storeId}
      storeName={store.name}
      storefrontUrl={storefrontUrlFor(store.subdomain)}
      live={parseTheme(live.preset, live.settings)}
      draft={draft ? parseTheme(draft.preset, draft.settings) : null}
      previewToken={token.token}
      apps={parseStoreApps(apps)}
      aiEnabled={ai.enabled}
      canEdit={canEdit}
      exitHref={`/s/${storeId}/settings/theme`}
    />
  );
}
