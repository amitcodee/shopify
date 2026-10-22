import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TemplatesPage } from '@/components/landing/templates-page';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

export async function generateMetadata(): Promise<Metadata> {
  return isRootHost(await requestHost()) ? { title: 'Templates' } : {};
}

/** The public template store (root host only; stores have no templates page). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isRootHost(await requestHost())) notFound();
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  return <TemplatesPage industry={first(params.industry)} style={first(params.style)} />;
}
