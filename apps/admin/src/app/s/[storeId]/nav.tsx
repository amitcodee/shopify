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

/** Phones: the nav collapses behind a "Menu" toggle so every page doesn't open with ten links. */
export function MobileNav({
  items,
  permissions,
  storefrontUrl,
}: {
  items: NavItem[];
  permissions: Permission[];
  storefrontUrl: string;
}) {
  const pathname = usePathname();
  const current = items.find((item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href),
  );
  return (
    // Keyed by path so the menu closes after navigating.
    <details key={pathname} className="group rounded-md border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-slate-900">
        <span>
          <span className="text-slate-500">Menu · </span>
          {current?.label ?? 'Overview'}
        </span>
        <span aria-hidden className="text-slate-400 group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-slate-200 p-2">
        <SideNav items={items} permissions={permissions} />
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block px-3 py-2 text-sm text-indigo-600 hover:text-indigo-500"
        >
          View storefront ↗
        </a>
      </div>
    </details>
  );
}
