'use client';

import type { Permission } from '@repo/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  label: string;
  href: string;
  permission?: Permission;
  exact?: boolean;
}

export function SideNav({ items, permissions }: { items: NavItem[]; permissions: Permission[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Store" className="space-y-1">
      {items
        .filter((item) => !item.permission || permissions.includes(item.permission))
        .map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
