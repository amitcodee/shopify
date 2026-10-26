'use client';

import type { Permission } from '@repo/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  label: string;
  path: string;
  /** Shown under the label on wide screens; hidden from the link's accessible name. */
  description: string;
  group: string;
  permission?: Permission;
}

const TABS: Tab[] = [
  { label: 'General', path: '', description: 'Name, contact, currency', group: 'Store' },
  {
    label: 'Domains',
    path: '/domains',
    description: 'Your web address',
    group: 'Store',
    permission: 'settings:read',
  },
  {
    label: 'Locations',
    path: '/locations',
    description: 'Where you keep stock',
    group: 'Store',
    permission: 'settings:read',
  },
  {
    label: 'Staff',
    path: '/staff',
    description: 'Team access and roles',
    group: 'Store',
    permission: 'settings:read',
  },
  {
    label: 'Theme',
    path: '/theme',
    description: 'Templates and design',
    group: 'Storefront',
    permission: 'settings:read',
  },
  {
    label: 'Currencies',
    path: '/currencies',
    description: 'Prices shoppers see',
    group: 'Storefront',
    permission: 'settings:read',
  },
  {
    label: 'Payments',
    path: '/payments',
    description: 'Providers and payouts',
    group: 'Checkout',
    permission: 'settings:read',
  },
  {
    label: 'Shipping',
    path: '/shipping',
    description: 'Zones and rates',
    group: 'Checkout',
    permission: 'settings:read',
  },
  {
    label: 'Taxes',
    path: '/taxes',
    description: 'Rates by country',
    group: 'Checkout',
    permission: 'settings:read',
  },
  {
    label: 'Plan & billing',
    path: '/billing',
    description: 'Subscription and invoices',
    group: 'Account',
    permission: 'settings:read',
  },
  {
    label: 'Developer',
    path: '/developer',
    description: 'API tokens and webhooks',
    group: 'Account',
    permission: 'settings:write',
  },
  {
    label: 'Audit log',
    path: '/audit-log',
    description: 'Who changed what',
    group: 'Account',
    permission: 'settings:read',
  },
];

/** Settings sections: a left column with descriptions on desktop, a scrolling strip on phones. */
export function SettingsTabs({
  storeId,
  permissions,
}: {
  storeId: string;
  permissions: Permission[];
}) {
  const pathname = usePathname();
  const base = `/s/${storeId}/settings`;
  const tabs = TABS.filter((tab) => !tab.permission || permissions.includes(tab.permission)).map(
    (tab) => {
      const href = `${base}${tab.path}`;
      return {
        ...tab,
        href,
        active: tab.path === '' ? pathname === base : pathname.startsWith(href),
      };
    },
  );
  const groups = [...new Set(tabs.map((t) => t.group))];
  return (
    <nav aria-label="Settings" className="min-w-0">
      {/* Phones and tablets: one scrollable row. */}
      <div className="-mx-4 overflow-x-auto px-4 lg:hidden">
        <div className="flex min-w-max gap-1 border-b border-slate-200 pb-px">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              href={tab.href}
              aria-current={tab.active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-2.5 pt-1 pb-2.5 text-sm font-medium whitespace-nowrap ${
                tab.active
                  ? 'border-indigo-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
      {/* Desktop: grouped column. */}
      <div className="hidden space-y-5 lg:block">
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {group}
            </p>
            <div className="space-y-px">
              {tabs
                .filter((tab) => tab.group === group)
                .map((tab) => (
                  <Link
                    key={tab.path}
                    href={tab.href}
                    aria-current={tab.active ? 'page' : undefined}
                    className={`block rounded-lg px-3 py-1.5 transition-colors ${
                      tab.active
                        ? 'bg-white shadow-xs ring-1 ring-slate-900/[0.07]'
                        : 'hover:bg-slate-900/[0.04]'
                    }`}
                  >
                    <span
                      className={`block text-sm font-medium ${tab.active ? 'text-slate-900' : 'text-slate-700'}`}
                    >
                      {tab.label}
                    </span>
                    <span aria-hidden className="block text-xs text-slate-500">
                      {tab.description}
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
