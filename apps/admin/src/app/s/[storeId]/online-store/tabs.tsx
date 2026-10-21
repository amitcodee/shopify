'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Pages', path: '/pages' },
  { label: 'Blog', path: '/blog' },
  { label: 'Navigation', path: '/navigation' },
  { label: 'Policies', path: '/policies' },
  { label: 'Password', path: '/password' },
];

const tabClass = (active: boolean) =>
  `-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
    active
      ? 'border-indigo-600 text-indigo-700'
      : 'border-transparent text-slate-600 hover:text-slate-900'
  }`;

export function OnlineStoreTabs({ storeId }: { storeId: string }) {
  const pathname = usePathname();
  const base = `/s/${storeId}/online-store`;
  return (
    <nav aria-label="Online store" className="flex flex-wrap gap-1 border-b border-slate-200">
      {TABS.map((tab) => {
        const href = `${base}${tab.path}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={tab.path}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={tabClass(active)}
          >
            {tab.label}
          </Link>
        );
      })}
      <Link href={`/s/${storeId}/settings/theme`} className={tabClass(false)}>
        Theme
      </Link>
    </nav>
  );
}
