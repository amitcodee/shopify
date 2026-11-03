'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */

import { useState, useSyncExternalStore } from 'react';

const KEY = 'cp-cookie-notice';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/** True when the notice has not been dismissed yet (false if storage is blocked). */
function notDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === null;
  } catch {
    return false;
  }
}

/**
 * A one-time notice that the site only uses essential cookies (so there is nothing to consent
 * to). Dismissal is remembered in local storage, never in a cookie.
 */
export function CookieNotice() {
  const pending = useSyncExternalStore(subscribe, notDismissed, () => false);
  const [dismissed, setDismissed] = useState(false);

  if (!pending || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Ignore; the notice just shows again next visit.
    }
  };

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-xl bg-mk-bg/85 p-4 text-sm text-mk-fg-soft shadow-[0_20px_50px_-20px_rgb(10_34_54/0.45)] ring-1 ring-mk-line backdrop-blur-xl backdrop-saturate-150 sm:right-auto sm:bottom-5 sm:left-5 sm:mx-0"
    >
      <p className="font-semibold text-mk-fg">We only use essential cookies</p>
      <p className="mt-1 leading-6">
        They keep you signed in and remember your cart and currency. No analytics, advertising or
        tracking cookies.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full bg-mk-fg px-4 py-2 font-semibold text-mk-bg transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg"
        >
          OK
        </button>
        <a
          href="/legal/cookies"
          className="rounded font-semibold text-mk-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg"
        >
          Cookie policy
        </a>
      </div>
    </div>
  );
}
