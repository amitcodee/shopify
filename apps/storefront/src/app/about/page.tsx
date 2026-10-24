import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AboutPage } from '@/components/landing/legal-pages';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

export async function generateMetadata(): Promise<Metadata> {
  return isRootHost(await requestHost()) ? { title: 'About us' } : {};
}

/** About the platform (root host only). */
export default async function Page() {
  if (!isRootHost(await requestHost())) notFound();
  return <AboutPage />;
}
