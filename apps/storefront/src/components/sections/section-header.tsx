import Link from 'next/link';
import type { ReactNode } from 'react';

/** Heading row shared by homepage sections: optional eyebrow, title and a "View all" link. */
export function SectionHeader({
  id,
  title,
  eyebrow,
  href,
  linkLabel = 'View all',
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  href?: string;
  linkLabel?: string;
  /** Extra controls beside the link (e.g. carousel arrows). */
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2 text-zinc-500">{eyebrow}</p> : null}
        <h2
          id={id}
          className="font-heading text-2xl font-semibold leading-tight tracking-tight break-words sm:text-3xl"
        >
          {title}
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {href ? (
          <Link
            href={href}
            className="text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition hover:text-zinc-900 hover:decoration-zinc-900"
          >
            {linkLabel}
            <span className="sr-only"> {title}</span>
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  );
}
