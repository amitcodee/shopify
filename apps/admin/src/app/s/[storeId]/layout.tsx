import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { LogoMark } from '@/components/logo';
import { UserMenu } from '@/components/top-bar';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser, getStore } from '@/lib/session';
import { storefrontUrlFor } from '@/lib/storefront';
import { MobileNav, type NavItem, PageSearchButton, SideNav } from './nav';

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
  const storefrontUrl = storefrontUrlFor(store.subdomain);
  const items: NavItem[] = [
    { label: 'Overview', icon: 'home', href: base, exact: true },
    { label: 'Orders', icon: 'orders', href: `${base}/orders`, permission: 'orders:read' },
    { label: 'Products', icon: 'products', href: `${base}/products`, permission: 'products:read' },
    {
      label: 'Inventory',
      icon: 'inventory',
      href: `${base}/inventory`,
      permission: 'products:read',
    },
    {
      label: 'Purchase orders',
      icon: 'truck',
      href: `${base}/purchase-orders`,
      permission: 'products:read',
    },
    {
      label: 'Collections',
      icon: 'collections',
      href: `${base}/collections`,
      permission: 'products:read',
    },
    {
      label: 'Customers',
      icon: 'customers',
      href: `${base}/customers`,
      permission: 'customers:read',
    },
    {
      label: 'Discounts',
      icon: 'discounts',
      href: `${base}/discounts`,
      permission: 'discounts:write',
      group: 'Marketing',
    },
    {
      label: 'Gift cards',
      icon: 'giftCards',
      href: `${base}/gift-cards`,
      permission: 'orders:read',
      group: 'Marketing',
    },
    {
      label: 'Online store',
      icon: 'onlineStore',
      href: `${base}/online-store`,
      permission: 'settings:read',
      group: 'Sales channels',
    },
    {
      label: 'Apps',
      icon: 'apps',
      href: `${base}/apps`,
      permission: 'settings:read',
      group: 'Sales channels',
    },
    {
      label: 'Settings',
      icon: 'settings',
      href: `${base}/settings`,
      permission: 'settings:read',
      group: ' ',
    },
  ];

  const switcher = (
    <Link
      href="/stores"
      className="group flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-slate-900/[0.04]"
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-xs ring-1 ring-black/5"
      >
        {(store.name.trim()[0] ?? 'S').toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-semibold text-slate-900">
          {store.name}
        </span>
        <span className="block truncate text-xs leading-4 text-slate-500">{store.subdomain}</span>
      </span>
      <Icon name="selector" className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
    </Link>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200/80 bg-[#fafafb] md:flex">
        <div className="flex h-14 items-center border-b border-slate-200/70 px-2.5">{switcher}</div>
        <div className="flex-1 overflow-y-auto px-2.5 py-4">
          <SideNav items={items} permissions={store.permissions} />
        </div>
        <div className="border-t border-slate-200/70 p-2.5">
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
          >
            <Icon name="external" className="h-4 w-4 text-slate-400" />
            View storefront
          </a>
        </div>
      </aside>
      <div className="md:pl-60">
        {/* No backdrop-filter here: it would trap the fixed mobile drawer inside the header. */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Link href="/stores" className="shrink-0 rounded-lg md:hidden">
                <LogoMark className="h-7 w-7" />
                <span className="sr-only">All stores</span>
              </Link>
              <div className="md:hidden">
                <MobileNav
                  items={items}
                  permissions={store.permissions}
                  storefrontUrl={storefrontUrl}
                  header={switcher}
                />
              </div>
              <div className="hidden min-w-0 flex-1 md:block">
                <PageSearchButton />
              </div>
            </div>
            <UserMenu user={user} />
          </div>
        </header>
        <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
        </main>
      </div>
    </div>
  );
}
