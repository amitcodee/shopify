import type { ReactNode } from 'react';
import { TopBar } from '@/components/top-bar';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser, getStore } from '@/lib/session';
import { storefrontUrlFor } from '@/lib/storefront';
import { MobileNav, type NavItem, SideNav } from './nav';

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
    },
    {
      label: 'Gift cards',
      icon: 'giftCards',
      href: `${base}/gift-cards`,
      permission: 'orders:read',
    },
    {
      label: 'Online store',
      icon: 'onlineStore',
      href: `${base}/online-store`,
      permission: 'settings:read',
    },
    { label: 'Settings', icon: 'settings', href: `${base}/settings`, permission: 'settings:read' },
  ];

  return (
    <div className="min-h-screen">
      <TopBar user={user}>
        <span className="text-sm text-slate-400">/</span>
        <span className="text-sm font-medium text-slate-900">{store.name}</span>
      </TopBar>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <SideNav items={items} permissions={store.permissions} />
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 block px-3 text-sm text-indigo-600 hover:text-indigo-500"
          >
            View storefront ↗
          </a>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-4 md:hidden">
            <MobileNav
              items={items}
              permissions={store.permissions}
              storefrontUrl={storefrontUrl}
            />
          </div>
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
