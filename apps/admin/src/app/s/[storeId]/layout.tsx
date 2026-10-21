import type { ReactNode } from 'react';
import { TopBar } from '@/components/top-bar';
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
  const items: NavItem[] = [
    { label: 'Overview', href: base, exact: true },
    { label: 'Orders', href: `${base}/orders`, permission: 'orders:read' },
    { label: 'Products', href: `${base}/products`, permission: 'products:read' },
    { label: 'Inventory', href: `${base}/inventory`, permission: 'products:read' },
    { label: 'Collections', href: `${base}/collections`, permission: 'products:read' },
    { label: 'Customers', href: `${base}/customers`, permission: 'customers:read' },
    { label: 'Discounts', href: `${base}/discounts`, permission: 'discounts:write' },
    { label: 'Online store', href: `${base}/online-store`, permission: 'settings:read' },
    { label: 'Settings', href: `${base}/settings`, permission: 'settings:read' },
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
            href={storefrontOrigin.replace('{subdomain}', store.subdomain)}
            target="_blank"
            rel="noreferrer"
            className="mt-6 block px-3 text-sm text-indigo-600 hover:text-indigo-500"
          >
            View storefront ↗
          </a>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-4 md:hidden">
            <SideNav items={items} permissions={store.permissions} />
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
