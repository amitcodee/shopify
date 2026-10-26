'use client';

import { useState } from 'react';

/** The Share buttons app on product pages: share links plus copy-link. No third-party scripts. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    {
      label: 'Pinterest',
      href: `https://pinterest.com/pin/create/button/?url=${u}&description=${t}`,
    },
  ];
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-zinc-500">Share</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className="rounded-full px-3 py-1.5 font-medium text-zinc-700 ring-1 ring-zinc-300 transition hover:ring-zinc-500"
        >
          {l.label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked; nothing to do.
          }
        }}
        className="rounded-full px-3 py-1.5 font-medium text-zinc-700 ring-1 ring-zinc-300 transition hover:ring-zinc-500"
      >
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  );
}
