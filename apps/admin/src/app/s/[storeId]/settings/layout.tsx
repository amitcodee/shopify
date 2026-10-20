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
      <PageHeader title="Settings" />
      <SettingsTabs storeId={store.id} permissions={store.permissions} />
      <div className="mt-6">{children}</div>
    </>
  );
}
