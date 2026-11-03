'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'cp-mode';
const CHANGE = 'cp-mode-change';
const DEVICE = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DEVICE);
  // Follow the device setting until the visitor has made a choice of their own.
  const onDevice = () => {
    if (saved()) return;
    document.documentElement.dataset.mode = media.matches ? 'dark' : 'light';
    onChange();
  };
  media.addEventListener('change', onDevice);
  window.addEventListener(CHANGE, onChange);
  return () => {
    media.removeEventListener('change', onDevice);
    window.removeEventListener(CHANGE, onChange);
  };
}

function saved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const isDark = () => document.documentElement.dataset.mode === 'dark';

/** Switches between the light and dark themes and remembers the choice in this browser. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const toggle = () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.mode = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage is blocked: the theme still changes for this page.
    }
    window.dispatchEvent(new Event(CHANGE));
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-[1.125rem]"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        )}
      </svg>
    </button>
  );
}
