import type { StoreSummary } from '@repo/contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TopBar } from '@/components/top-bar';
import { Badge, ButtonLink, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';

export const metadata = { title: 'Your stores · Merchant Admin' };

export default async function StoresPage() {
  const [user, stores] = await Promise.all([
    getCurrentUser(),
    api<StoreSummary[]>('/admin/stores'),
  ]);
  if (stores.length === 0 && user.platformRole !== 'SUPER_ADMIN') redirect('/onboarding');

  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <PageHeader
          title="Your stores"
          description={`Signed in as ${user.name}`}
          actions={<ButtonLink href="/onboarding">Create store</ButtonLink>}
        />
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-card">
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                href={`/s/${store.id}`}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white shadow-xs"
                >
                  {(store.name.trim()[0] ?? 'S').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{store.name}</p>
                  <p className="truncate text-sm text-slate-500">{store.subdomain}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {store.status === 'SUSPENDED' ? <Badge tone="red">Suspended</Badge> : null}
                  <Badge tone="indigo">{store.role.toLowerCase()}</Badge>
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 5 7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </li>
          ))}
          {stores.length === 0 ? (
            <li className="px-5 py-6 text-sm text-slate-500">You are not a member of any store.</li>
          ) : null}
        </ul>
      </main>
    </>
  );
}
