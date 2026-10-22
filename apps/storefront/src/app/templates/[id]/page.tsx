import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TemplateDetail } from '@/components/landing/template-detail';
import { findThemeTemplate } from '@repo/contracts';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = findThemeTemplate((await params).id);
  if (!item || !isRootHost(await requestHost())) return {};
  return {
    title: `${item.name} template`,
    description: `${item.name}: a ${item.styleLabel.toLowerCase()} template for ${item.industryLabel.toLowerCase()} stores. ${item.description}`,
  };
}

/** One template (root host only). Unknown ids are 404s. */
export default async function Page({ params }: Props) {
  const item = findThemeTemplate((await params).id);
  if (!item || !isRootHost(await requestHost())) notFound();
  return <TemplateDetail template={item} />;
}
