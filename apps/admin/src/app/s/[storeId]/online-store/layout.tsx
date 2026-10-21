import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui';
import { OnlineStoreTabs } from './tabs';

export default async function OnlineStoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  return (
    <>
      <PageHeader
        title="Online store"
        description="Content pages, store policies and the menus shown on your storefront."
      />
      <OnlineStoreTabs storeId={storeId} />
      <div className="mt-6">{children}</div>
    </>
  );
}
