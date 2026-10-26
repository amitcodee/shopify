import { type Policy, policyKindSchema } from '@repo/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlainText } from '@/components/content';
import { isNotFound, sf } from '@/lib/api';

async function getPolicy(kind: string): Promise<Policy | null> {
  if (!policyKindSchema.safeParse(kind).success) return null;
  try {
    return await sf<Policy>(`/policies/${kind}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const policy = await getPolicy((await params).kind);
  return policy ? { title: policy.title } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ kind: string }> }) {
  const policy = await getPolicy((await params).kind);
  if (!policy) notFound();
  return (
    <article>
      <h1 className="page-title t-title mb-8">{policy.title}</h1>
      <PlainText body={policy.body} />
    </article>
  );
}
