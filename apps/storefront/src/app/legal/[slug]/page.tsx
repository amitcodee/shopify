import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findLegalDoc } from '@/components/landing/legal-data';
import { LegalDocPage } from '@/components/landing/legal-pages';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = findLegalDoc((await params).slug);
  if (!doc || !isRootHost(await requestHost())) return {};
  return { title: doc.title, description: doc.summary };
}

/** One policy (root host only). Unknown slugs are 404s. */
export default async function Page({ params }: Props) {
  const doc = findLegalDoc((await params).slug);
  if (!doc || !isRootHost(await requestHost())) notFound();
  return <LegalDocPage doc={doc} />;
}
