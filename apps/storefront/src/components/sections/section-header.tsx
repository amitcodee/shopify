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
    <div className="section-header">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2.5 text-zinc-500">{eyebrow}</p> : null}
        <h2 id={id} className="section-title t-title break-words">
          {title}
        </h2>
        <span aria-hidden="true" className="section-rule" />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {href ? (
          <Link
            href={href}
            className="group/link inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 transition hover:text-zinc-950"
          >
            <span className="underline decoration-zinc-300 underline-offset-[6px] transition group-hover/link:decoration-current">
              {linkLabel}
            </span>
            <span
              aria-hidden="true"
              className="transition-transform group-hover/link:translate-x-0.5"
            >
              →
            </span>
            <span className="sr-only"> {title}</span>
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  );
}
