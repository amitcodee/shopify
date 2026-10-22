import { findThemeTemplate } from '@repo/contracts';
import { TemplateThumb } from './template-thumb';

const BARS = [38, 52, 44, 66, 58, 80, 72, 94];

/** Illustration for the hero: a storefront in a browser frame with an admin card over it. */
export function HeroVisual() {
  const template = findThemeTemplate('home-split');
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-indigo-500/40 via-violet-500/30 to-fuchsia-400/20 blur-3xl" />
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 shadow-black/40 ring-white/10">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <span className="flex gap-1">
            <span className="size-2 rounded-full bg-rose-300" />
            <span className="size-2 rounded-full bg-amber-300" />
            <span className="size-2 rounded-full bg-emerald-300" />
          </span>
          <span className="mx-auto truncate rounded-md bg-white px-3 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
            yourstore.com
          </span>
        </div>
        {template && (
          <TemplateThumb template={template} tiles={4} className="sm:[zoom:1.3] lg:[zoom:1.45]" />
        )}
      </div>

      {/* Admin dashboard card, overlapping the storefront. */}
      <div className="absolute -bottom-10 -left-2 w-48 rounded-xl bg-white p-3.5 shadow-xl ring-1 ring-slate-900/10 sm:-left-8 sm:w-60">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-slate-500 sm:text-xs">Sales today</p>
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 sm:text-[10px]">
            Live
          </span>
        </div>
        <p className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">$1,284.50</p>
        <div className="mt-3 flex h-12 items-end gap-1">
          {BARS.map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-indigo-500 to-violet-400"
              style={{ height: `${h}%`, opacity: 0.45 + i * 0.07 }}
            />
          ))}
        </div>
      </div>
      <div className="absolute -top-5 -right-2 hidden w-52 rounded-xl bg-white p-3 shadow-xl ring-1 ring-slate-900/10 sm:block sm:-right-6">
        <p className="text-xs font-medium text-slate-500">New order</p>
        <div className="mt-2 flex items-center gap-2.5">
          <span className="flex h-8 items-center justify-center rounded-lg bg-indigo-50 px-2 text-xs font-bold text-indigo-600">
            #1042
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">2 items · Paid</p>
            <p className="text-[11px] text-slate-500">Ready to fulfil</p>
          </div>
        </div>
      </div>
    </div>
  );
}
