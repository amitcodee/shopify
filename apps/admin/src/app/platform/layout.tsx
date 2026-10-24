import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui';
import { getCurrentUser } from '@/lib/session';
import { type NavItem, SideNav } from '../s/[storeId]/nav';

const ITEMS: NavItem[] = [
  { label: 'Overview', href: '/platform', exact: true, icon: 'home' },
  { label: 'Stores', href: '/platform/stores', icon: 'store' },
  { label: 'Plans', href: '/platform/plans', icon: 'plans' },
  { label: 'Users', href: '/platform/users', icon: 'users' },
  { label: 'Settings', href: '/platform/settings', icon: 'settings', section: 'System' },
  { label: 'Audit log', href: '/platform/audit', icon: 'audit', section: 'System' },
];

/** Platform console. The API independently enforces platform roles on every request. */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user.platformRole !== 'SUPER_ADMIN' && user.platformRole !== 'SUPPORT') notFound();
  const role = user.platformRole.replace('_', ' ').toLowerCase();
  return (
    <AppShell
      user={user}
      breadcrumb={
        <>
          <span className="md:hidden">/</span>
          <span className="font-medium text-slate-900">Platform</span>
          <Badge tone={user.platformRole === 'SUPER_ADMIN' ? 'red' : 'blue'}>{role}</Badge>
        </>
      }
      sidebarHeader={
        <div className="flex items-center gap-3 rounded-xl bg-shell-raised px-3 py-2.5 ring-1 ring-white/5">
          <span className="grid size-8 place-items-center rounded-lg bg-red-500/15 text-red-300">
            <Icon name="shield" className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">Platform console</span>
            <span className="block text-xs capitalize text-slate-400">{role}</span>
          </span>
        </div>
      }
      nav={<SideNav items={ITEMS} permissions={[]} />}
      mobileNav={<SideNav items={ITEMS} permissions={[]} variant="strip" />}
    >
      {children}
    </AppShell>
  );
}
