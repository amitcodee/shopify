import { parseStoreApps, type StoreApps } from '@repo/contracts';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { AppsManager } from './apps-manager';

export const metadata: Metadata = { title: 'Apps' };

export default async function AppsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, apps] = await Promise.all([
    getStore(storeId),
    api<StoreApps>(`/admin/stores/${storeId}/apps`),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Apps"
        description="Add features to your storefront. Apps are built in, free and need no code — turn one on and it is live on your store."
      />
      <AppsManager
        storeId={storeId}
        initial={parseStoreApps(apps)}
        currency={store.currency}
        canEdit={store.permissions.includes('themes:write')}
      />
    </div>
  );
}
