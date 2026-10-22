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

/** Paths the platform's marketing site serves on the root host (besides `/`). */
export const PLATFORM_PAGES = ['/pricing', '/templates'];

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

function PlatformNotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-32 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-600">The page you are looking for does not exist.</p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the root layout picks the page from the request path, so marketing links must do full loads */}
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
      {page === '/' ? (
        <PlatformLanding />
      ) : PLATFORM_PAGES.includes(page) ? (
        children
      ) : (
        <PlatformNotFound />
      )}
    </MarketingShell>
  );
}
