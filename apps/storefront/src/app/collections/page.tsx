import type { StorefrontCollection } from '@repo/contracts';
import Link from 'next/link';
import { sf } from '@/lib/api';

export const metadata = { title: 'Collections' };

export default async function CollectionsPage() {
  const collections = await sf<StorefrontCollection[]>('/collections');
  return (
    <>
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Collections</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: 'All products', handle: 'all', description: 'Everything we sell.' },
          ...collections,
        ].map((c) => (
          <li key={c.handle}>
            <Link
              href={`/collections/${c.handle}`}
              className="block rounded-xl border border-zinc-200 p-6 hover:border-zinc-900"
            >
              <h2 className="text-lg font-semibold">{c.title}</h2>
              {c.description ? <p className="mt-1 text-sm text-zinc-600">{c.description}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
