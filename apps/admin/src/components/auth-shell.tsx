import type { ReactNode } from 'react';
import { LogoMark } from './logo';

const BENEFITS = [
  '108 storefront templates for every kind of shop',
  'Sell in multiple currencies',
  'Payments, shipping and taxes built in',
  'Orders, inventory and customers in one place',
];

/** Signed-out pages: a brand panel on wide screens beside the form card. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-10 text-white lg:flex">
        {/* Soft light blobs for depth; purely decorative. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <LogoMark inverted className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight">Commerce Platform</span>
        </div>
        <div className="relative">
          <p className="text-3xl leading-tight font-semibold tracking-tight">
            Everything you need to run your online store.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-indigo-50">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-white/15 p-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                </svg>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-indigo-200">
          Built for independent brands, makers and retailers.
        </p>
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <LogoMark className="h-8 w-8" />
            <span className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Commerce Platform
            </span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
