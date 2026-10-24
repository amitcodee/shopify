'use client';

import { type ReactNode, useId, useState } from 'react';

/** Tabs over pre-rendered panels (one per industry); arrow keys move between tabs. */
export function IndustryTabs({
  tabs,
  panels,
}: {
  tabs: { id: string; label: string }[];
  panels: ReactNode[];
}) {
  const [index, setIndex] = useState(0);
  const base = useId();
  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = (i: number) => `${base}-panel-${i}`;

  const move = (to: number) => {
    const next = (to + tabs.length) % tabs.length;
    setIndex(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <div>
      <div className="-mx-4 overflow-x-auto border-b border-slate-900/10 px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Industries" className="-mb-px flex gap-6 whitespace-nowrap">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              id={tabId(i)}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-controls={panelId(i)}
              tabIndex={i === index ? 0 : -1}
              onClick={() => setIndex(i)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') move(i + 1);
                else if (e.key === 'ArrowLeft') move(i - 1);
              }}
              className={`border-b-2 py-3 text-[0.9375rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-azure-600 ${
                i === index
                  ? 'border-leaf-500 text-navy-900'
                  : 'border-transparent text-slate-500 hover:text-navy-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {panels.map((panel, i) => (
        <div
          key={tabs[i]?.id ?? i}
          id={panelId(i)}
          role="tabpanel"
          aria-labelledby={tabId(i)}
          hidden={i !== index}
          className="mt-8"
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
