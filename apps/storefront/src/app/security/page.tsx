import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SecurityPage } from '@/components/landing/info-pages';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

export async function generateMetadata(): Promise<Metadata> {
  return isRootHost(await requestHost())
    ? {
        title: 'Security',
        description:
          'How Commerce Platform protects stores: database-level isolation, hosted card payments, two-factor sign-in and more.',
      }
    : {};
}

/** How stores are protected (root host only; stores have no such page). */
export default async function Page() {
  if (!isRootHost(await requestHost())) notFound();
  return <SecurityPage />;
}
