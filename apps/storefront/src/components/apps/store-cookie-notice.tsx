'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- policy pages are plain links. */

import { useState, useSyncExternalStore } from 'react';

const KEY = 'store-cookie-notice';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function notDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === null;
  } catch {
    return false;
  }
}

/** The Cookie notice app: a dismissible note; dismissal is kept in local storage, not a cookie. */
export function StoreCookieNotice({ message }: { message: string }) {
  const pending = useSyncExternalStore(subscribe, notDismissed, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!pending || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // The notice shows again next visit.
    }
  };
  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-lg flex-col gap-3 rounded-lg bg-page p-4 text-sm text-zinc-700 shadow-xl ring-1 ring-zinc-900/10 sm:flex-row sm:items-center sm:left-4 sm:right-auto"
    >
      <p className="flex-1 leading-6">
        {message}{' '}
        <a href="/policies/privacy-policy" className="font-medium text-zinc-900 underline">
          Privacy policy
        </a>
      </p>
      <button type="button" onClick={dismiss} className="btn shrink-0 px-4 py-2 text-sm">
        OK
      </button>
    </div>
  );
}
