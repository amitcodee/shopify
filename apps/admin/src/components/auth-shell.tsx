import type { ReactNode } from 'react';
import { LogoMark } from './logo';

const BENEFITS = [
  '168 storefront templates',
  'Payments, shipping & taxes built in',
  'Sell in multiple currencies',
];

const BARS = [34, 48, 40, 62, 55, 70, 58, 76, 66, 84, 72, 92];
const MOCK_PHOTOS = ['fashion/p1.webp', 'home/p2.webp', 'beauty/p3.webp'];

/** A storefront sketch peeking out behind the admin mock, using a real sample photo. */
function StorefrontMock() {
  return (
    <div
      aria-hidden
      className="absolute -top-20 right-32 z-10 w-52 rotate-[4deg] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 shadow-black/40 ring-white/10"
    >
      <div className="relative h-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/media/templates/fashion/hero.webp"
          alt=""
          width={1500}
          height={1000}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="absolute bottom-2.5 left-3 h-2 w-24 rounded bg-white/90" />
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-2">
        {['fashion/p2.webp', 'fashion/p3.webp', 'fashion/p4.webp'].map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={`/media/templates/${src}`}
            alt=""
            width={600}
            height={600}
            decoding="async"
            className="aspect-square w-full rounded-md object-cover"
          />
        ))}
      </div>
    </div>
  );
}

/** An illustrative, data-free sketch of the admin: shapes only, no claims or numbers. */
function ProductMock() {
  return (
    <div
      aria-hidden
      className="relative rounded-2xl bg-white/[0.06] p-1.5 shadow-2xl ring-1 shadow-black/40 ring-white/10 backdrop-blur"
    >
      <div className="overflow-hidden rounded-xl bg-white text-slate-900">
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-slate-200" />
          <span className="h-2 w-2 rounded-full bg-slate-200" />
          <span className="h-2 w-2 rounded-full bg-slate-200" />
          <span className="ml-3 h-4 flex-1 rounded-md bg-slate-100" />
        </div>
        <div className="flex">
          <div className="hidden w-28 shrink-0 space-y-1.5 border-r border-slate-100 bg-slate-50/80 p-2.5 xl:block">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="h-4 w-4 rounded bg-indigo-500" />
              <span className="h-2 w-12 rounded bg-slate-300" />
            </div>
            {[14, 12, 16, 11, 13, 10].map((w, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 rounded px-1.5 py-1 ${i === 0 ? 'bg-white shadow-xs ring-1 ring-slate-200' : ''}`}
              >
                <span
                  className={`h-2 w-2 rounded-sm ${i === 0 ? 'bg-indigo-500' : 'bg-slate-300'}`}
                />
                <span className="h-1.5 rounded bg-slate-300" style={{ width: `${w * 4}px` }} />
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-3 p-3.5">
            <div className="h-2.5 w-32 rounded bg-slate-800" />
            <div className="grid grid-cols-3 gap-2">
              {['Net sales', 'Orders', 'Avg. order'].map((label) => (
                <div key={label} className="rounded-lg border border-slate-100 p-2">
                  <p className="text-[9px] font-medium text-slate-400">{label}</p>
                  <span className="mt-1.5 block h-2.5 w-3/4 rounded bg-slate-200" />
                  <span className="mt-1.5 block h-1.5 w-1/2 rounded bg-emerald-100" />
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-slate-100 p-2.5">
              <div className="flex h-20 items-end gap-1">
                {BARS.map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-t-sm bg-indigo-500"
                    style={{ height: `${h}%`, opacity: 0.55 + (i / BARS.length) * 0.45 }}
                  />
                ))}
              </div>
            </div>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {[
                [
                  'bg-emerald-50 text-emerald-700',
                  'Paid',
                  'bg-amber-50 text-amber-700',
                  'Unfulfilled',
                ],
                [
                  'bg-emerald-50 text-emerald-700',
                  'Paid',
                  'bg-emerald-50 text-emerald-700',
                  'Fulfilled',
                ],
                [
                  'bg-emerald-50 text-emerald-700',
                  'Paid',
                  'bg-amber-50 text-amber-700',
                  'Unfulfilled',
                ],
              ].map(([t1, l1, t2, l2], i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/media/templates/${MOCK_PHOTOS[i]}`}
                    alt=""
                    width={600}
                    height={600}
                    decoding="async"
                    className="h-6 w-6 rounded-md object-cover ring-1 ring-slate-200"
                  />
                  <span className="h-2 w-10 rounded bg-slate-700" />
                  <span className="h-1.5 w-14 rounded bg-slate-200" />
                  <span className="ml-auto flex gap-1">
                    <span className={`rounded-full px-1.5 text-[8px] font-medium ${t1}`}>{l1}</span>
                    <span className={`rounded-full px-1.5 text-[8px] font-medium ${t2}`}>{l2}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Signed-out pages: a brand panel on wide screens beside the form card. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex xl:p-12">
        {/* Decorative glow and grid for depth. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_35%,rgba(99,102,241,0.35),transparent_70%),radial-gradient(40%_40%_at_10%_100%,rgba(139,92,246,0.25),transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        <div className="relative flex items-center gap-2.5">
          <LogoMark inverted className="h-8 w-8" />
          <span className="text-base font-semibold tracking-tight">Commerce Platform</span>
        </div>
        <div className="relative">
          <p className="max-w-md text-[32px] leading-[1.15] font-semibold tracking-tight">
            Everything you need to run your online store.
          </p>
          <p className="mt-3 max-w-md text-[15px] leading-6 text-slate-400">
            Orders, products, customers and your storefront, managed from one calm workspace.
          </p>
          <div className="relative mt-28 -mr-24">
            <StorefrontMock />
            <ProductMock />
          </div>
        </div>
        <ul className="relative flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-400">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2">
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-4 w-4 text-indigo-400"
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
      </aside>
      <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-12 sm:px-6">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <LogoMark className="h-8 w-8" />
            <span className="text-base font-semibold tracking-tight text-slate-900">
              Commerce Platform
            </span>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-raised sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
