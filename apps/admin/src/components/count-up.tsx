'use client';

import { formatMoney } from '@repo/contracts';
import { useEffect, useRef } from 'react';

const DURATION = 700;

/**
 * A number (or money amount in minor units) that counts up from zero once when it first renders.
 * The server renders the final value, so it is right without JavaScript and for screen readers;
 * the animation writes straight to the DOM (no re-renders) and is skipped when the viewer
 * prefers reduced motion.
 */
export function CountUp({ value, currency }: { value: number; currency?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const format = (n: number) =>
    currency ? formatMoney(Math.round(n), currency) : Math.round(n).toLocaleString('en-US');
  const final = format(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const show = (n: number) =>
      (el.textContent = currency
        ? formatMoney(Math.round(n), currency)
        : Math.round(n).toLocaleString('en-US'));
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      show(value * (1 - (1 - t) ** 3)); // ease-out cubic
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      show(value);
    };
  }, [value, currency]);

  return (
    <>
      <span ref={ref} aria-hidden="true">
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}
