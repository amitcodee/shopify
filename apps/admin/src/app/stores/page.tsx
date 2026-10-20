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
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader
          title="Your stores"
          description={`Signed in as ${user.name}`}
          actions={<ButtonLink href="/onboarding">Create store</ButtonLink>}
        />
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                href={`/s/${store.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{store.name}</p>
                  <p className="text-sm text-slate-500">{store.subdomain}</p>
                </div>
                <div className="flex items-center gap-2">
                  {store.status === 'SUSPENDED' ? <Badge tone="red">Suspended</Badge> : null}
                  <Badge tone="indigo">{store.role.toLowerCase()}</Badge>
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
