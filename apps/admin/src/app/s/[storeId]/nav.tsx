'use client';

import type { Permission } from '@repo/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/icons';

export interface NavItem {
  label: string;
  href: string;
  icon?: NavIconName;
  permission?: Permission;
  exact?: boolean;
  /** Items sharing a group render under that heading (in first-seen order). */
  group?: string;
}

export type NavIconName = IconName;

function isActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function SideNav({ items, permissions }: { items: NavItem[]; permissions: Permission[] }) {
  const pathname = usePathname();
  const visible = items.filter((item) => !item.permission || permissions.includes(item.permission));
  const groups: { name?: string; items: NavItem[] }[] = [];
  for (const item of visible) {
    const last = groups.at(-1);
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return (
    <nav aria-label="Store" className="space-y-5">
      {groups.map((group, index) => (
        <div key={group.name ?? `group-${index}`}>
          {group.name?.trim() ? (
            <p className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {group.name}
            </p>
          ) : null}
          <div className="space-y-px">
            {group.items.map((item) => {
              const active = isActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group/nav relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/[0.07]'
                      : 'text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900'
                  }`}
                >
                  {item.icon ? (
                    <Icon
                      name={item.icon}
                      className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-slate-400 group-hover/nav:text-slate-600'}`}
                      strokeWidth={active ? 2 : 1.75}
                    />
                  ) : null}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Phones: the nav collapses behind a "Menu" toggle that opens a full-height drawer. */
export function MobileNav({
  items,
  permissions,
  storefrontUrl,
  header,
}: {
  items: NavItem[];
  permissions: Permission[];
  storefrontUrl: string;
  /** Shown at the top of the drawer (the store switcher). */
  header?: React.ReactNode;
}) {
  const pathname = usePathname();
  const current = items.find((item) => isActive(item, pathname));
  return (
    // Keyed by path so the menu closes after navigating.
    <details key={pathname} className="group/menu">
      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <Icon
          name="menu"
          className="h-4 w-4 text-slate-500 group-open/menu:hidden"
          strokeWidth={2}
        />
        <Icon
          name="close"
          className="hidden h-4 w-4 text-slate-500 group-open/menu:block"
          strokeWidth={2}
        />
        <span>
          <span className="text-slate-500">Menu · </span>
          {current?.label ?? 'Overview'}
        </span>
      </summary>
      <div className="fixed inset-x-0 top-14 bottom-0 z-40 overflow-y-auto border-t border-slate-200 bg-[#fafafb] px-3 pt-3 pb-8">
        {header ? <div className="mb-4">{header}</div> : null}
        <SideNav items={items} permissions={permissions} />
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
        >
          <Icon name="external" className="h-4 w-4 text-slate-400" />
          View storefront
        </a>
      </div>
    </details>
  );
}

/**
 * A "Search" affordance in the top bar. It is not a global search: it focuses the current
 * page's own search box (marked `data-page-search`) and only appears when the page has one.
 * Pressing "/" does the same.
 */
export function PageSearchButton() {
  const pathname = usePathname();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const find = () => document.querySelector<HTMLInputElement>('[data-page-search]');
    // Defer to after the new page has painted.
    const frame = requestAnimationFrame(() => setAvailable(Boolean(find())));
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const input = find();
      if (!input) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
    };
  }, [pathname]);

  if (!available) return <div aria-hidden className="h-8 w-full max-w-sm" />;
  return (
    <button
      type="button"
      onClick={() => {
        const input = document.querySelector<HTMLInputElement>('[data-page-search]');
        input?.focus();
        input?.select();
      }}
      className="flex h-8 w-full max-w-sm items-center gap-2 rounded-lg bg-slate-900/[0.045] px-2.5 text-left text-sm text-slate-500 ring-1 ring-transparent transition hover:bg-white hover:ring-slate-300"
    >
      <Icon name="search" className="h-4 w-4 text-slate-400" strokeWidth={2} />
      <span className="flex-1">Search this page…</span>
      <kbd className="rounded border border-slate-300 bg-white px-1.5 font-sans text-[11px] leading-4 text-slate-500">
        /
      </kbd>
    </button>
  );
}
