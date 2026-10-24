'use client';

import { useEffect, useState } from 'react';

/**
 * The sticky tab strip over the home page's stacked product panels: each tab jumps to its panel
 * and the panel in view is underlined.
 */
export function SuiteTabs({
  tabs,
  cta,
}: {
  tabs: { id: string; label: string }[];
  cta: { label: string; href: string };
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const panels = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[visible.length - 1]!.target.id);
      },
      // A panel counts as current once its top passes the middle of the screen.
      { rootMargin: '0px 0px -55% 0px' },
    );
    panels.forEach((p) => observer.observe(p));
    return () => observer.disconnect();
  }, [tabs]);

  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-slate-900/[0.06] bg-mist/80 px-4 backdrop-blur-xl backdrop-saturate-150 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex items-center gap-6">
        <nav aria-label="Platform areas" className="-mb-px min-w-0 flex-1 overflow-x-auto">
          <ul className="flex gap-6 whitespace-nowrap sm:gap-8">
            {tabs.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  aria-current={active === t.id ? 'true' : undefined}
                  className={`block border-b-2 py-4 text-[0.9375rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-azure-600 ${
                    active === t.id
                      ? 'border-leaf-500 text-navy-900'
                      : 'border-transparent text-slate-500 hover:text-navy-900'
                  }`}
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a
          href={cta.href}
          className="hidden shrink-0 rounded-md bg-azure-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgb(10_34_54/0.2)] transition hover:bg-azure-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-600 md:block"
        >
          {cta.label}
        </a>
      </div>
    </div>
  );
}
