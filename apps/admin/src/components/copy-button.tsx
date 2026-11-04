'use client';

import { useState } from 'react';
import { Icon } from './icons';

/** Copies a value to the clipboard and confirms it for a moment. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-700 ring-1 ring-slate-200 ring-inset hover:bg-slate-50"
    >
      <Icon name={copied ? 'check' : 'link'} className="h-3.5 w-3.5" strokeWidth={2} />
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
      <span className="sr-only">: {label}</span>
    </button>
  );
}
