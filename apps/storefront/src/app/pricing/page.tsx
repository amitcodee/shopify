import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PricingPage } from '@/components/landing/pricing-page';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

export async function generateMetadata(): Promise<Metadata> {
  return isRootHost(await requestHost()) ? { title: 'Pricing' } : {};
}

/** Platform pricing (root host only; stores have no pricing page). */
export default async function Page() {
  if (!isRootHost(await requestHost())) notFound();
  return <PricingPage />;
}
