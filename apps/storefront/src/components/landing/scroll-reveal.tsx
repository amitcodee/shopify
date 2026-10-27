'use client';

import { useEffect } from 'react';

/**
 * Fades marketing content up as it scrolls into view, once. Mark elements with `data-reveal`
 * (the element itself) or `data-reveal="stagger"` (its children, one after another).
 *
 * Content is visible by default: only elements still below the fold when this runs are hidden
 * and then revealed, so nothing on screen flashes and pages work without JavaScript. With
 * reduced motion the CSS skips the transition.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', '');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    // Observes everything not yet revealed, including elements armed by an earlier mount (React
    // runs effects twice in development, and the first observer is disconnected by then).
    const arm = () => {
      for (const el of document.querySelectorAll<HTMLElement>(
        '[data-reveal]:not([data-revealed])',
      )) {
        const fresh = !el.hasAttribute('data-armed');
        el.setAttribute('data-armed', '');
        if (fresh && el.getBoundingClientRect().top < window.innerHeight) {
          el.setAttribute('data-revealed', '');
        } else {
          observer.observe(el);
        }
      }
    };
    arm();
    // Client navigation between marketing pages swaps <main>; arm whatever it brings in.
    const main = document.getElementById('main');
    const mutations = main ? new MutationObserver(arm) : null;
    if (main) mutations?.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations?.disconnect();
    };
  }, []);
  return null;
}
