/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
import type { ReactNode } from 'react';
import {
  CheckoutCarousel,
  Developers,
  FeatureCards,
  GetStarted,
  HomeHero,
  IndustriesRow,
  RunYourBusiness,
  Security,
  SellGlobally,
  TemplateMarquee,
} from './landing/home-sections';
import { MarketingShell } from './landing/marketing-shell';

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
      <RunYourBusiness />
      <Developers />
      <Security />
      <GetStarted />
    </>
  );
}

export function PlatformNotFound() {
  return (
    <div className="bg-[#f6f4ef] px-4 py-32 text-center sm:px-6">
      <p className="text-xs font-semibold tracking-[0.14em] text-indigo-700 uppercase">404</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
        Page not found
      </h1>
      <p className="mt-4 text-lg text-slate-600">The page you are looking for does not exist.</p>
      <a
        href="/"
        className="mt-9 inline-block rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
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
  return <MarketingShell>{page === '/' ? <PlatformLanding /> : children}</MarketingShell>;
}
