/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
import type { ReactNode } from 'react';
import { CinematicHome } from './landing/home-cinematic';
import { MarketingShell } from './landing/marketing-shell';

export function PlatformNotFound() {
  return (
    <div className="bg-[#0b1215] px-4 py-32 text-center sm:px-6">
      <p className="text-xs font-semibold tracking-[0.14em] text-azure-300 uppercase">404</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
        Page not found
      </h1>
      <p className="mt-4 text-lg text-slate-300">The page you are looking for does not exist.</p>
      <a
        href="/"
        className="mt-9 inline-block rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Back to home
      </a>
    </div>
  );
}

/**
 * Root-host routing: the home page, or the route's own page. Marketing routes render; store-only
 * routes (app/(store)) and unknown paths reach not-found.tsx, which shows PlatformNotFound.
 */
export function PlatformSite({ path, children }: { path: string; children: ReactNode }) {
  const page = path.replace(/\/+$/, '') || '/';
  const home = page === '/';
  return <MarketingShell overlayNav={home}>{home ? <CinematicHome /> : children}</MarketingShell>;
}
