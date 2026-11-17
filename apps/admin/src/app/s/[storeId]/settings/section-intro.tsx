'use client';

import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icons';

export interface SectionIntroItem {
  title: string;
  body: string;
  help?: { href: string; label: string };
}

/**
 * A short explanation of the open settings section, keyed by its path after `/settings`
 * ('' is General). Built on the server (guide links need the marketing URL), shown here.
 */
export function SectionIntro({
  storeId,
  sections,
}: {
  storeId: string;
  sections: Record<string, SectionIntroItem>;
}) {
  const pathname = usePathname();
  const base = `/s/${storeId}/settings`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const key = `/${rest.split('/')[1] ?? ''}`.replace(/^\/$/, '');
  const section = sections[key];
  if (!section || rest.split('/').length > 2) return null;
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{section.title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
        {section.body}{' '}
        {section.help ? (
          <a
            href={section.help.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded font-medium whitespace-nowrap text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Icon name="book" className="h-3.5 w-3.5" />
            {section.help.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
      </p>
    </div>
  );
}
