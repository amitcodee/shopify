'use client';

import type { Permission } from '@repo/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  label: string;
  href: string;
  icon?: NavIconName;
  permission?: Permission;
  exact?: boolean;
}

// Simple 24×24 outline glyphs; decorative only (the label carries the link's name).
const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  orders: <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6" />,
  products: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  inventory: <path d="m3 7 9-4 9 4v10l-9 4-9-4zm0 0 9 4 9-4m-9 4v10" />,
  collections: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14c1.8.8 3 2.9 3 5.5" />
    </>
  ),
  discounts: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </>
  ),
  giftCards: (
    <>
      <rect x="3" y="8" width="18" height="13" rx="1.5" />
      <path d="M3 12.5h18M12 8v13M12 8c-1.5-3-5.5-3.5-5.5-1S9.5 8 12 8c2.5 0 5.5 1.5 5.5-1S13.5 5 12 8" />
    </>
  ),
  onlineStore: <path d="M4 9h16l-1.5-5h-13zm1 0v11h14V9m-9 11v-5h4v5" />,
  settings: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
};

export type NavIconName = keyof typeof ICONS;

function NavIcon({ name, active }: { name: NavIconName; active: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400 group-hover/nav:text-slate-600'}`}
    >
      {ICONS[name]}
    </svg>
  );
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
              className={`group/nav flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.icon ? <NavIcon name={item.icon} active={active} /> : null}
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
