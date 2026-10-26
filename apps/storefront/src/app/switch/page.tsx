import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SwitchPage } from '@/components/landing/info-pages';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

export async function generateMetadata(): Promise<Metadata> {
  return isRootHost(await requestHost())
    ? {
        title: { absolute: 'Switch to Commerce Platform' },
        description:
          'Move your store with a product CSV import, connect your domain and payments, and launch with a clear checklist.',
      }
    : {};
}

/** Moving from another platform (root host only; stores have no such page). */
export default async function Page() {
  if (!isRootHost(await requestHost())) notFound();
  return <SwitchPage />;
}
