import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FeaturesHub } from '@/components/landing/features-pages';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

export async function generateMetadata(): Promise<Metadata> {
  return isRootHost(await requestHost())
    ? {
        title: 'Features',
        description:
          'Every feature of Commerce Platform: online store, checkout, payments, inventory, orders, marketing, analytics and more.',
      }
    : {};
}

/** All feature areas (root host only; stores have no such page). */
export default async function Page() {
  if (!isRootHost(await requestHost())) notFound();
  return <FeaturesHub />;
}
