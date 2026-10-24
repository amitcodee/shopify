import type { StoreSummary } from '@repo/contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TopBar } from '@/components/top-bar';
import { Badge, ButtonLink, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';

export const metadata = { title: 'Your stores · Merchant Admin' };

/** Deterministic accent per store so each tile is recognisable at a glance. */
const ACCENTS = [
  'from-brand-400 to-brand-700',
  'from-emerald-400 to-teal-700',
  'from-amber-400 to-orange-600',
  'from-sky-400 to-blue-700',
  'from-fuchsia-400 to-purple-700',
  'from-rose-400 to-red-600',
];

function accentFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ACCENTS[hash % ACCENTS.length] ?? 'from-brand-400 to-brand-700';
}

export default async function StoresPage() {
  const [user, stores] = await Promise.all([
    getCurrentUser(),
    api<StoreSummary[]>('/admin/stores'),
  ]);
  if (stores.length === 0 && user.platformRole !== 'SUPER_ADMIN') redirect('/onboarding');

  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
        <PageHeader
          title="Your stores"
          description={`Signed in as ${user.name}. Pick a store to manage, or create a new one.`}
          actions={<ButtonLink href="/onboarding">Create store</ButtonLink>}
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                href={`/s/${store.id}`}
                className="group flex h-full flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/[0.06] transition hover:-translate-y-0.5 hover:shadow-pop hover:ring-brand-500/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    aria-hidden
                    className={`grid size-11 place-items-center rounded-xl bg-gradient-to-br text-lg font-semibold text-white shadow-sm ${accentFor(store.id)}`}
                  >
                    {store.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {store.status === 'SUSPENDED' ? <Badge tone="red">Suspended</Badge> : null}
                    <Badge tone="indigo">{store.role.toLowerCase()}</Badge>
                  </div>
                </div>
                <p className="mt-4 truncate font-semibold text-slate-900">{store.name}</p>
                <p className="truncate text-sm text-slate-500">{store.subdomain}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                  Open admin
                  <span aria-hidden className="transition group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/onboarding"
              className="flex h-full min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 transition hover:border-brand-400 hover:bg-white hover:text-brand-700"
            >
              <span
                aria-hidden
                className="mb-2 grid size-10 place-items-center rounded-full bg-slate-100 text-xl text-slate-500"
              >
                +
              </span>
              <span className="font-medium">New store</span>
            </Link>
          </li>
        </ul>
        {stores.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">You are not a member of any store.</p>
        ) : null}
      </main>
    </>
  );
}
