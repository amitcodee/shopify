'use client';

import type { Permission } from '@repo/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/icons';

export interface NavItem {
  label: string;
  href: string;
  permission?: Permission;
  exact?: boolean;
  icon?: IconName;
  /** Items sharing a section are grouped under that heading (in first-seen order). */
  section?: string;
}

function isActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/**
 * Store / platform navigation. `sidebar` renders the grouped vertical list for the dark app
 * shell; `strip` renders a horizontally scrolling row of pills for small screens.
 */
export function SideNav({
  items,
  permissions,
  variant = 'sidebar',
}: {
  items: NavItem[];
  permissions: Permission[];
  variant?: 'sidebar' | 'strip';
}) {
  const pathname = usePathname();
  const visible = items.filter((item) => !item.permission || permissions.includes(item.permission));

  if (variant === 'strip') {
    return (
      <nav aria-label="Store" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex w-max gap-1.5">
          {visible.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ring-1 ring-inset transition-colors ${
                  active
                    ? 'bg-slate-900 text-white ring-slate-900'
                    : 'bg-white text-slate-600 ring-slate-200 hover:text-slate-900'
                }`}
              >
                {item.icon ? <Icon name={item.icon} className="size-4" /> : null}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  const sections: { title?: string; items: NavItem[] }[] = [];
  for (const item of visible) {
    const last = sections.at(-1);
    if (last && last.title === item.section) last.items.push(item);
    else sections.push({ title: item.section, items: [item] });
  }

  return (
    <nav aria-label="Store" className="space-y-6">
      {sections.map((section, index) => (
        <div key={section.title ?? index}>
          {section.title ? (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {section.title}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                    }`}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-2 -left-3 w-1 rounded-r-full bg-brand-400"
                      />
                    ) : null}
                    {item.icon ? (
                      <Icon
                        name={item.icon}
                        className={`size-[18px] shrink-0 ${active ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300'}`}
                      />
                    ) : null}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
