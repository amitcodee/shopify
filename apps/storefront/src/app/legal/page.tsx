import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalHubPage } from '@/components/landing/legal-pages';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

export async function generateMetadata(): Promise<Metadata> {
  return isRootHost(await requestHost())
    ? { title: 'Legal', description: 'Terms, privacy, cookies and other policies.' }
    : {};
}

/** The legal hub (root host only). */
export default async function Page() {
  if (!isRootHost(await requestHost())) notFound();
  return <LegalHubPage />;
}
