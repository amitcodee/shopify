import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactPage } from '@/components/landing/info-pages';
import { fetchSupportEmail } from '@/components/landing/public-api';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

export async function generateMetadata(): Promise<Metadata> {
  return isRootHost(await requestHost())
    ? {
        title: 'Contact',
        description: 'Get help with your Commerce Platform store: guides, FAQ and email support.',
      }
    : {};
}

/** Support contact (root host only; stores have no such page). */
export default async function Page() {
  if (!isRootHost(await requestHost())) notFound();
  return <ContactPage supportEmail={await fetchSupportEmail()} />;
}
