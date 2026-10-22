import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FeaturePage } from '@/components/landing/features-pages';
import { findFeatureArea } from '@/components/landing/features-data';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = findFeatureArea((await params).slug);
  if (!item || !isRootHost(await requestHost())) return {};
  return { title: item.name, description: item.subhead };
}

/** One feature area (root host only). Unknown ids are 404s. */
export default async function Page({ params }: Props) {
  const item = findFeatureArea((await params).slug);
  if (!item || !isRootHost(await requestHost())) notFound();
  return <FeaturePage area={item} />;
}
