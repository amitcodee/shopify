import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuidesHub } from '@/components/landing/guides-pages';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

export async function generateMetadata(): Promise<Metadata> {
  return isRootHost(await requestHost())
    ? {
        title: 'Guides',
        description:
          'Step-by-step guides for setting up and running your store on Commerce Platform.',
      }
    : {};
}

/** The help center (root host only; stores have no such page). */
export default async function Page() {
  if (!isRootHost(await requestHost())) notFound();
  return <GuidesHub />;
}
