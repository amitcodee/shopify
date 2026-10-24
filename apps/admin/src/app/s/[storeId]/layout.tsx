import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { Icon } from '@/components/icons';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser, getStore } from '@/lib/session';
import { type NavItem, SideNav } from './nav';

const storefrontOrigin = process.env.STOREFRONT_PUBLIC_URL ?? 'http://{subdomain}.localhost:3200';

export default async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const [user, store, notice] = await Promise.all([
    getCurrentUser(),
    getStore(storeId),
    api<{ adminNotice: string; supportEmail: string }>('/auth/platform-notice'),
  ]);
  const base = `/s/${store.id}`;
  const storefrontUrl = storefrontOrigin.replace('{subdomain}', store.subdomain);
  const items: NavItem[] = [
    { label: 'Overview', href: base, exact: true, icon: 'home' },
    { label: 'Orders', href: `${base}/orders`, permission: 'orders:read', icon: 'orders' },
    { label: 'Products', href: `${base}/products`, permission: 'products:read', icon: 'products' },
    {
      label: 'Inventory',
      href: `${base}/inventory`,
      permission: 'products:read',
      icon: 'inventory',
    },
    {
      label: 'Collections',
      href: `${base}/collections`,
      permission: 'products:read',
      icon: 'collections',
    },
    {
      label: 'Customers',
      href: `${base}/customers`,
      permission: 'customers:read',
      icon: 'customers',
    },
    {
      label: 'Discounts',
      href: `${base}/discounts`,
      permission: 'discounts:write',
      icon: 'discounts',
      section: 'Marketing',
    },
    {
      label: 'Gift cards',
      href: `${base}/gift-cards`,
      permission: 'orders:read',
      icon: 'gift',
      section: 'Marketing',
    },
    {
      label: 'Online store',
      href: `${base}/online-store`,
      permission: 'settings:read',
      icon: 'store',
      section: 'Sales channels',
    },
    {
      label: 'Settings',
      href: `${base}/settings`,
      permission: 'settings:read',
      icon: 'settings',
      section: 'Store',
    },
  ];

  return (
    <AppShell
      user={user}
      breadcrumb={
        <>
          <span className="md:hidden">/</span>
          <span className="truncate font-medium text-slate-900">{store.name}</span>
        </>
      }
      sidebarHeader={
        <Link
          href="/stores"
          title="Switch store"
          className="flex items-center gap-3 rounded-xl bg-shell-raised px-3 py-2.5 ring-1 ring-white/5 transition-colors hover:bg-white/10"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-semibold text-white"
          >
            {store.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{store.name}</span>
            <span className="block truncate text-xs text-slate-400">{store.subdomain}</span>
          </span>
          <Icon name="chevronsUpDown" className="size-4 shrink-0 text-slate-500" />
        </Link>
      }
      nav={<SideNav items={items} permissions={store.permissions} />}
      mobileNav={<SideNav items={items} permissions={store.permissions} variant="strip" />}
      sidebarFooter={
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <Icon name="external" className="size-[18px] text-slate-500" />
          View storefront
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      }
    >
      {notice.adminNotice ? (
        <div className="mb-6">
          <Alert tone="info">{notice.adminNotice}</Alert>
        </div>
      ) : null}
      {store.status === 'SUSPENDED' ? (
        // The API blocks store data while suspended; explain instead of rendering failing pages.
        <Alert tone="error">
          This store is suspended by the platform. Your storefront is offline and the admin is
          locked. Contact {notice.supportEmail} to resolve this.
        </Alert>
      ) : (
        children
      )}
    </AppShell>
  );
}
