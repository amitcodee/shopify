import type { ReactNode } from 'react';
import { LogoMark } from '@/components/icons';

const POINTS = [
  'Catalog, inventory and orders across every location',
  'Host-routed storefronts with themes and custom domains',
  'Payments, taxes, shipping and discounts built in',
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-shell p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-brand-600/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -bottom-48 size-[460px] rounded-full bg-fuchsia-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
        />
        <div className="relative flex items-center gap-3 text-sm font-semibold tracking-tight">
          <LogoMark className="size-9" />
          Commerce Platform
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            Everything you need to run your store, in one place.
          </h2>
          <ul className="mt-8 space-y-3.5 text-sm text-slate-300">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-500/25 text-[11px] text-brand-200 ring-1 ring-brand-400/30"
                >
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-2.5 text-sm font-semibold tracking-tight text-slate-900 lg:hidden">
            <LogoMark className="size-8" />
            Commerce Platform
          </div>
          <div className="rounded-2xl bg-white p-8 shadow-card ring-1 ring-slate-900/[0.06] sm:p-9">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
