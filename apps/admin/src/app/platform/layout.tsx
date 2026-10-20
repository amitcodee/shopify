import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { TopBar } from '@/components/top-bar';
import { Badge } from '@/components/ui';
import { getCurrentUser } from '@/lib/session';
import { type NavItem, SideNav } from '../s/[storeId]/nav';

const ITEMS: NavItem[] = [
  { label: 'Overview', href: '/platform', exact: true },
  { label: 'Stores', href: '/platform/stores' },
  { label: 'Plans', href: '/platform/plans' },
  { label: 'Users', href: '/platform/users' },
  { label: 'Settings', href: '/platform/settings' },
  { label: 'Audit log', href: '/platform/audit' },
];

/** Platform console. The API independently enforces platform roles on every request. */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user.platformRole !== 'SUPER_ADMIN' && user.platformRole !== 'SUPPORT') notFound();
  return (
    <div className="min-h-screen">
      <TopBar user={user}>
        <span className="text-sm text-slate-400">/</span>
        <span className="text-sm font-medium text-slate-900">Platform</span>
        <Badge tone={user.platformRole === 'SUPER_ADMIN' ? 'red' : 'blue'}>
          {user.platformRole.replace('_', ' ').toLowerCase()}
        </Badge>
      </TopBar>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <SideNav items={ITEMS} permissions={[]} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
