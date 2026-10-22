import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuidePage } from '@/components/landing/guides-pages';
import { findGuide } from '@/components/landing/guides-data';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = findGuide((await params).slug);
  if (!item || !isRootHost(await requestHost())) return {};
  return { title: item.title, description: item.summary };
}

/** One guide (root host only). Unknown ids are 404s. */
export default async function Page({ params }: Props) {
  const item = findGuide((await params).slug);
  if (!item || !isRootHost(await requestHost())) notFound();
  return <GuidePage guide={item} />;
}
