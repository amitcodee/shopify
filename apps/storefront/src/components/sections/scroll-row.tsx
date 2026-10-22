'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { SectionHeader } from './section-header';

const ARROW =
  'grid h-9 w-9 place-items-center rounded-full border border-zinc-300 bg-page text-zinc-900 transition hover:border-zinc-900 disabled:pointer-events-none disabled:opacity-30';

/**
 * A horizontally scrolling row with snap points. Prev/next arrows appear beside the heading on
 * devices with a fine pointer, and only while the row is wider than its container. Items should
 * be `relative`, so absolutely positioned content (e.g. sr-only text) stays inside the scroller
 * instead of widening the page on phones.
 */
export function ScrollRow({
  id,
  title,
  eyebrow,
  href,
  children,
}: {
  /** Id of the heading (for the section's aria-labelledby). */
  id: string;
  title: string;
  eyebrow?: string;
  href?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const row = ref.current;
    if (!row) return;
    setEdges({
      start: row.scrollLeft <= 1,
      end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    row.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      row.removeEventListener('scroll', update);
    };
  }, [update]);

  const scroll = (direction: 1 | -1) => {
    const row = ref.current;
    row?.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: 'smooth' });
  };

  const scrollable = !(edges.start && edges.end);
  const arrows = scrollable ? (
    <div className="hidden gap-2 sm:flex pointer-coarse:hidden">
      <button
        type="button"
        className={ARROW}
        onClick={() => scroll(-1)}
        disabled={edges.start}
        aria-label={`Scroll ${title} back`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M12.7 4.3a1 1 0 0 1 0 1.4L8.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0z" />
        </svg>
      </button>
      <button
        type="button"
        className={ARROW}
        onClick={() => scroll(1)}
        disabled={edges.end}
        aria-label={`Scroll ${title} forward`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M7.3 15.7a1 1 0 0 1 0-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 1.4-1.4l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4 0z" />
        </svg>
      </button>
    </div>
  ) : null;

  return (
    <>
      <SectionHeader id={id} title={title} eyebrow={eyebrow} href={href}>
        {arrows}
      </SectionHeader>
      <ul
        ref={ref}
        className="-mx-1 flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] lg:gap-6 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
    </>
  );
}
