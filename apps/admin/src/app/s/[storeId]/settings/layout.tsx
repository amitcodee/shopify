import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui';
import { getStore } from '@/lib/session';
import { SettingsTabs } from './tabs';

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  return (
    <>
      <PageHeader title="Settings" description="Manage how your store looks, sells and ships." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-8">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <SettingsTabs storeId={store.id} permissions={store.permissions} />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
