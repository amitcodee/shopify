import type { ReactNode } from 'react';
import { CookieNotice } from './cookie-notice';
import { bodyFont, displayFont } from './fonts';
import { SiteFooter } from './site-footer';
import { SiteNav } from './site-nav';
import { ScrollReveal } from './scroll-reveal';
import { marketingLinks } from './urls';

/** Keyframes for the marketing pages (kept here so storefront CSS stays store-only). */
const KEYFRAMES = `
@keyframes cp-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes cp-marquee-rev { from { transform: translateX(-50%) } to { transform: translateX(0) } }
@keyframes cp-word { from { opacity: 0; transform: translateY(0.35em) } to { opacity: 1; transform: none } }
`;

/** Nav, page and footer shared by the platform's marketing pages on the root host. */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${bodyFont.variable} ${displayFont.variable} relative flex min-h-screen flex-col overflow-x-clip bg-white font-[family-name:var(--font-body)] text-slate-900 antialiased`}
    >
      <style>{KEYFRAMES}</style>
      <a
        href="#main"
        className="sr-only z-[60] rounded bg-white p-2 text-slate-900 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteNav links={marketingLinks} />
      <main id="main" className="w-full min-w-0 flex-1">
        {children}
      </main>
      <SiteFooter />
      <CookieNotice />
      <ScrollReveal />
    </div>
  );
}
