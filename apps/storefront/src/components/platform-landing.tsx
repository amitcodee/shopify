/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
import type { ReactNode } from 'react';
import {
  CheckoutCarousel,
  Developers,
  FeatureCards,
  GetStarted,
  HomeHero,
  IndustriesRow,
  Security,
  SellGlobally,
  TemplateMarquee,
} from './landing/home-sections';
import { MarketingShell } from './landing/marketing-shell';

/**
 * Marketing routes served on the root host besides `/`; `*` matches one path segment. Each route
 * also exists on store hosts, where its page calls notFound().
 */
export const PLATFORM_PAGES = [
  '/pricing',
  '/templates',
  '/templates/*',
  '/features',
  '/features/*',
  '/switch',
  '/security',
  '/guides',
  '/guides/*',
  '/contact',
];

function isPlatformPage(path: string): boolean {
  const parts = path.split('/');
  return PLATFORM_PAGES.some((pattern) => {
    const want = pattern.split('/');
    return want.length === parts.length && want.every((p, i) => p === '*' || p === parts[i]);
  });
}

/** The platform's own home page, served on the root host (no store subdomain). */
export function PlatformLanding() {
  return (
    <>
      <HomeHero />
      <TemplateMarquee />
      <FeatureCards />
      <SellGlobally />
      <CheckoutCarousel />
      <IndustriesRow />
      <Developers />
      <Security />
      <GetStarted />
    </>
  );
}

export function PlatformNotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-32 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-600">The page you are looking for does not exist.</p>
      <a
        href="/"
        className="mt-8 inline-block rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Back to home
      </a>
    </div>
  );
}

/** Root-host routing: the home page, the marketing pages (rendered by their routes), or a 404. */
export function PlatformSite({ path, children }: { path: string; children: ReactNode }) {
  const page = path.replace(/\/+$/, '') || '/';
  return (
    <MarketingShell>
      {page === '/' ? <PlatformLanding /> : isPlatformPage(page) ? children : <PlatformNotFound />}
    </MarketingShell>
  );
}
