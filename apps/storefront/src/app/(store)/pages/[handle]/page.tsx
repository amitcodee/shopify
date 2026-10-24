import type { StorefrontPage } from '@repo/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlainText } from '@/components/content';
import { isNotFound, sf } from '@/lib/api';

async function getPage(handle: string): Promise<StorefrontPage | null> {
  try {
    return await sf<StorefrontPage>(`/pages/${encodeURIComponent(handle)}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const page = await getPage((await params).handle);
  return page ? { title: page.title } : {};
}

export default async function ContentPage({ params }: { params: Promise<{ handle: string }> }) {
  const page = await getPage((await params).handle);
  if (!page) notFound();
  return (
    <article>
      <h1 className="page-title t-title mb-8">{page.title}</h1>
      <PlainText body={page.body} />
    </article>
  );
}
