'use client';

import type { Permission } from '@repo/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  label: string;
  path: string;
  permission?: Permission;
}

const TABS: Tab[] = [
  { label: 'General', path: '' },
  { label: 'Theme', path: '/theme', permission: 'settings:read' },
  { label: 'Domains', path: '/domains', permission: 'settings:read' },
  { label: 'Currencies', path: '/currencies', permission: 'settings:read' },
  { label: 'Locations', path: '/locations', permission: 'settings:read' },
  { label: 'Shipping', path: '/shipping', permission: 'settings:read' },
  { label: 'Taxes', path: '/taxes', permission: 'settings:read' },
  { label: 'Staff', path: '/staff', permission: 'settings:read' },
  { label: 'Payments', path: '/payments', permission: 'settings:read' },
  { label: 'Plan & billing', path: '/billing', permission: 'settings:read' },
  { label: 'Developer', path: '/developer', permission: 'settings:write' },
  { label: 'Audit log', path: '/audit-log', permission: 'settings:read' },
];

export function SettingsTabs({
  storeId,
  permissions,
}: {
  storeId: string;
  permissions: Permission[];
}) {
  const pathname = usePathname();
  const base = `/s/${storeId}/settings`;
  return (
    <nav aria-label="Settings" className="flex flex-wrap gap-1 border-b border-slate-200">
      {TABS.filter((tab) => !tab.permission || permissions.includes(tab.permission)).map((tab) => {
        const href = `${base}${tab.path}`;
        const active = tab.path === '' ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={tab.path}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              active
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
