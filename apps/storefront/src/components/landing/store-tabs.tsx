'use client';

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';

const WORD_MS = 2600;

/** The hero's changing last line. Stays on the first word when motion is reduced. */
export function HeroWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), WORD_MS);
    return () => clearInterval(timer);
  }, [words.length]);
  return (
    <span key={index} className="block motion-safe:animate-[cp-word_0.5s_ease-out]">
      {words[index]}
    </span>
  );
}

/**
 * Oversized text tabs: the selected sentence is white and the others are dimmed. Panels are
 * rendered on the server and passed in, so this component only tracks which one is showing.
 */
export function StoreTabs({ tabs }: { tabs: { id: string; label: string; panel: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + tabs.length) % tabs.length;
    setActive(next);
    buttons.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Template categories"
        onKeyDown={onKey}
        className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.15] tracking-[-0.03em] sm:text-5xl lg:text-[3.5rem]"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            id={`store-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active === i}
            aria-controls={`store-panel-${tab.id}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            className={`mr-[0.3em] cursor-pointer rounded text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              active === i ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          id={`store-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`store-tab-${tab.id}`}
          hidden={active !== i}
          className="mt-10 sm:mt-14"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
