'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * The store header. Sticky headers stay at the top of the viewport (the announcement bar above
 * scrolls away) and pick up a shadow once the page scrolls under them.
 */
export function StickyHeader({
  sticky,
  className,
  children,
}: {
  sticky: boolean;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!sticky) return;
    const header = ref.current;
    if (!header) return;
    const update = () => setScrolled(header.getBoundingClientRect().top <= 0 && window.scrollY > 0);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [sticky]);

  return (
    <header
      data-section="header"
      ref={ref}
      className={className}
      data-sticky={sticky ? '' : undefined}
      data-scrolled={scrolled ? '' : undefined}
    >
      {children}
    </header>
  );
}
