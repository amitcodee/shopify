import type { ReactNode } from 'react';
import { marketingUrl } from '@/lib/storefront';
import { LogoMark } from './logo';

/** True statements about the product (checked against the code); no figures we cannot back. */
const POINTS = [
  {
    title: '288 free storefront templates',
    body: '24 design styles across 12 industries, plus premium designs.',
  },
  {
    title: 'Get paid your way',
    body: 'Your own Razorpay, PayU, Cashfree, PhonePe, Stripe or PayPal account, or cash on delivery.',
  },
  {
    title: 'One admin for everything',
    body: 'Orders, products, stock, customers and discounts in one place.',
  },
];

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4.5 10.5 3.5 3.5 7.5-8" />
      </svg>
    </span>
  );
}

const footLink =
  'rounded hover:text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';

/** Signed-out pages: a photo panel on wide screens beside an uncarded form. */
export function AuthShell({ children }: { children: ReactNode }) {
  const site = marketingUrl();
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[46%] max-w-[680px] flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex xl:p-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/media/marketing/packing-orders.webp"
          alt=""
          width={1500}
          height={1000}
          decoding="async"
          fetchPriority="high"
          className="auth-photo absolute inset-0 h-full w-full object-cover object-[45%_center]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgb(2_6_12/0.55)_0%,rgb(2_6_12/0.15)_35%,rgb(2_6_12/0.7)_70%,rgb(2_6_12/0.92)_100%)]"
        />
        <div className="relative flex items-center justify-between">
          <a
            href={site}
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <LogoMark inverted className="h-8 w-8" />
            <span className="text-base font-semibold tracking-tight">Commerce Platform</span>
          </a>
          <a
            href={site}
            className="group flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-medium ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            Back to website
          </a>
        </div>
        <div className="auth-rise relative">
          <p className="max-w-md text-[34px] leading-[1.12] font-semibold tracking-tight">
            Your online store, ready in minutes.
          </p>
          <ul className="mt-8 max-w-md space-y-4">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <Check />
                <span>
                  <span className="block text-[15px] font-semibold">{p.title}</span>
                  <span className="block text-sm leading-6 text-white/70">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="flex flex-1 flex-col bg-white">
        <header className="flex items-center justify-between px-6 pt-6 lg:hidden">
          <a href={site} className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="text-base font-semibold tracking-tight text-slate-900">
              Commerce Platform
            </span>
          </a>
          <a href={site} className={`text-sm text-slate-500 ${footLink}`}>
            Back to website
          </a>
        </header>
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="auth-rise w-full max-w-[400px] [animation-delay:80ms]">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-6 pb-6 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Commerce Platform</span>
          <a href={`${site}/legal/terms`} className={footLink}>
            Terms
          </a>
          <a href={`${site}/legal/privacy`} className={footLink}>
            Privacy
          </a>
          <a href={`${site}/contact`} className={footLink}>
            Help
          </a>
        </footer>
      </div>
    </div>
  );
}
