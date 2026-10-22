'use client';

import { useEffect, useState } from 'react';

/**
 * Cycles through `words` (visual only: screen readers get the stable `label`). Stays on the
 * first word when the visitor prefers reduced motion.
 */
export function RotatingWord({ words, label }: { words: string[]; label: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % words.length), 2200);
    return () => window.clearInterval(timer);
  }, [words.length]);

  return (
    <>
      <span className="sr-only">{label}</span>
      <span
        key={index}
        aria-hidden="true"
        className="-mb-[0.15em] inline-block bg-gradient-to-r pb-[0.15em] from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent motion-safe:animate-[cp-word_0.5s_ease-out]"
      >
        {words[index]}
      </span>
    </>
  );
}
