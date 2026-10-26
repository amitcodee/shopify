import type { ThemeSettings } from '@repo/contracts';
import type { ReactNode } from 'react';

/** Brand marks as 24px glyphs in the current text color. */
const NETWORKS: { key: keyof ThemeSettings; label: string; path: ReactNode }[] = [
  {
    key: 'socialInstagram',
    label: 'Instagram',
    path: (
      <>
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
        </g>
        <circle cx="17.5" cy="6.5" r="1.2" />
      </>
    ),
  },
  {
    key: 'socialFacebook',
    label: 'Facebook',
    path: (
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    ),
  },
  {
    key: 'socialX',
    label: 'X',
    path: (
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.3l4.4 5.9L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    ),
  },
  {
    key: 'socialYoutube',
    label: 'YouTube',
    path: (
      <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15V9l5.8 3-5.8 3Z" />
    ),
  },
  {
    key: 'socialTiktok',
    label: 'TikTok',
    path: (
      <path d="M16.6 2h-3.4v13.4a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.2a6.3 6.3 0 1 0 5.4 6.2V8.6a7.9 7.9 0 0 0 4.6 1.5V6.7a4.6 4.6 0 0 1-4.6-4.7Z" />
    ),
  },
];

/** Icon links to the store's social profiles; only networks with a URL are shown. */
export function SocialLinks({
  settings,
  className = '',
}: {
  settings: ThemeSettings;
  className?: string;
}) {
  const links = NETWORKS.flatMap((n) => {
    const href = settings[n.key];
    return typeof href === 'string' && href ? [{ ...n, href }] : [];
  });
  if (links.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {links.map((n) => (
        <li key={n.key}>
          <a
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={n.label}
            className="social-link inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition-colors hover:border-zinc-900 hover:bg-zinc-900 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              {n.path}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
